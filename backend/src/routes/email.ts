import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { createEmailSchema, getEmailsQuerySchema, scheduleBatchEmailSchema } from '../schemas/email';
import prisma from '../lib/prisma';
import { emailQueue, redisConnection } from '../lib/queue';
import { reconcileScheduledJobs } from '../worker';
import { EmailJobStatus } from '@prisma/client';
import { indexEmailJob, esClient, EMAILS_INDEX } from '../lib/elasticsearch';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * ============================================================================
 * EMAIL ROUTE CONTROLLER (routes/email.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * Provides HTTP REST API endpoints for:
 * 1. POST /schedule-batch : Batch scheduling multiple emails with staggered time delays.
 * 2. POST /               : Scheduling a single email job.
 * 3. GET  /search         : High-performance full-text search via Elasticsearch
 *                           with an automatic PostgreSQL fallback if Elasticsearch is down.
 * 4. GET  /               : Paginated listing of email jobs filtered by status.
 */

/**
 * POST /api/emails/schedule-batch
 * 
 * TASK / PURPOSE:
 * Schedules a batch of emails for multiple recipients with an optional stagger delay
 * (e.g. send to recipient 0 at T, recipient 1 at T + delaySeconds, etc.).
 * 
 * WHEN REQUEST REACHES HERE:
 * When a user submits the "Compose Modal" on the frontend after selecting multiple
 * recipients or uploading a CSV file.
 * 
 * HOW IT GENERATES RESPONSE:
 * 1. Validates body against `scheduleBatchEmailSchema`. Throws AppError(400) if invalid.
 * 2. Ensures the sender exists in PostgreSQL (upsert default sender if needed).
 * 3. Loops through each recipient, calculating:
 *      scheduledAt = startTime + (i * delaySeconds * 1000)
 * 4. Persists the EmailJob in PostgreSQL with status 'SCHEDULED'.
 * 5. Calculates BullMQ delay = Math.max(0, scheduledAt - now).
 * 6. Adds job to BullMQ queue with deterministic jobId (`email-${id}`).
 * 7. Links bullJobId back into PostgreSQL row.
 * 8. Indexes the new job into Elasticsearch.
 * 9. Returns HTTP 201 with summary count and scheduled job details.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Response is returned to frontend. The job sits dormant in Redis until the delay
 * countdown expires, whereupon the standalone BullMQ worker picks it up.
 */
router.post(
  '/schedule-batch',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // 1. Validate request body against Zod batch schema
    const parseResult = scheduleBatchEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        parseResult.error.errors[0]?.message || 'Validation failed for schedule-batch',
        400,
        'VALIDATION_ERROR'
      );
    }

    const { subject, body, senderId, recipients, startTime, delaySeconds } = parseResult.data;
    const userId = req.user!.id;

    // 2. Ensure sender account exists for this user (upsert guarantees referential integrity)
    const sender = await prisma.sender.upsert({
      where: { id: senderId },
      update: {},
      create: {
        id: senderId,
        userId: userId,
        name: 'Default Sender',
        fromEmail: 'sender@example.com',
      },
    });

    const createdJobs = [];

    // 3. Iterate over recipients and compute staggered scheduledAt timestamps
    for (let i = 0; i < recipients.length; i++) {
      const recipientEmail = recipients[i];
      const scheduledAt = new Date(startTime.getTime() + i * delaySeconds * 1000);

      // 3a. Insert record into PostgreSQL database
      const emailJob = await prisma.emailJob.create({
        data: {
          userId,
          senderId: sender.id,
          subject,
          body,
          recipientEmail,
          scheduledAt,
          status: EmailJobStatus.SCHEDULED,
        },
        include: { sender: true },
      });

      // 3b. Compute delay milliseconds for Redis BullMQ timer
      const delay = Math.max(0, scheduledAt.getTime() - Date.now());

      // 3c. Add delayed job to BullMQ queue with deterministic ID
      const job = await emailQueue.add(
        'send-email',
        { emailJobId: emailJob.id },
        {
          jobId: `email-${emailJob.id}`,
          delay,
        }
      );

      // 3d. Update database record with resulting BullMQ job ID
      const updatedEmailJob = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId: job.id },
        include: { sender: true },
      });

      // 3e. Asynchronously index document into Elasticsearch
      await indexEmailJob(updatedEmailJob);

      createdJobs.push(updatedEmailJob);
    }

    // 4. Return HTTP 201 Created response to client
    res.status(201).json({
      message: `Successfully scheduled ${createdJobs.length} email jobs`,
      count: createdJobs.length,
      data: {
        scheduledCount: createdJobs.length,
        jobs: createdJobs,
      },
    });
  })
);

/**
 * POST /api/emails/reset-queue
 * 
 * Flushes stale/corrupted BullMQ queue keys from Redis and re-enqueues
 * all pending SCHEDULED jobs from PostgreSQL for immediate dispatch.
 */
router.post(
  '/reset-queue',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // 1. Fetch all keys matching bull:email-send*
    const keys = await redisConnection.keys('bull:email-send*');
    if (keys.length > 0) {
      await redisConnection.del(...keys);
    }

    // 2. Clear bullJobId on all currently SCHEDULED email jobs
    await prisma.emailJob.updateMany({
      where: { status: EmailJobStatus.SCHEDULED },
      data: { bullJobId: null },
    });

    // 3. Trigger reconciliation to re-enqueue clean BullMQ jobs
    await reconcileScheduledJobs();

    res.json({
      success: true,
      message: `Cleaned ${keys.length} queue keys and re-queued pending scheduled jobs.`,
    });
  })
);

/**
 * POST /api/emails
 * 
 * TASK / PURPOSE:
 * Schedules a single email job.
 * 
 * WHEN REQUEST REACHES HERE:
 * When an external API or single dispatch action submits an email payload.
 * 
 * HOW IT GENERATES RESPONSE:
 * 1. Validates body against `createEmailSchema`.
 * 2. Upserts default sender if needed.
 * 3. Creates EmailJob row in PostgreSQL with status 'SCHEDULED'.
 * 4. Adds delayed job to BullMQ queue.
 * 5. Updates bullJobId in database.
 * 6. Indexes record in Elasticsearch.
 * 7. Returns HTTP 201 JSON with created job data.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Client receives HTTP 201; BullMQ worker waits until scheduledAt to dispatch.
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // 1. Validate payload
    const parseResult = createEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        parseResult.error.errors[0]?.message || 'Validation failed for email job',
        400,
        'VALIDATION_ERROR'
      );
    }

    const { subject, body, recipientEmail, senderId, scheduledAt } = parseResult.data;
    const userId = req.user!.id;

    // 2. Ensure sender exists
    const sender = await prisma.sender.upsert({
      where: { id: senderId },
      update: {},
      create: {
        id: senderId,
        userId: userId,
        name: 'Default Sender',
        fromEmail: 'sender@example.com',
      },
    });

    // 3. Create EmailJob row in PostgreSQL
    const emailJob = await prisma.emailJob.create({
      data: {
        userId,
        senderId: sender.id,
        subject,
        body,
        recipientEmail,
        scheduledAt,
        status: EmailJobStatus.SCHEDULED,
      },
      include: { sender: true },
    });

    // 4. Compute delay in milliseconds
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());

    // 5. Enqueue delayed job into BullMQ
    const job = await emailQueue.add(
      'send-email',
      { emailJobId: emailJob.id },
      {
        jobId: `email-${emailJob.id}`,
        delay,
      }
    );

    // 6. Record BullMQ job ID in PostgreSQL
    const updatedEmailJob = await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { bullJobId: job.id },
      include: { sender: true },
    });

    // 7. Index into Elasticsearch
    await indexEmailJob(updatedEmailJob);

    // 8. Return response
    res.status(201).json({
      message: 'Email job created and scheduled successfully',
      data: updatedEmailJob,
    });
  })
);

/**
 * GET /api/emails/search?q=...&status=...
 * 
 * TASK / PURPOSE:
 * Full-text search across subject, body, and recipientEmail.
 * Uses Elasticsearch for fast BM25 relevance scoring.
 * 
 * FAULT TOLERANCE / FALLBACK MECHANISM (INTERVIEW FAVORITE):
 * If Elasticsearch is unreachable (e.g. cluster node failure), the handler
 * catches the error and transparently queries PostgreSQL using case-insensitive
 * ILIKE substring matching so user searches NEVER fail!
 * 
 * WHEN REQUEST REACHES HERE:
 * When the user types into the search box in the dashboard header.
 * 
 * HOW IT GENERATES RESPONSE:
 * 1. Checks Elasticsearch with bool query (must: multi_match, filter: userId & status).
 * 2. Extracts matching IDs in order of search relevance score.
 * 3. Hydrates full records from PostgreSQL while maintaining original relevance order.
 * 4. If Elasticsearch fails, falls back to `prisma.emailJob.findMany()`.
 * 5. Returns JSON `{ data: [...], total: count }`.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Sends JSON back to client; frontend renders search results in DataTable.
 */
router.get(
  '/search',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const statusParam = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const userId = req.user!.id;

    // Build Elasticsearch query filters
    const must: any[] = [];
    const filter: any[] = [{ term: { userId } }];

    // Full-text search across subject, body, and recipient fields
    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['subject', 'body', 'recipientEmail'],
        },
      });
    }

    // Exact status filter (SCHEDULED, SENT, FAILED)
    if (statusParam) {
      filter.push({ term: { status: statusParam.toUpperCase() } });
    }

    const searchQuery: any = must.length > 0 ? { bool: { must, filter } } : { bool: { filter } };

    let matchingIds: string[] = [];

    try {
      // 1. Query Elasticsearch index
      const esResponse = await esClient.search({
        index: EMAILS_INDEX,
        query: searchQuery,
      });

      const hits = esResponse.hits?.hits || [];
      matchingIds = hits.map((hit: any) => hit._id as string).filter(Boolean);
    } catch (esError: any) {
      // 2. RESILIENCE PATTERN: Fallback directly to PostgreSQL if Elasticsearch is unavailable
      console.warn('⚠️ Elasticsearch query error, using PostgreSQL fallback:', esError.message || esError);

      const whereClause: any = {
        userId,
        ...(statusParam ? { status: statusParam.toUpperCase() as EmailJobStatus } : {}),
        ...(q
          ? {
              OR: [
                { subject: { contains: q, mode: 'insensitive' } },
                { body: { contains: q, mode: 'insensitive' } },
                { recipientEmail: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const fallbackJobs = await prisma.emailJob.findMany({
        where: whereClause,
        include: {
          sender: {
            select: { id: true, name: true, fromEmail: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        data: fallbackJobs,
        total: fallbackJobs.length,
      });
      return;
    }

    // If no documents matched search criteria
    if (matchingIds.length === 0) {
      res.json({ data: [], total: 0 });
      return;
    }

    // 3. Hydrate complete relational data from PostgreSQL for matching IDs
    const postgresJobs = await prisma.emailJob.findMany({
      where: {
        id: { in: matchingIds },
        userId,
      },
      include: {
        sender: {
          select: { id: true, name: true, fromEmail: true },
        },
      },
    });

    // 4. Preserve original Elasticsearch relevance score ranking
    const jobMap = new Map(postgresJobs.map((j) => [j.id, j]));
    const orderedJobs = matchingIds.map((id) => jobMap.get(id)).filter(Boolean);

    // 5. Return ordered search results
    res.json({
      data: orderedJobs,
      total: orderedJobs.length,
    });
  })
);

/**
 * GET /api/emails?status=scheduled|sent|failed&page=1&limit=10
 * 
 * TASK / PURPOSE:
 * Fetches a paginated list of email jobs filtered by status for the current user.
 * 
 * WHEN REQUEST REACHES HERE:
 * When the frontend tables (ScheduledEmailsTable, SentEmailsTable, FailedEmailsTable)
 * mount or auto-refresh via SWR.
 * 
 * HOW IT GENERATES RESPONSE:
 * 1. Validates query parameters (status, page, limit) via Zod.
 * 2. Runs a single Prisma transaction with two concurrent queries:
 *    - prisma.emailJob.findMany (with skip and take for pagination)
 *    - prisma.emailJob.count (total matching records)
 * 3. Computes totalPages = Math.ceil(total / limit).
 * 4. Returns JSON `{ data, pagination: { total, page, limit, totalPages } }`.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Sent over HTTP; SWR on the frontend updates React component state and renders rows.
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // 1. Validate query string parameters
    const parseResult = getEmailsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new AppError('Invalid query parameters', 400, 'BAD_REQUEST');
    }

    const { status, page, limit } = parseResult.data;
    const userId = req.user!.id;

    const whereClause = {
      userId,
      ...(status ? { status } : {}),
    };

    const skip = (page - 1) * limit;

    // 2. Fetch page slice and total count atomically using Prisma transaction
    const [data, total] = await prisma.$transaction([
      prisma.emailJob.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: {
            select: { id: true, name: true, fromEmail: true },
          },
        },
      }),
      prisma.emailJob.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 3. Return paginated response
    res.json({
      data,
      totalCount: total,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  })
);

export default router;



import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { createEmailSchema, getEmailsQuerySchema, scheduleBatchEmailSchema } from '../schemas/email';
import prisma from '../lib/prisma';
import { emailQueue } from '../lib/queue';
import { EmailJobStatus } from '@prisma/client';
import { indexEmailJob, esClient, EMAILS_INDEX } from '../lib/elasticsearch';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// POST /api/emails/schedule-batch
router.post(
  '/schedule-batch',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Ensure sender exists for this user (or auto-create default sender)
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

    // Schedule one EmailJob per recipient with scheduledAt = startTime + i * delaySeconds
    for (let i = 0; i < recipients.length; i++) {
      const recipientEmail = recipients[i];
      const scheduledAt = new Date(startTime.getTime() + i * delaySeconds * 1000);

      // 1. Create EmailJob row in PostgreSQL
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

      // 2. Compute delay for BullMQ
      const delay = Math.max(0, scheduledAt.getTime() - Date.now());

      // 3. Add delayed job to BullMQ queue with idempotent jobId (`email-${emailJob.id}`)
      const job = await emailQueue.add(
        'send-email',
        { emailJobId: emailJob.id },
        {
          jobId: `email-${emailJob.id}`,
          delay,
        }
      );

      // 4. Update the database row with resulting BullMQ job ID
      const updatedEmailJob = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId: job.id },
        include: { sender: true },
      });

      // 5. Index created job into Elasticsearch
      await indexEmailJob(updatedEmailJob);

      createdJobs.push(updatedEmailJob);
    }

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

// POST /api/emails
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Ensure sender exists for this user (or auto-create default sender for smooth dev testing)
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

    // 1. Create EmailJob row in PostgreSQL
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

    // 2. Compute delay for BullMQ
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());

    // 3. Add delayed job to BullMQ queue with idempotent jobId (`email-${emailJob.id}`)
    const job = await emailQueue.add(
      'send-email',
      { emailJobId: emailJob.id },
      {
        jobId: `email-${emailJob.id}`,
        delay,
      }
    );

    // 4. Update the database row with resulting BullMQ job ID
    const updatedEmailJob = await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { bullJobId: job.id },
      include: { sender: true },
    });

    // 5. Index created job into Elasticsearch
    await indexEmailJob(updatedEmailJob);

    res.status(201).json({
      message: 'Email job created and scheduled successfully',
      data: updatedEmailJob,
    });
  })
);

// GET /api/emails/search?q=...&status=...
router.get(
  '/search',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const statusParam = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const userId = req.user!.id;

    // Build Elasticsearch query
    const must: any[] = [];
    const filter: any[] = [{ term: { userId } }];

    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['subject', 'body', 'recipientEmail'],
        },
      });
    }

    if (statusParam) {
      filter.push({ term: { status: statusParam.toUpperCase() } });
    }

    const searchQuery: any = must.length > 0 ? { bool: { must, filter } } : { bool: { filter } };

    let matchingIds: string[] = [];

    try {
      const esResponse = await esClient.search({
        index: EMAILS_INDEX,
        query: searchQuery,
      });

      const hits = esResponse.hits?.hits || [];
      matchingIds = hits.map((hit: any) => hit._id as string).filter(Boolean);
    } catch (esError: any) {
      console.warn('⚠️ Elasticsearch query error, using PostgreSQL fallback:', esError.message || esError);

      // Fallback query directly against PostgreSQL if Elasticsearch is offline
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

    if (matchingIds.length === 0) {
      res.json({ data: [], total: 0 });
      return;
    }

    // Hydrate full rows from PostgreSQL
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

    // Preserve original Elasticsearch score ordering
    const jobMap = new Map(postgresJobs.map((j) => [j.id, j]));
    const orderedJobs = matchingIds.map((id) => jobMap.get(id)).filter(Boolean);

    res.json({
      data: orderedJobs,
      total: orderedJobs.length,
    });
  })
);

// GET /api/emails?status=scheduled|sent|failed&page=1&limit=10
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    res.json({
      data,
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


import { Worker, Job } from 'bullmq';
import { redisConnection, emailQueue } from './lib/queue';
import prisma from './lib/prisma';
import { sendEmail } from './lib/mailer';
import { notifySlackRateLimitHit } from './lib/slack';
import { indexEmailJob } from './lib/elasticsearch';
import { EmailJobStatus } from '@prisma/client';

/**
 * ============================================================================
 * STANDALONE BULLMQ BACKGROUND WORKER PROCESS (worker.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Runs as a dedicated background worker daemon (separate from the Express API).
 * - Consumes jobs from BullMQ's "email-send" queue stored in Redis.
 * - Executes the Startup Reconciliation Routine on boot to recover un-enqueued jobs.
 * - Implements a Per-Sender Distributed Rate Limiter directly on Redis.
 * - Dispatches emails via Nodemailer SMTP (Ethereal test sandbox).
 * - Synchronizes delivery status to PostgreSQL (Prisma) and Elasticsearch.
 * - Listens for completion and failure events, handling retry backoff.
 * 
 * WHY IS THIS SEPARATE FROM THE API? (CRITICAL INTERVIEW CONCEPT):
 * Decoupling the worker from the HTTP server ensures that heavy email sending,
 * network delays, and SMTP timeouts never block HTTP request/response loops.
 * Both the API and Worker can be scaled horizontally and independently.
 */

export interface EmailJobData {
  emailJobId: string;
}

// Helper utility to pause execution thread for a given number of milliseconds
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('🚀 Starting standalone BullMQ Worker for "email-send" queue...');

/**
 * reconcileScheduledJobs()
 * 
 * TASK / PURPOSE:
 * Recovers any scheduled email jobs from PostgreSQL that are missing from Redis.
 * This guarantees zero job loss even if Redis crashed, was restarted, or flushed.
 * 
 * WHEN REQUEST REACHES HERE:
 * Automatically executed once upon worker startup (boot time).
 * 
 * HOW IT WORKS (STEP-BY-STEP):
 * 1. Queries PostgreSQL for all EmailJob rows where status = 'SCHEDULED'.
 * 2. Iterates through each record, computing deterministic jobId (`email-${id}`).
 * 3. Checks if BullMQ already has this job in Redis:
 *    - If present: skips it (prevents duplicate sends).
 *    - If missing: recalculates delay (Math.max(0, scheduledAt - Date.now())),
 *      re-enqueues it into BullMQ, and updates bullJobId in the database.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Once reconciliation finishes, worker begins listening for Redis queue events.
 */
export async function reconcileScheduledJobs(): Promise<void> {
  console.log('🔄 Running startup reconciliation routine for SCHEDULED jobs...');
  try {
    // 1. Fetch all scheduled jobs from persistent PostgreSQL database
    const scheduledJobs = await prisma.emailJob.findMany({
      where: { status: EmailJobStatus.SCHEDULED },
    });

    let reconciledCount = 0;
    let alreadyPresentCount = 0;

    for (const jobRow of scheduledJobs) {
      // Deterministic ID prevents duplicate job creation in BullMQ
      const jobId = `email-${jobRow.id}`;
      const existingJob = await emailQueue.getJob(jobId);

      if (existingJob) {
        alreadyPresentCount++;
      } else {
        // Calculate remaining delay in milliseconds (or 0 if past due)
        const delay = Math.max(0, jobRow.scheduledAt.getTime() - Date.now());
        const addedJob = await emailQueue.add(
          'send-email',
          { emailJobId: jobRow.id },
          {
            jobId,
            delay,
          }
        );

        // Keep database row updated with the active BullMQ job ID
        if (!jobRow.bullJobId) {
          await prisma.emailJob.update({
            where: { id: jobRow.id },
            data: { bullJobId: addedJob.id },
          });
        }
        reconciledCount++;
      }
    }

    console.log('==================================================');
    console.log('✅ STARTUP RECONCILIATION SUMMARY');
    console.log('==================================================');
    console.log(`- Total SCHEDULED jobs in PostgreSQL: ${scheduledJobs.length}`);
    console.log(`- Reconciled (re-enqueued in BullMQ): ${reconciledCount}`);
    console.log(`- Already present in Redis (skipped): ${alreadyPresentCount}`);
    console.log('==================================================\n');
  } catch (error) {
    console.error('❌ Error during startup reconciliation routine:', error);
  }
}

/**
 * BullMQ Worker Instance
 * 
 * TASK / PURPOSE:
 * Listens on the 'email-send' queue and processes each scheduled email job.
 * 
 * WHEN A JOB IS PROCESSED:
 * When the job's scheduled delay timer expires in Redis, BullMQ moves the job
 * from 'delayed' to 'wait' status, and this worker pulls it for execution.
 * 
 * CONCURRENCY:
 * Configured via WORKER_CONCURRENCY (default: 5 concurrent jobs at once).
 */
export const emailWorker = new Worker<EmailJobData>(
  'email-send',
  async (job: Job<EmailJobData>, token?: string) => {
    const { emailJobId } = job.data;

    // STEP 1: Load EmailJob from PostgreSQL database
    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      include: { sender: true },
    });

    // Guard: If record was deleted from database, skip processing
    if (!emailJob) {
      console.warn(`⚠️ EmailJob record ${emailJobId} not found in database. Skipping execution.`);
      return;
    }

    // Guard: If job was already marked SENT or FAILED, avoid re-sending
    if (emailJob.status !== EmailJobStatus.SCHEDULED) {
      console.log(`ℹ️ EmailJob ${emailJobId} is already marked as ${emailJob.status}. Skipping execution.`);
      return;
    }

    /**
     * STEP 2: DISTRIBUTED PER-SENDER HOURLY RATE LIMITING (Raw Redis)
     * 
     * HOW IT WORKS:
     * - Key format: `ratelimit:{senderId}:{YYYY-MM-DDTHH}` (1-hour fixed window).
     * - Uses Redis atomic `INCR` to increment dispatch count.
     * - If count === 1 (first request of the hour), sets TTL to 3600 seconds.
     * - If count > MAX_EMAILS_PER_HOUR_PER_SENDER:
     *   1. Decrements the counter back using `DECR`.
     *   2. Computes the exact millisecond timestamp of the next hour (e.g. 14:00:00).
     *   3. Triggers Slack rate limit alert to the user's workspace.
     *   4. Updates Elasticsearch with postponed status.
     *   5. Calls `job.moveToDelayed(nextWindowTimestamp, token)`: Moves job to delay
     *      without marking it failed or losing it!
     */
    const dateHourStr = new Date().toISOString().slice(0, 13); // Window key: "YYYY-MM-DDTHH"
    const rateLimitKey = `ratelimit:${emailJob.senderId}:${dateHourStr}`;
    const maxEmailsPerHour = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 100);

    const currentCount = await redisConnection.incr(rateLimitKey);
    if (currentCount === 1) {
      await redisConnection.expire(rateLimitKey, 3600);
    }

    if (currentCount > maxEmailsPerHour) {
      // Rollback counter so this delayed job isn't double-counted
      await redisConnection.decr(rateLimitKey);

      // Calculate start of the next hour window
      const now = new Date();
      const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
      const nextWindowTimestamp = nextHour.getTime();

      console.warn(
        `⚠️ Sender ${emailJob.senderId} reached hourly limit (${maxEmailsPerHour}/hr). Postponing job ${job.id} to next hour window: ${nextHour.toISOString()}`
      );

      // Send alert to team Slack channel via incoming webhook
      await notifySlackRateLimitHit(emailJob.senderId, maxEmailsPerHour, maxEmailsPerHour);

      // Update Elasticsearch search index
      await indexEmailJob(emailJob);

      // Postpone job in BullMQ until next hour window
      await job.moveToDelayed(nextWindowTimestamp, token);
      return;
    }

    /**
     * STEP 3: MINIMUM DELAY STAGGER (MIN_DELAY_MS)
     * Prevents SMTP server flooding by enforcing a deliberate delay between emails.
     */
    const minDelayMs = Number(process.env.MIN_DELAY_MS ?? 2000);
    if (minDelayMs > 0) {
      await sleep(minDelayMs);
    }

    console.log(`[Attempt ${job.attemptsMade}/${job.opts.attempts || 3}] Processing job ${job.id} for EmailJob ${emailJobId}...`);

    /**
     * STEP 4: SEND EMAIL VIA NODEMAILER (ETHEREAL SMTP)
     * Sends message over SMTP. If SMTP fails, throws an error, triggering BullMQ retry.
     */
    await sendEmail({
      to: emailJob.recipientEmail,
      from: `"${emailJob.sender.name}" <${emailJob.sender.fromEmail}>`,
      subject: emailJob.subject,
      html: `<p>${emailJob.body.replace(/\n/g, '<br>')}</p>`,
    });

    /**
     * STEP 5: MARK JOB AS 'SENT' IN POSTGRESQL
     * Updates status to SENT, records sentAt timestamp, and clears any previous error message.
     */
    const updatedJob = await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailJobStatus.SENT,
        sentAt: new Date(),
        errorMessage: null,
      },
      include: { sender: true },
    });

    // STEP 6: INDEX STATUS IN ELASTICSEARCH FOR INSTANT SEARCH
    await indexEmailJob(updatedJob);

    console.log(`✅ [Job ${job.id}] Successfully sent email for EmailJob ${emailJobId}`);
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  }
);

/**
 * Event: 'completed'
 * Fired when a job successfully completes its execution without errors.
 */
emailWorker.on('error', (err: Error) => {
  console.error('❌ BullMQ Worker Error:', err.message);
});

emailWorker.on('completed', (job: Job<EmailJobData>) => {
  console.log(`🎉 Job ${job.id} completed successfully`);
});

/**
 * Event: 'failed'
 * Fired when job handler throws an error (e.g. SMTP connection timeout).
 * BullMQ automatically retries the job up to opts.attempts (3) with exponential backoff.
 * 
 * FINAL FAILURE HANDLING:
 * When job.attemptsMade >= maxAttempts, all retries have been exhausted.
 * The job is marked as FAILED in PostgreSQL and Elasticsearch with the error message.
 */
emailWorker.on('failed', async (job: Job<EmailJobData> | undefined, err: Error) => {
  if (!job) {
    console.error('⚠️ Unknown job failed:', err.message);
    return;
  }

  const maxAttempts = job.opts.attempts || 3;
  console.warn(`⚠️ Job ${job.id} failed attempt ${job.attemptsMade}/${maxAttempts}: ${err.message}`);

  // Check if all retry attempts have been exhausted
  if (job.attemptsMade >= maxAttempts) {
    const { emailJobId } = job.data;
    console.error(`❌ [Job ${job.id}] Final failure reached after ${maxAttempts} attempts for EmailJob ${emailJobId}`);

    try {
      // Mark as FAILED in PostgreSQL database
      const failedJob = await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: EmailJobStatus.FAILED,
          errorMessage: err.message,
        },
        include: { sender: true },
      });

      // Update Elasticsearch search index
      await indexEmailJob(failedJob);

      console.log(`📝 Updated EmailJob ${emailJobId} status to FAILED in database.`);
    } catch (dbError) {
      console.error(`❌ Failed to update FAILED status in DB for EmailJob ${emailJobId}:`, dbError);
    }
  }
});

// Run reconciliation once on worker startup
reconcileScheduledJobs();

/**
 * GRACEFUL SHUTDOWN HANDLER:
 * When SIGINT (Ctrl+C) or SIGTERM (Docker stop) is received, cleanly close
 * the worker and Redis connection to ensure in-flight jobs are not corrupted.
 */
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}, closing worker gracefully...`);
  await emailWorker.close();
  await redisConnection.quit();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));


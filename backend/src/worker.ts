import { Worker, Job } from 'bullmq';
import { redisConnection, emailQueue } from './lib/queue';
import prisma from './lib/prisma';
import { sendEmail } from './lib/mailer';
import { notifySlackRateLimitHit } from './lib/slack';
import { indexEmailJob } from './lib/elasticsearch';
import { EmailJobStatus } from '@prisma/client';

export interface EmailJobData {
  emailJobId: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('🚀 Starting standalone BullMQ Worker for "email-send" queue...');

/**
 * Startup Reconciliation Routine:
 * Runs once when the worker boots. Queries PostgreSQL for all EmailJob rows with status=SCHEDULED
 * and re-adds missing jobs to BullMQ using deterministic jobIds (email-${id}) and recomputed delays.
 */
export async function reconcileScheduledJobs(): Promise<void> {
  console.log('🔄 Running startup reconciliation routine for SCHEDULED jobs...');
  try {
    const scheduledJobs = await prisma.emailJob.findMany({
      where: { status: EmailJobStatus.SCHEDULED },
    });

    let reconciledCount = 0;
    let alreadyPresentCount = 0;

    for (const jobRow of scheduledJobs) {
      const jobId = `email-${jobRow.id}`;
      const existingJob = await emailQueue.getJob(jobId);

      if (existingJob) {
        alreadyPresentCount++;
      } else {
        const delay = Math.max(0, jobRow.scheduledAt.getTime() - Date.now());
        const addedJob = await emailQueue.add(
          'send-email',
          { emailJobId: jobRow.id },
          {
            jobId,
            delay,
          }
        );

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

export const emailWorker = new Worker<EmailJobData>(
  'email-send',
  async (job: Job<EmailJobData>, token?: string) => {
    const { emailJobId } = job.data;

    // 1. Load EmailJob by id from PostgreSQL
    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      include: { sender: true },
    });

    if (!emailJob) {
      console.warn(`⚠️ EmailJob record ${emailJobId} not found in database. Skipping execution.`);
      return;
    }

    if (emailJob.status !== EmailJobStatus.SCHEDULED) {
      console.log(`ℹ️ EmailJob ${emailJobId} is already marked as ${emailJob.status}. Skipping execution.`);
      return;
    }

    // 2. Per-Sender Hourly Rate Limiting with Raw Redis
    const dateHourStr = new Date().toISOString().slice(0, 13); // Key window: "YYYY-MM-DDTHH"
    const rateLimitKey = `ratelimit:${emailJob.senderId}:${dateHourStr}`;
    const maxEmailsPerHour = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 100);

    const currentCount = await redisConnection.incr(rateLimitKey);
    if (currentCount === 1) {
      await redisConnection.expire(rateLimitKey, 3600);
    }

    if (currentCount > maxEmailsPerHour) {
      // Exceeds limit: DECR count back, calculate start of next hour window, and move job to delayed
      await redisConnection.decr(rateLimitKey);

      const now = new Date();
      const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
      const nextWindowTimestamp = nextHour.getTime();

      console.warn(
        `⚠️ Sender ${emailJob.senderId} reached hourly limit (${maxEmailsPerHour}/hr). Postponing job ${job.id} to next hour window: ${nextHour.toISOString()}`
      );

      // Dispatch Slack rate limit alert (does not throw if unconfigured)
      await notifySlackRateLimitHit(emailJob.senderId, maxEmailsPerHour, maxEmailsPerHour);

      // Index job status in Elasticsearch (rescheduled / postponed)
      await indexEmailJob(emailJob);

      // Move job to delayed queue without failing or dropping it
      await job.moveToDelayed(nextWindowTimestamp, token);
      return;
    }

    // 3. Enforce minimum dispatch delay between sends via MIN_DELAY_MS
    const minDelayMs = Number(process.env.MIN_DELAY_MS ?? 2000);
    if (minDelayMs > 0) {
      await sleep(minDelayMs);
    }

    console.log(`[Attempt ${job.attemptsMade}/${job.opts.attempts || 3}] Processing job ${job.id} for EmailJob ${emailJobId}...`);

    // 4. Call sendEmail with required signature ({ to, from, subject, html })
    await sendEmail({
      to: emailJob.recipientEmail,
      from: `"${emailJob.sender.name}" <${emailJob.sender.fromEmail}>`,
      subject: emailJob.subject,
      html: `<p>${emailJob.body.replace(/\n/g, '<br>')}</p>`,
    });

    // 5. On success: set status = SENT, sentAt = now
    const updatedJob = await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailJobStatus.SENT,
        sentAt: new Date(),
        errorMessage: null,
      },
      include: { sender: true },
    });

    // Index sent status in Elasticsearch
    await indexEmailJob(updatedJob);

    console.log(`✅ [Job ${job.id}] Successfully sent email for EmailJob ${emailJobId}`);
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  }
);

// Success event listener
emailWorker.on('completed', (job: Job<EmailJobData>) => {
  console.log(`🎉 Job ${job.id} completed successfully`);
});

// Final failure event listener
emailWorker.on('failed', async (job: Job<EmailJobData> | undefined, err: Error) => {
  if (!job) {
    console.error('⚠️ Unknown job failed:', err.message);
    return;
  }

  const maxAttempts = job.opts.attempts || 3;
  console.warn(`⚠️ Job ${job.id} failed attempt ${job.attemptsMade}/${maxAttempts}: ${err.message}`);

  // Check if all attempts are exhausted (final failure)
  if (job.attemptsMade >= maxAttempts) {
    const { emailJobId } = job.data;
    console.error(`❌ [Job ${job.id}] Final failure reached after ${maxAttempts} attempts for EmailJob ${emailJobId}`);

    try {
      const failedJob = await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: EmailJobStatus.FAILED,
          errorMessage: err.message,
        },
        include: { sender: true },
      });
      // Index failed status in Elasticsearch
      await indexEmailJob(failedJob);

      console.log(`📝 Updated EmailJob ${emailJobId} status to FAILED in database.`);
    } catch (dbError) {
      console.error(`❌ Failed to update FAILED status in DB for EmailJob ${emailJobId}:`, dbError);
    }
  }
});

// Run reconciliation once on worker startup
reconcileScheduledJobs();

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}, closing worker gracefully...`);
  await emailWorker.close();
  await redisConnection.quit();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

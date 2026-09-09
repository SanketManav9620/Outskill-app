import prisma from '../src/lib/prisma';
import { emailQueue, redisConnection } from '../src/lib/queue';
import { EmailJobStatus } from '@prisma/client';
import { emailWorker } from '../src/worker';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runRateLimitTest() {
  console.log('🧪 Starting Per-Sender Rate Limit Test...');

  // Set environment variable limit to 3 emails per hour for this test process
  process.env.MAX_EMAILS_PER_HOUR_PER_SENDER = '3';
  process.env.MIN_DELAY_MS = '100';

  const testUserId = `user-ratelimit-test-${Date.now()}`;
  const testSenderId = `sender-ratelimit-test-${Date.now()}`;

  try {
    // 1. Create Test User and Test Sender in PostgreSQL
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        name: 'Rate Limit Tester',
      },
    });

    const sender = await prisma.sender.create({
      data: {
        id: testSenderId,
        userId: user.id,
        name: 'Throttled Sender',
        fromEmail: 'throttled@example.com',
      },
    });

    // Clean up any stale Redis rate limit key
    const dateHourStr = new Date().toISOString().slice(0, 13);
    await redisConnection.del(`ratelimit:${sender.id}:${dateHourStr}`);

    console.log(`👤 Created Test Sender ${sender.id} (Hourly Limit: 3 emails)`);

    // 2. Schedule 5 emails for this sender at the exact same timestamp
    const now = new Date();
    const emailJobs = [];

    console.log('📨 Creating 5 EmailJob records scheduled at the same timestamp...');
    for (let i = 1; i <= 5; i++) {
      const emailJob = await prisma.emailJob.create({
        data: {
          userId: user.id,
          senderId: sender.id,
          subject: `Rate Limit Test Email #${i}`,
          body: `Test payload content ${i}`,
          recipientEmail: `recipient${i}@example.com`,
          scheduledAt: now,
          status: EmailJobStatus.SCHEDULED,
        },
      });

      // Enqueue job to BullMQ
      const job = await emailQueue.add(
        'send-email',
        { emailJobId: emailJob.id },
        {
          jobId: `email-${emailJob.id}`,
          delay: 0,
        }
      );

      await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId: job.id },
      });

      emailJobs.push(emailJob);
    }

    console.log('⏳ Waiting for worker to process queued jobs...');
    // Allow worker processor to run all 5 jobs
    await sleep(4000);

    // 3. Query PostgreSQL for job statuses
    const updatedJobs = await prisma.emailJob.findMany({
      where: {
        id: { in: emailJobs.map((j) => j.id) },
      },
    });

    const sentCount = updatedJobs.filter((j) => j.status === EmailJobStatus.SENT).length;
    const scheduledCount = updatedJobs.filter((j) => j.status === EmailJobStatus.SCHEDULED).length;
    const failedCount = updatedJobs.filter((j) => j.status === EmailJobStatus.FAILED).length;

    console.log('\n==================================================');
    console.log('📊 RATE LIMIT TEST RESULTS');
    console.log('==================================================');
    console.log(`- Total Email Jobs Created: 5`);
    console.log(`- Jobs Status = SENT:      ${sentCount} (Expected: 3)`);
    console.log(`- Jobs Status = SCHEDULED: ${scheduledCount} (Expected: 2, postponed to next hour)`);
    console.log(`- Jobs Status = FAILED:    ${failedCount} (Expected: 0)`);
    console.log('==================================================');

    // 4. Assert 3 SENT and 2 SCHEDULED
    if (sentCount === 3 && scheduledCount === 2 && failedCount === 0) {
      console.log('\n🎉 ✅ RATE LIMIT TEST PASSED SUCCESSFULLY!');
      console.log('   3 emails sent within hourly quota, 2 postponed to next hour window staying SCHEDULED.\n');
    } else {
      console.error('\n❌ 🚨 RATE LIMIT TEST FAILED! Counts do not match expected assertions.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error during rate limit test execution:', error);
    process.exit(1);
  } finally {
    await emailWorker.close();
    await redisConnection.quit();
    process.exit(0);
  }
}

runRateLimitTest();

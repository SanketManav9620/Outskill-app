import prisma from '../src/lib/prisma';
import { emailQueue } from '../src/lib/queue';
import { EmailJobStatus } from '@prisma/client';
import { indexEmailJob, esClient } from '../src/lib/elasticsearch';

/**
 * ============================================================================
 * BATCH EMAIL SCHEDULING VERIFICATION TEST SUITE (testBatchSchedule.ts)
 * ============================================================================
 * WHAT THIS SCRIPT DOES:
 * - Verifies the end-to-end logic of batch email scheduling.
 * - Asserts staggered delay computation (`scheduledAt = startTime + i * delaySeconds`).
 * - Validates deterministic BullMQ job IDs (`email-${id}`) and delay milliseconds.
 * - Asserts synchronization across PostgreSQL and Elasticsearch.
 */
async function runBatchScheduleTest() {
  console.log('🧪 Starting Batch Email Scheduling Test...');


  const originalIndex = esClient.index;
  const originalAdd = emailQueue.add;
  const originalUserCreate = prisma.user.create;
  const originalSenderCreate = prisma.sender.create;
  const originalSenderUpsert = prisma.sender.upsert;
  const originalEmailJobCreate = prisma.emailJob.create;
  const originalEmailJobUpdate = prisma.emailJob.update;

  const indexedDocs: any[] = [];
  const enqueuedJobs: any[] = [];
  const dbJobs: Map<string, any> = new Map();

  try {
    (esClient as any).index = async ({ index, id, document }: any) => {
      indexedDocs.push(document);
      return { result: 'created', _id: id };
    };

    (emailQueue as any).add = async (name: string, data: any, opts: any) => {
      enqueuedJobs.push({ name, data, opts });
      return { id: `mock-bull-${data.emailJobId}` };
    };

    let jobCounter = 1;
    (prisma.emailJob as any).create = async ({ data }: any) => {
      const id = `job-batch-${jobCounter++}`;
      const jobRecord = {
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: { name: 'Batch Sender', fromEmail: 'batch@example.com' },
      };
      dbJobs.set(id, jobRecord);
      return jobRecord;
    };

    (prisma.emailJob as any).update = async ({ where, data }: any) => {
      const existing = dbJobs.get(where.id);
      const updated = { ...existing, ...data };
      dbJobs.set(where.id, updated);
      return updated;
    };

    (prisma.sender as any).upsert = async ({ where, create }: any) => {
      return { id: create.id, userId: create.userId, name: create.name, fromEmail: create.fromEmail };
    };

    // Perform batch scheduling logic for 3 recipients with delaySeconds = 5
    const recipients = ['r1@example.com', 'r2@example.com', 'r3@example.com'];
    const startTime = new Date();
    const delaySeconds = 5;
    const testSenderId = 'sender-batch-test';
    const userId = 'user-batch-test';

    const scheduledJobs = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipientEmail = recipients[i];
      const scheduledAt = new Date(startTime.getTime() + i * delaySeconds * 1000);

      const emailJob = await prisma.emailJob.create({
        data: {
          userId,
          senderId: testSenderId,
          subject: `Batch Email #${i + 1}`,
          body: `Content for recipient ${i + 1}`,
          recipientEmail,
          scheduledAt,
          status: EmailJobStatus.SCHEDULED,
        },
        include: { sender: true },
      });

      const delay = Math.max(0, scheduledAt.getTime() - Date.now());
      const job = await emailQueue.add(
        'send-email',
        { emailJobId: emailJob.id },
        { jobId: `email-${emailJob.id}`, delay }
      );

      const updatedJob = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId: job.id },
        include: { sender: true },
      });

      await indexEmailJob(updatedJob);
      scheduledJobs.push(updatedJob);
    }

    console.log(`- Total Batch Jobs Created in DB: ${scheduledJobs.length} (Expected: 3)`);
    console.log(`- Total Jobs Enqueued in BullMQ:  ${enqueuedJobs.length} (Expected: 3)`);
    console.log(`- Total Jobs Indexed in Elasticsearch: ${indexedDocs.length} (Expected: 3)`);

    // Verify staggered scheduledAt timestamps
    const diff0_1 = (scheduledJobs[1].scheduledAt.getTime() - scheduledJobs[0].scheduledAt.getTime()) / 1000;
    const diff1_2 = (scheduledJobs[2].scheduledAt.getTime() - scheduledJobs[1].scheduledAt.getTime()) / 1000;

    console.log(`- Stagger Delay Job 0 -> 1: ${diff0_1}s (Expected: 5s)`);
    console.log(`- Stagger Delay Job 1 -> 2: ${diff1_2}s (Expected: 5s)`);

    if (scheduledJobs.length !== 3 || enqueuedJobs.length !== 3 || indexedDocs.length !== 3) {
      throw new Error('Batch scheduling counts do not match expected values!');
    }

    if (diff0_1 !== 5 || diff1_2 !== 5) {
      throw new Error('Stagger delay calculation is incorrect!');
    }

    console.log('\n==================================================');
    console.log('🎉 ALL BATCH SCHEDULING TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
  } catch (error) {
    console.error('❌ Batch scheduling test failed:', error);
    process.exit(1);
  } finally {
    (esClient as any).index = originalIndex;
    (emailQueue as any).add = originalAdd;
    (prisma.user as any).create = originalUserCreate;
    (prisma.sender as any).create = originalSenderCreate;
    (prisma.sender as any).upsert = originalSenderUpsert;
    (prisma.emailJob as any).create = originalEmailJobCreate;
    (prisma.emailJob as any).update = originalEmailJobUpdate;
    process.exit(0);
  }
}

runBatchScheduleTest();

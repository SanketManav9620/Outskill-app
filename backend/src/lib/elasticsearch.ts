import { Client } from '@elastic/elasticsearch';
import { env } from '../env';
import prisma from './prisma';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
});

export const EMAILS_INDEX = 'emails';

/**
 * Ensures that the 'emails' index exists in Elasticsearch with correct schema mappings:
 * - subject: text
 * - body: text
 * - recipientEmail: keyword
 * - senderName: keyword
 * - status: keyword
 * - scheduledAt: date
 * - sentAt: date
 */
export async function ensureEmailsIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderName: { type: 'keyword' },
            subject: { type: 'text' },
            body: { type: 'text' },
            recipientEmail: { type: 'keyword' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      });
      console.log(`✅ Created Elasticsearch index "${EMAILS_INDEX}" with proper mappings.`);
    }
  } catch (error: any) {
    console.warn(`⚠️ Could not ensure Elasticsearch index "${EMAILS_INDEX}":`, error.message || error);
  }
}

/**
 * Upserts an EmailJob row into Elasticsearch using the row's id as the document id.
 */
export async function indexEmailJob(emailJob: any): Promise<void> {
  try {
    let senderName = emailJob.sender?.name;

    // If sender relation is missing on emailJob, fetch sender from DB
    if (!senderName && emailJob.senderId) {
      const sender = await prisma.sender.findUnique({
        where: { id: emailJob.senderId },
      });
      senderName = sender?.name || '';
    }

    const document = {
      id: emailJob.id,
      userId: emailJob.userId,
      senderId: emailJob.senderId,
      senderName: senderName || '',
      subject: emailJob.subject,
      body: emailJob.body,
      recipientEmail: emailJob.recipientEmail,
      status: emailJob.status,
      scheduledAt: emailJob.scheduledAt instanceof Date ? emailJob.scheduledAt.toISOString() : emailJob.scheduledAt,
      sentAt: emailJob.sentAt ? (emailJob.sentAt instanceof Date ? emailJob.sentAt.toISOString() : emailJob.sentAt) : null,
      createdAt: emailJob.createdAt instanceof Date ? emailJob.createdAt.toISOString() : emailJob.createdAt,
      updatedAt: emailJob.updatedAt instanceof Date ? emailJob.updatedAt.toISOString() : emailJob.updatedAt,
    };

    await esClient.index({
      index: EMAILS_INDEX,
      id: emailJob.id,
      document,
      refresh: 'wait_for',
    });

    console.log(`🔍 Indexed EmailJob ${emailJob.id} (Status: ${emailJob.status}) into Elasticsearch.`);
  } catch (error: any) {
    console.warn(`⚠️ Failed to index EmailJob ${emailJob?.id} into Elasticsearch (handled gracefully):`, error.message || error);
  }
}

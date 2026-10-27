import { Client } from '@elastic/elasticsearch';
import { env } from '../env';
import prisma from './prisma';

/**
 * ============================================================================
 * ELASTICSEARCH SERVICE CLIENT & INDEXING (lib/elasticsearch.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Initializes the official Elasticsearch client connected to port 9200.
 * - Creates and manages the schema mappings for the 'emails' index.
 * - Upserts email jobs into Elasticsearch whenever created, sent, or rescheduled.
 * 
 * WHY USE ELASTICSEARCH FOR SEARCH? (INTERVIEW CONCEPT):
 * Relational databases like PostgreSQL use B-tree indexes, which perform poorly
 * for arbitrary substring searches (`LIKE '%keyword%'` causes full table scans).
 * Elasticsearch uses an Inverted Index and BM25 relevance algorithms, enabling
 * millisecond-level full-text fuzzy searches, typo tolerance, and tokenization
 * across millions of records.
 * 
 * TEXT vs KEYWORD IN ELASTICSEARCH:
 * - `type: 'text'`: Analyzed, tokenized, lowercased (ideal for subject & body search).
 * - `type: 'keyword'`: Preserved exact, unanalyzed (ideal for filtering by status, userId, senderId).
 */

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
});

export const EMAILS_INDEX = 'emails';

/**
 * ensureEmailsIndex()
 * 
 * TASK / PURPOSE:
 * Checks if the 'emails' index exists in Elasticsearch. If missing, creates it
 * with strictly typed field mappings.
 * 
 * WHEN REQUEST REACHES HERE:
 * Called on server startup inside index.ts (`ensureEmailsIndex()`).
 * 
 * HOW IT GENERATES RESPONSE:
 * Calls `esClient.indices.exists({ index: EMAILS_INDEX })`. If false, issues
 * `esClient.indices.create()` with the JSON properties mapping.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Logs success or handles cluster connection errors gracefully (non-blocking).
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
            subject: { type: 'text' },        // Tokenized for full-text search
            body: { type: 'text' },           // Tokenized for full-text search
            recipientEmail: { type: 'keyword' },
            status: { type: 'keyword' },      // Exact match for SCHEDULED, SENT, FAILED
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
 * indexEmailJob()
 * 
 * TASK / PURPOSE:
 * Upserts an EmailJob row into the 'emails' Elasticsearch index.
 * 
 * WHEN REQUEST REACHES HERE:
 * Called whenever an EmailJob is scheduled, rescheduled due to rate limit,
 * successfully sent, or marked as failed.
 * 
 * HOW IT GENERATES RESPONSE:
 * 1. Resolves senderName if not preloaded.
 * 2. Serializes dates to ISO 8601 strings.
 * 3. Calls `esClient.index({ id: emailJob.id, document, refresh: 'wait_for' })`.
 *    (`wait_for` ensures the indexed document is immediately searchable by subsequent queries).
 * 
 * WHERE CONTROL MOVES NEXT:
 * Returns Promise<void>. If Elasticsearch is temporarily down, catches error gracefully
 * so database and email processing are never blocked.
 */
export async function indexEmailJob(emailJob: any): Promise<void> {
  try {
    let senderName = emailJob.sender?.name;

    // If sender relation is missing on emailJob, fetch sender name from PostgreSQL
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

    // Index or update document using the PostgreSQL row's UUID as document _id
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


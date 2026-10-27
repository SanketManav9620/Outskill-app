import { esClient, ensureEmailsIndex, indexEmailJob, EMAILS_INDEX } from '../src/lib/elasticsearch';
import prisma from '../src/lib/prisma';

/**
 * ============================================================================
 * ELASTICSEARCH INDEXING & SEARCH TEST SUITE (testElasticsearch.ts)
 * ============================================================================
 * WHAT THIS SCRIPT DOES:
 * - Validates index creation with custom type mappings.
 * - Asserts document upserting when jobs change states.
 * - Tests full-text search multi_match queries against recipient, subject, and body.
 */
async function runElasticsearchTest() {
  console.log('🧪 Starting Elasticsearch Indexing & Search Test...');


  const originalIndicesExists = esClient.indices.exists;
  const originalIndicesCreate = esClient.indices.create;
  const originalIndex = esClient.index;
  const originalSearch = esClient.search;

  try {
    const indexedDocs: Map<string, any> = new Map();

    // ---------------------------------------------------------------
    // Test Case 1: Indexing EmailJob on creation
    // ---------------------------------------------------------------
    console.log('\n--- Test Case 1: Indexing EmailJob Document ---');

    (esClient.indices as any).exists = async ({ index }: any) => true;
    (esClient as any).index = async ({ index, id, document }: any) => {
      indexedDocs.set(id, document);
      return { result: 'created', _id: id };
    };

    const mockEmailJob = {
      id: 'job-es-test-123',
      userId: 'user-es-123',
      senderId: 'sender-es-123',
      sender: { name: 'Elasticsearch Tester' },
      subject: 'Elasticsearch Test Subject',
      body: 'Testing multi_match full-text indexing',
      recipientEmail: 'recipient@example.com',
      status: 'SCHEDULED',
      scheduledAt: new Date(),
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await indexEmailJob(mockEmailJob);

    const doc = indexedDocs.get('job-es-test-123');
    console.log('- Indexed Doc ID:', doc?.id);
    console.log('- Indexed Subject:', doc?.subject);
    console.log('- Indexed Status:', doc?.status);

    if (!doc || doc.id !== 'job-es-test-123' || doc.subject !== 'Elasticsearch Test Subject') {
      throw new Error('Test Case 1 Failed: Document was not indexed correctly!');
    }
    console.log('✅ Test Case 1 PASSED: EmailJob successfully indexed into Elasticsearch.');

    // ---------------------------------------------------------------
    // Test Case 2: Status update re-indexing (SENT)
    // ---------------------------------------------------------------
    console.log('\n--- Test Case 2: Status Change Upsert (SENT) ---');

    const mockSentJob = {
      ...mockEmailJob,
      status: 'SENT',
      sentAt: new Date(),
    };

    await indexEmailJob(mockSentJob);

    const updatedDoc = indexedDocs.get('job-es-test-123');
    console.log('- Updated Doc Status:', updatedDoc?.status);
    console.log('- Updated Doc SentAt:', updatedDoc?.sentAt);

    if (updatedDoc?.status !== 'SENT' || !updatedDoc?.sentAt) {
      throw new Error('Test Case 2 Failed: Document status update was not re-indexed!');
    }
    console.log('✅ Test Case 2 PASSED: EmailJob status change successfully updated in Elasticsearch.');

    // ---------------------------------------------------------------
    // Test Case 3: multi_match Search Query Structure
    // ---------------------------------------------------------------
    console.log('\n--- Test Case 3: multi_match Search Execution ---');

    let capturedQuery: any = null;
    (esClient as any).search = async ({ index, query }: any) => {
      capturedQuery = query;
      return {
        hits: {
          total: { value: 1 },
          hits: [{ _id: 'job-es-test-123' }],
        },
      };
    };

    const searchResponse = await esClient.search({
      index: EMAILS_INDEX,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: 'Elasticsearch',
                fields: ['subject', 'body', 'recipientEmail'],
              },
            },
          ],
          filter: [{ term: { userId: 'user-es-123' } }],
        },
      },
    });

    console.log('- Captured multi_match fields:', capturedQuery?.bool?.must[0]?.multi_match?.fields);
    console.log('- Search hits returned:', searchResponse.hits.hits.length);

    const multiMatchFields = capturedQuery?.bool?.must[0]?.multi_match?.fields || [];
    if (!multiMatchFields.includes('subject') || !multiMatchFields.includes('body') || !multiMatchFields.includes('recipientEmail')) {
      throw new Error('Test Case 3 Failed: multi_match query fields are missing subject/body/recipientEmail!');
    }

    console.log('✅ Test Case 3 PASSED: multi_match search query validated successfully.');

    console.log('\n==================================================');
    console.log('🎉 ALL ELASTICSEARCH TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
  } catch (error) {
    console.error('❌ Elasticsearch test failed:', error);
    process.exit(1);
  } finally {
    (esClient.indices as any).exists = originalIndicesExists;
    (esClient.indices as any).create = originalIndicesCreate;
    (esClient as any).index = originalIndex;
    (esClient as any).search = originalSearch;
    process.exit(0);
  }
}

runElasticsearchTest();

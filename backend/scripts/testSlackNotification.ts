import prisma from '../src/lib/prisma';
import { notifySlackRateLimitHit } from '../src/lib/slack';

async function runSlackNotificationTest() {
  console.log('🧪 Starting Slack Rate Limit Notification Test...');

  const originalFetch = global.fetch;
  const originalFindUnique = prisma.sender.findUnique;
  const originalFindFirst = prisma.slackIntegration.findFirst;

  try {
    // ---------------------------------------------------------------
    // Test Case 1: Sender's user has NO SlackIntegration configured
    // ---------------------------------------------------------------
    console.log('\n--- Test Case 1: User WITHOUT Slack Integration ---');
    const senderWithoutSlackId = 'sender-no-slack-123';
    const userWithoutSlackId = 'user-no-slack-123';

    // Mock Prisma lookups for DB calls
    (prisma.sender as any).findUnique = async ({ where }: any) => {
      if (where.id === senderWithoutSlackId) {
        return {
          id: senderWithoutSlackId,
          userId: userWithoutSlackId,
          name: 'Sender Without Slack',
          fromEmail: 'noslack@example.com',
          createdAt: new Date(),
        };
      }
      return null;
    };

    (prisma.slackIntegration as any).findFirst = async ({ where }: any) => {
      if (where.userId === userWithoutSlackId) {
        return null; // No SlackIntegration row
      }
      return null;
    };

    // Mock fetch to track if any call is made
    let fetchCalled = false;
    global.fetch = (async (url: any, options: any) => {
      fetchCalled = true;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as any;

    // Call notifySlackRateLimitHit
    await notifySlackRateLimitHit(senderWithoutSlackId, 5, 3);

    console.log(`- Fetch called: ${fetchCalled} (Expected: false)`);
    if (fetchCalled) {
      throw new Error('Test Case 1 Failed: fetch should NOT be called when no SlackIntegration exists!');
    }
    console.log('✅ Test Case 1 PASSED: Completed silently without errors when no Slack integration exists.');

    // ---------------------------------------------------------------
    // Test Case 2: Sender's user HAS SlackIntegration configured
    // ---------------------------------------------------------------
    console.log('\n--- Test Case 2: User WITH Slack Integration ---');
    const senderWithSlackId = 'sender-with-slack-456';
    const userWithSlackId = 'user-with-slack-456';
    const mockWebhookUrl = 'https://hooks.slack.com/services/MOCK/TEST/WEBHOOK123';

    (prisma.sender as any).findUnique = async ({ where }: any) => {
      if (where.id === senderWithSlackId) {
        return {
          id: senderWithSlackId,
          userId: userWithSlackId,
          name: 'Sender With Slack',
          fromEmail: 'withslack@example.com',
          createdAt: new Date(),
        };
      }
      return null;
    };

    (prisma.slackIntegration as any).findFirst = async ({ where }: any) => {
      if (where.userId === userWithSlackId) {
        return {
          id: 'slack-integration-id-123',
          userId: userWithSlackId,
          teamId: 'T12345678',
          accessToken: 'xoxb-mock-access-token',
          incomingWebhookUrl: mockWebhookUrl,
          channelId: 'C12345678',
          connectedAt: new Date(),
        };
      }
      return null;
    };

    let capturedUrl = '';
    let capturedOptions: any = null;
    fetchCalled = false;

    global.fetch = (async (url: any, options: any) => {
      fetchCalled = true;
      capturedUrl = url.toString();
      capturedOptions = options;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as any;

    // Call notifySlackRateLimitHit
    await notifySlackRateLimitHit(senderWithSlackId, 10, 5);

    console.log(`- Fetch called: ${fetchCalled} (Expected: true)`);
    console.log(`- Captured URL: ${capturedUrl}`);
    console.log(`- Captured Method: ${capturedOptions?.method}`);

    const payloadBody = JSON.parse(capturedOptions?.body || '{}');
    console.log(`- Captured Payload Text: ${payloadBody.text}`);

    if (!fetchCalled) {
      throw new Error('Test Case 2 Failed: fetch SHOULD be called when SlackIntegration exists!');
    }

    if (capturedUrl !== mockWebhookUrl) {
      throw new Error(`Test Case 2 Failed: Expected webhook URL ${mockWebhookUrl}, got ${capturedUrl}`);
    }

    if (!payloadBody.text || !payloadBody.text.includes(senderWithSlackId)) {
      throw new Error('Test Case 2 Failed: Payload text does not contain senderId');
    }

    console.log('✅ Test Case 2 PASSED: Successfully sent webhook POST payload to Slack webhook URL.');

    console.log('\n==================================================');
    console.log('🎉 ALL SLACK NOTIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
  } catch (error) {
    console.error('❌ Slack notification test failed:', error);
    process.exit(1);
  } finally {
    global.fetch = originalFetch;
    (prisma.sender as any).findUnique = originalFindUnique;
    (prisma.slackIntegration as any).findFirst = originalFindFirst;
    process.exit(0);
  }
}

runSlackNotificationTest();

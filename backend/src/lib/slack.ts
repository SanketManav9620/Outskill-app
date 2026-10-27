import prisma from './prisma';

/**
 * ============================================================================
 * SLACK NOTIFICATION SERVICE (lib/slack.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Provides helper functions to send real-time notifications to team Slack channels.
 * - Formats markdown alert blocks when a sender hits their hourly dispatch limit.
 * 
 * FAULT-TOLERANT DESIGN PRINCIPLE (CRITICAL FOR INTERVIEWS):
 * Outgoing webhook notifications are "best-effort" secondary side effects.
 * If Slack is down, or if the user hasn't configured a webhook yet, this function
 * MUST NOT throw an unhandled exception or crash the BullMQ worker.
 * All errors are caught and logged silently so core email processing continues uninterrupted.
 */

/**
 * notifySlackRateLimitHit()
 * 
 * TASK / PURPOSE:
 * Posts an alert message to Slack when a sender exceeds MAX_EMAILS_PER_HOUR_PER_SENDER.
 * 
 * WHEN REQUEST REACHES HERE:
 * Called inside `worker.ts` when Redis `INCR` returns a count greater than the hourly threshold.
 * 
 * HOW IT GENERATES RESPONSE:
 * 1. Queries PostgreSQL for the Sender to obtain their associated userId.
 * 2. Queries PostgreSQL directly for a fresh `SlackIntegration` record (no in-memory cache).
 * 3. If no incoming webhook is found, returns silently.
 * 4. Dispatches an HTTP POST request to the webhook URL with formatted Slack mrkdwn text.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Control returns to `worker.ts`, which continues to postpone the job via `moveToDelayed`.
 */
export async function notifySlackRateLimitHit(
  senderId: string,
  sentCount: number,
  limit: number
): Promise<void> {
  try {
    // 1. Fetch sender to resolve associated userId
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      return;
    }

    // 2. Fresh query against PostgreSQL for SlackIntegration (guarantees latest webhook URL)
    const slack = await prisma.slackIntegration.findFirst({
      where: { userId: sender.userId },
    });

    if (!slack || !slack.incomingWebhookUrl) {
      return;
    }

    // 3. Dispatch POST request to stored incoming webhook URL
    await fetch(slack.incomingWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `⚠️ *Hourly Rate Limit Exceeded*\n• *Sender ID*: \`${senderId}\` (${sender.name})\n• *Usage*: \`${sentCount}/${limit}\` emails sent this hour\n• *Action*: Remaining jobs postponed to next hour window.`,
      }),
    });

    console.log(`💬 Dispatched Slack rate-limit webhook notification for sender ${senderId}`);
  } catch (error) {
    // Handled silently so missing integration or network errors never crash worker execution
    console.error(`⚠️ Slack notification for sender ${senderId} completed with error (handled silently):`, error);
  }
}


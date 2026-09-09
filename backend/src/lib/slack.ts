import prisma from './prisma';

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

    // 2. Fresh query against PostgreSQL for SlackIntegration (no in-memory caching)
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

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { env } from '../env';
import prisma from '../lib/prisma';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: {
    id: string;
    name?: string;
  };
  incoming_webhook?: {
    url?: string;
    channel?: string;
    channel_id?: string;
    configuration_url?: string;
  };
}

// GET /auth/slack/start
router.get(
  '/auth/slack/start',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/slack/callback`;
    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=incoming-webhook&redirect_uri=${encodeURIComponent(redirectUri)}`;

    res.redirect(slackAuthUrl);
  })
);

// GET /auth/slack/callback
router.get(
  '/auth/slack/callback',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const code = req.query.code as string;
    if (!code) {
      throw new AppError('Authorization code missing', 400, 'BAD_REQUEST');
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/auth/slack/callback`;

    // Exchange code via Slack oauth.v2.access endpoint
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = (await response.json()) as SlackOAuthResponse;

    if (!data.ok) {
      throw new AppError(data.error || 'Failed to exchange Slack OAuth code', 400, 'SLACK_OAUTH_ERROR');
    }

    const userId = req.user!.id;
    const teamId = data.team?.id || 'unknown';
    const accessToken = data.access_token || '';
    const incomingWebhookUrl = data.incoming_webhook?.url || null;
    const channelId = data.incoming_webhook?.channel_id || null;

    // Check if SlackIntegration row already exists for user
    const existing = await prisma.slackIntegration.findFirst({
      where: { userId },
    });

    let slackIntegration;
    if (existing) {
      slackIntegration = await prisma.slackIntegration.update({
        where: { id: existing.id },
        data: {
          teamId,
          accessToken,
          incomingWebhookUrl,
          channelId,
          connectedAt: new Date(),
        },
      });
    } else {
      slackIntegration = await prisma.slackIntegration.create({
        data: {
          userId,
          teamId,
          accessToken,
          incomingWebhookUrl,
          channelId,
          connectedAt: new Date(),
        },
      });
    }

    res.json({
      message: 'Slack integration connected successfully',
      data: {
        id: slackIntegration.id,
        teamId: slackIntegration.teamId,
        incomingWebhookUrl: slackIntegration.incomingWebhookUrl,
        connectedAt: slackIntegration.connectedAt,
      },
    });
  })
);

// GET /api/slack/status
router.get(
  '/api/slack/status',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const integration = await prisma.slackIntegration.findFirst({
      where: { userId },
    });

    const teamId = integration?.teamId || null;
    const teamName = teamId ? `Workspace (${teamId})` : null;

    res.json({
      connected: !!integration,
      teamId,
      teamName,
      channelId: integration?.channelId || null,
      connectedAt: integration?.connectedAt || null,
    });
  })
);

export default router;


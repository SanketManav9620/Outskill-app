import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { env } from '../env';
import prisma from '../lib/prisma';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * ============================================================================
 * SLACK OAUTH V2 & INTEGRATION CONTROLLER (routes/slack.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Implements the 3-legged Slack OAuth v2 dance.
 * - Saves incoming webhook credentials and channel targets to PostgreSQL.
 * - Allows the frontend dashboard to check whether Slack alerting is active.
 * 
 * THE 3-LEGGED OAUTH DANCE (INTERVIEW EXPLANATION):
 * 1. Step 1 (Initiation): User clicks "Connect Slack". Frontend redirects to
 *    GET /auth/slack/start. The server redirects the browser to Slack's authorize page.
 * 2. Step 2 (User Authorization): User selects their Slack workspace and channel,
 *    and clicks "Allow". Slack redirects back to GET /auth/slack/callback with a short-lived ?code=...
 * 3. Step 3 (Token Exchange): Server sends POST to Slack's oauth.v2.access endpoint
 *    with client_id, client_secret, and code. Slack responds with access_token and incoming_webhook.url.
 *    Server stores these in the SlackIntegration database table.
 */

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

/**
 * GET /auth/slack/start
 * 
 * TASK / PURPOSE:
 * Initiates the Slack OAuth v2 authorization flow.
 * 
 * WHEN REQUEST REACHES HERE:
 * When the user clicks the "Connect Slack" button on the dashboard.
 * 
 * HOW IT GENERATES RESPONSE:
 * Builds the Slack authorization URL including client_id, requested scope ('incoming-webhook'),
 * and the callback redirect URI. Sends an HTTP 302 Redirect to the browser.
 * 
 * WHERE CONTROL MOVES NEXT:
 * The user's browser navigates to Slack's OAuth authorization consent screen.
 */
router.get(
  '/auth/slack/start',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/slack/callback`;
    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=incoming-webhook&redirect_uri=${encodeURIComponent(redirectUri)}`;

    res.redirect(slackAuthUrl);
  })
);

/**
 * GET /auth/slack/callback
 * 
 * TASK / PURPOSE:
 * Handles the OAuth v2 callback from Slack, exchanges the temporary auth code
 * for a permanent incoming webhook URL, and persists it in PostgreSQL.
 * 
 * WHEN REQUEST REACHES HERE:
 * Slack redirects the user's browser back to this URL after the user approves permissions.
 * 
 * HOW IT GENERATES RESPONSE:
 * 1. Extracts the temporary `code` from req.query.
 * 2. Issues an HTTP POST request to `https://slack.com/api/oauth.v2.access`.
 * 3. Validates Slack's JSON response (throws AppError if not ok).
 * 4. Extracts team ID, access token, incoming webhook URL, and channel ID.
 * 5. Upserts a `SlackIntegration` record for the authenticated user in PostgreSQL.
 * 6. Returns a JSON success payload with connection details.
 * 
 * WHERE CONTROL MOVES NEXT:
 * The frontend receives the success response and updates the UI badge to "Slack connected".
 */
router.get(
  '/auth/slack/callback',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const code = req.query.code as string;
    if (!code) {
      throw new AppError('Authorization code missing', 400, 'BAD_REQUEST');
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/auth/slack/callback`;

    // Exchange temporary authorization code with Slack's OAuth API
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

    // Check if user already has an existing Slack integration record
    const existing = await prisma.slackIntegration.findFirst({
      where: { userId },
    });

    let slackIntegration;
    if (existing) {
      // Update existing integration with fresh webhook URL and tokens
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
      // Create new integration record linked to the user
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

/**
 * GET /api/slack/status
 * 
 * TASK / PURPOSE:
 * Checks whether the authenticated user has an active Slack integration connected.
 * 
 * WHEN REQUEST REACHES HERE:
 * Polled by the frontend DashboardLayout on mount to render the "Slack connected" badge.
 * 
 * HOW IT GENERATES RESPONSE:
 * Queries PostgreSQL for a SlackIntegration row matching req.user.id.
 * Returns JSON `{ connected: boolean, teamId, teamName, channelId, connectedAt }`.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Sent to client; DashboardLayout sets its local `slackConnected` state.
 */
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



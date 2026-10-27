import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './env';
import { authMiddleware } from './middleware/auth';
import { basicAuthMiddleware } from './middleware/basicAuth';
import emailRouter from './routes/email';
import slackRouter from './routes/slack';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './lib/queue';
import { ensureEmailsIndex } from './lib/elasticsearch';
import { errorHandler } from './middleware/errorHandler';
// Import standalone BullMQ worker so jobs are processed and emails are delivered
import './worker';

/**
 * ============================================================================
 * EXPRESS BACKEND APPLICATION ENTRYPOINT (index.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Bootstraps the Express HTTP REST API server.
 * - Configures global middlewares (CORS cross-origin access, JSON body parsing).
 * - Mounts the Bull Board live administrative queue UI at /admin/queues.
 * - Mounts health check endpoints for container orchestrators (e.g. Kubernetes, Docker).
 * - Mounts authenticated business routes: /api/emails and Slack OAuth endpoints.
 * - Connects the centralized error-handling middleware.
 * - Initializes the Elasticsearch index on server startup.
 * 
 * REQUEST LIFECYCLE IN EXPRESS:
 * 1. HTTP Request arrives from client (e.g., Browser or Postman) at port 5000.
 * 2. cors() evaluates whether client origin is permitted.
 * 3. express.json() parses incoming JSON body into req.body.
 * 4. Specific route matcher matches URL pattern (e.g. /api/emails).
 * 5. Route-level middleware (e.g., authMiddleware) validates and injects user context.
 * 6. Route handler executes controller logic, DB queries, and queue pushes.
 * 7. res.json() sends structured response back to client.
 * 8. If any exception is thrown, control jumps directly to errorHandler middleware.
 */

const app = express();

// Enable Cross-Origin Resource Sharing so Next.js frontend (port 3000) can make API calls
app.use(cors());

// Parse incoming HTTP request payloads with Content-Type: application/json into JavaScript objects (req.body)
app.use(express.json());

/**
 * ============================================================================
 * BULL BOARD ADMINISTRATIVE DASHBOARD SETUP
 * ============================================================================
 * WHAT THIS DOES:
 * Bull Board provides a real-time web UI to monitor Redis queue jobs:
 * active, waiting, delayed, completed, and failed.
 * 
 * CONTROL FLOW:
 * 1. ExpressAdapter creates the router for the Bull Board web pages.
 * 2. BullMQAdapter connects BullMQ's "email-send" queue into the board.
 * 3. The router is mounted at '/admin/queues'.
 * 4. basicAuthMiddleware intercepts requests and demands HTTP Basic Auth credentials.
 */
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

// Mount Bull Board UI at /admin/queues protected with HTTP Basic Auth
app.use('/admin/queues', basicAuthMiddleware, serverAdapter.getRouter());

/**
 * GET /
 * 
 * TASK / PURPOSE:
 * Root informational endpoint. Confirms that the API is reachable and returns
 * service metadata and the admin dashboard URL.
 * 
 * WHEN REQUEST REACHES HERE:
 * When a user or health monitor accesses http://localhost:5000/
 * 
 * HOW IT GENERATES RESPONSE:
 * Returns an HTTP 200 JSON object containing service status and links.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Response is sent back over HTTP; TCP connection finishes.
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Monorepo Express Backend Service',
    status: 'online',
    timestamp: new Date().toISOString(),
    adminDashboard: 'http://localhost:5000/admin/queues',
  });
});

/**
 * GET /healthz
 * 
 * TASK / PURPOSE:
 * Kubernetes/Docker liveness probe endpoint. Fast and lightweight check.
 * 
 * WHEN REQUEST REACHES HERE:
 * Polled periodically by container orchestration or uptime monitors.
 * 
 * HOW IT GENERATES RESPONSE:
 * Immediately returns HTTP 200 with status: "ok" and timestamp.
 * 
 * WHERE CONTROL MOVES NEXT:
 * HTTP connection closes immediately.
 */
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health
 * 
 * TASK / PURPOSE:
 * Deep health and environment inspection endpoint.
 * 
 * WHEN REQUEST REACHES HERE:
 * Called to verify system configuration, worker concurrency, and rate limit settings.
 * 
 * HOW IT GENERATES RESPONSE:
 * Serializes current runtime environment flags into a JSON response.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Response sent to caller.
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    environment: env.NODE_ENV,
    workerConcurrency: env.WORKER_CONCURRENCY,
    minDelayMs: env.MIN_DELAY_MS,
    maxEmailsPerHour: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
  });
});

/**
 * MOUNTING CORE BUSINESS ROUTERS:
 * 
 * 1. /api/emails:
 *    Protected by authMiddleware. Every request checks authentication, attaches
 *    req.user, and routes to email endpoints (create, batch schedule, search, list).
 * 
 * 2. / (Slack Router):
 *    Routes /auth/slack/start, /auth/slack/callback, and /api/slack/status for OAuth v2.
 */
app.use('/api/emails', authMiddleware, emailRouter);
app.use('/', slackRouter);

/**
 * CENTRALIZED ERROR HANDLER:
 * Placed AFTER all routes so that any error passed via next(err) or caught by
 * asyncHandler bubbles down here to return a uniform JSON error response.
 */
app.use(errorHandler);

/**
 * SERVER STARTUP:
 * Binds the Express app to the specified TCP port and starts listening for HTTP connections.
 * Once listening, triggers ensureEmailsIndex() to verify Elasticsearch mappings exist.
 */
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
  console.log(`📊 Bull Board Admin Dashboard: http://localhost:${PORT}/admin/queues`);
  ensureEmailsIndex();
});



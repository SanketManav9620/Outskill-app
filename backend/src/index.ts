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

const app = express();

app.use(cors());
app.use(express.json());

// Setup Bull Board live administrative dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

// Mount Bull Board UI at /admin/queues protected with Basic Auth
app.use('/admin/queues', basicAuthMiddleware, serverAdapter.getRouter());

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Monorepo Express Backend Service',
    status: 'online',
    timestamp: new Date().toISOString(),
    adminDashboard: 'http://localhost:5000/admin/queues',
  });
});

// Health endpoints
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    environment: env.NODE_ENV,
    workerConcurrency: env.WORKER_CONCURRENCY,
    minDelayMs: env.MIN_DELAY_MS,
    maxEmailsPerHour: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
  });
});

// Email API Routes with auth middleware
app.use('/api/emails', authMiddleware, emailRouter);

// Slack OAuth & Status Routes
app.use('/', slackRouter);

// Centralized Express error handler middleware
app.use(errorHandler);

const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
  console.log(`📊 Bull Board Admin Dashboard: http://localhost:${PORT}/admin/queues`);
  ensureEmailsIndex();
});


import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../env';

// BullMQ requires maxRetriesPerRequest to be null on the ioredis instance
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Single queue named "email-send" with default job attempts & exponential backoff
export const emailQueue = new Queue('email-send', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

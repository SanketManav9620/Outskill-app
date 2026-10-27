import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../env';

/**
 * ============================================================================
 * REDIS & BULLMQ QUEUE CONFIGURATION (lib/queue.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Creates the shared ioredis connection client for Redis operations.
 * - Instantiates the BullMQ Queue named "email-send".
 * - Configures global default job retry options and exponential backoff delays.
 * 
 * CRITICAL INTERVIEW CONCEPTS:
 * 1. maxRetriesPerRequest: null
 *    BullMQ requires that maxRetriesPerRequest is set to NULL on the Redis connection.
 *    Why? BullMQ uses blocking Redis commands (like BRPOPLPUSH/BLPOP) to wait for jobs.
 *    If ioredis attempts automatic request retries, it would break BullMQ's command queues.
 * 
 * 2. Exponential Backoff:
 *    If an email delivery attempt fails (e.g. transient SMTP timeout or network blip),
 *    BullMQ delays the retry exponentially:
 *    - Attempt 1: immediate
 *    - Attempt 2: 1000ms * 2^0 = 1000ms (1 second)
 *    - Attempt 3: 1000ms * 2^1 = 2000ms (2 seconds)
 *    This avoids hammering failing services.
 */

// Shared Redis client connection
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err.message);
});

// Primary email dispatch queue
export const emailQueue = new Queue('email-send', {
  connection: redisConnection,
  defaultJobOptions: {
    // Number of retry attempts before a job is declared permanently failed
    attempts: 3,
    // Exponential backoff strategy
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    // Keep finished jobs clean; remove completed jobs immediately or keep last N
    removeOnComplete: false,
    removeOnFail: false,
  },
});

emailQueue.on('error', (err) => {
  console.error('❌ BullMQ Queue Error:', err.message);
});


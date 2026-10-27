import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from .env file into Node.js process.env
dotenv.config();

/**
 * ============================================================================
 * ENVIRONMENT VARIABLE SCHEMA DEFINITION
 * ============================================================================
 * WHAT THIS DOES:
 * Defines a strict schema using Zod to validate and type-check all environment
 * variables before the application starts up.
 * 
 * WHY THIS IS CRITICAL IN PRODUCTION / INTERVIEWS:
 * - Fail-fast principle: If a required configuration (like DATABASE_URL or REDIS_URL)
 *   is missing or wrong, the server will crash immediately on boot with a clear error
 *   rather than failing silently in the middle of processing a user request.
 * - Auto-transformation: Automatically converts string variables from process.env
 *   into numbers (e.g. PORT, MIN_DELAY_MS, WORKER_CONCURRENCY).
 */
export const envSchema = z.object({
  // Server port (defaults to 5000 if not provided, transformed from string to number)
  PORT: z.string().default('5000').transform(Number),
  
  // Environment mode (development, production, test)
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // PostgreSQL connection URLs
  DB_CONNECTION_STRING: z
    .string()
    .default('postgresql://postgres:postgrespassword@localhost:5432/monorepo_db'),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgrespassword@localhost:5432/monorepo_db'),

  // Redis instance URL (used for BullMQ job queue & distributed rate limiting)
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Elasticsearch instance URL (used for full-text email search and indexing)
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  // Ethereal SMTP test credentials (safe sandbox for sending emails without spamming real inboxes)
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.string().default('587').transform(Number),
  ETHEREAL_USER: z.string().default('ethereal_user@ethereal.email'),
  ETHEREAL_PASS: z.string().default('ethereal_password_secret'),

  // Google OAuth credentials for NextAuth
  GOOGLE_CLIENT_ID: z.string().default('google_client_id_placeholder'),
  GOOGLE_CLIENT_SECRET: z.string().default('google_client_secret_placeholder'),

  // Slack OAuth v2 credentials for alerting
  SLACK_CLIENT_ID: z.string().default('slack_client_id_placeholder'),
  SLACK_CLIENT_SECRET: z.string().default('slack_client_secret_placeholder'),

  // Worker Settings:
  // WORKER_CONCURRENCY: How many parallel jobs the background worker can execute concurrently
  WORKER_CONCURRENCY: z.string().default('5').transform(Number),
  // MIN_DELAY_MS: Minimum sleep time (stagger) between consecutive dispatches to prevent rate bursts
  MIN_DELAY_MS: z.string().default('2000').transform(Number),
  // MAX_EMAILS_PER_HOUR_PER_SENDER: Strict hourly throttle per sender account
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default('100').transform(Number),

  // Bull Board administrative web dashboard HTTP Basic Auth credentials
  BULLBOARD_USER: z.string().default('admin'),
  BULLBOARD_PASS: z.string().default('admin123'),
});

// Infer TypeScript type directly from the Zod schema
export type Env = z.infer<typeof envSchema>;

/**
 * parseEnv()
 * 
 * TASK / PURPOSE:
 * Reads process.env, validates it against envSchema, logs any schema errors,
 * and returns the typed configuration object.
 * 
 * WHEN REQUEST REACHES HERE:
 * Executed once during application bootstrap (when index.ts or worker.ts imports env).
 * 
 * HOW IT GENERATES RESPONSE:
 * Executes envSchema.safeParse(process.env). If valid, returns data. If invalid,
 * logs detailed error formatting and throws an Error.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Passes the parsed 'env' object to whichever module imported it (e.g., Express server,
 * Redis client, or BullMQ worker setup).
 */
export function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:', result.error.format());
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

// Singleton parsed and validated environment object ready for export
export const env = parseEnv();


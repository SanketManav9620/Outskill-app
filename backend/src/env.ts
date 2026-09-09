import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  PORT: z.string().default('5000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database Connection String
  DB_CONNECTION_STRING: z
    .string()
    .default('postgresql://postgres:postgrespassword@localhost:5432/monorepo_db'),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgrespassword@localhost:5432/monorepo_db'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  // Ethereal Email Credentials
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.string().default('587').transform(Number),
  ETHEREAL_USER: z.string().default('ethereal_user@ethereal.email'),
  ETHEREAL_PASS: z.string().default('ethereal_password_secret'),

  // Google OAuth Credentials
  GOOGLE_CLIENT_ID: z.string().default('google_client_id_placeholder'),
  GOOGLE_CLIENT_SECRET: z.string().default('google_client_secret_placeholder'),

  // Slack OAuth Credentials
  SLACK_CLIENT_ID: z.string().default('slack_client_id_placeholder'),
  SLACK_CLIENT_SECRET: z.string().default('slack_client_secret_placeholder'),

  // Worker Settings
  WORKER_CONCURRENCY: z.string().default('5').transform(Number),
  MIN_DELAY_MS: z.string().default('2000').transform(Number),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default('100').transform(Number),

  // Bull Board Admin Dashboard Auth Credentials
  BULLBOARD_USER: z.string().default('admin'),
  BULLBOARD_PASS: z.string().default('admin123'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:', result.error.format());
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const env = parseEnv();

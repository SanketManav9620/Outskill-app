import { PrismaClient } from '@prisma/client';

/**
 * ============================================================================
 * PRISMA ORM CLIENT SINGLETON (lib/prisma.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Creates and exports a single, shared PrismaClient database connection instance.
 * - Attaches logging for SQL queries, errors, and warnings in development mode.
 * 
 * WHY IS THIS SINGLETON PATTERN CRITICAL? (INTERVIEW FAVORITE):
 * In Node.js development environments, tools like ts-node-dev or Next.js trigger
 * hot code reloads whenever a file changes. If we called `new PrismaClient()` directly
 * every time, each reload would open a new pool of database connections to PostgreSQL.
 * Eventually, PostgreSQL would run out of available connection slots ("Too many clients already").
 * 
 * By assigning the client to `globalThis.prisma`, we preserve the single existing connection pool
 * across code reloads without opening redundant connections.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;


import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

/**
 * ============================================================================
 * AUTHENTICATION MIDDLEWARE (middleware/auth.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Extends the Express `Request` type to include authenticated user details (`req.user`).
 * - Extracts user identity from incoming request headers (`x-user-id`).
 * - Automatically upserts the user in PostgreSQL so foreign key relationships are valid.
 * - Passes control to downstream route handlers with guaranteed user context.
 * 
 * ROLE IN INTERVIEW / MONOREPO ARCHITECTURE:
 * In a decoupled monorepo where Next.js authenticates via Google OAuth and calls
 * Express over REST, passing an authenticated identifier (e.g. JWT or user header)
 * ensures multitenancy: users can only view and schedule their own emails and senders.
 */

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * authMiddleware()
 * 
 * TASK / PURPOSE:
 * Intercepts incoming requests to protected routes, resolves the user,
 * ensures the user exists in the database, and attaches `req.user`.
 * 
 * WHEN REQUEST REACHES HERE:
 * Executed as the first middleware on protected routes (such as `/api/emails/*` and `/auth/slack/*`).
 * 
 * HOW IT WORKS (STEP-BY-STEP):
 * 1. Checks for `x-user-id` in request headers. Defaults to 'test-user-id-123' if absent.
 * 2. Uses Prisma `upsert` to guarantee this user row exists in the PostgreSQL `User` table.
 *    (This prevents PostgreSQL Foreign Key Constraint violations when creating senders or jobs).
 * 3. Populates `req.user = { id: user.id, email: user.email }`.
 * 4. Invokes `next()` to move execution to the route handler.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Calls `next()`, transferring execution to the route controller (e.g. email or slack router).
 * If an error occurs, responds with HTTP 500.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Read test user ID from header 'x-user-id' or default to stub test user
    const headerUserId = req.headers['x-user-id'];
    const userId = typeof headerUserId === 'string' && headerUserId.trim() !== ''
      ? headerUserId.trim()
      : 'test-user-id-123';

    // 2. Ensure the stub/test user exists in Postgres DB to avoid FK constraint errors
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@example.com`,
        name: `Test User (${userId})`,
      },
    });

    // 3. Attach user context to the request object for downstream controllers
    req.user = {
      id: user.id,
      email: user.email,
    };

    // 4. Pass execution to the next middleware or route handler in the chain
    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Failed to authenticate stub user',
      details: error?.message || String(error),
    });
  }
}


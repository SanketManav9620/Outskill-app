import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Read test user ID from header 'x-user-id' or default to stub test user
    const headerUserId = req.headers['x-user-id'];
    const userId = typeof headerUserId === 'string' && headerUserId.trim() !== ''
      ? headerUserId.trim()
      : 'test-user-id-123';

    // Ensure the stub/test user exists in Postgres DB to avoid FK constraint errors
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@example.com`,
        name: `Test User (${userId})`,
      },
    });

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Failed to authenticate stub user' });
  }
}

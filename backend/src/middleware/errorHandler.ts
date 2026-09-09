import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Express wrapper for async route handlers to catch unhandled promise rejections
 * and pass them to the centralized error-handling middleware.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Centralized Express Error-Handling Middleware
 * Formats all errors as { error: { message, code } }
 */
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('❌ Centralized Error Middleware caught error:', err);

  const statusCode =
    err.statusCode && typeof err.statusCode === 'number'
      ? err.statusCode
      : err.status && typeof err.status === 'number'
      ? err.status
      : 500;

  const message = err.message || 'An unexpected internal server error occurred';

  let code = err.code;
  if (!code) {
    if (statusCode === 400) code = 'BAD_REQUEST';
    else if (statusCode === 401) code = 'UNAUTHORIZED';
    else if (statusCode === 403) code = 'FORBIDDEN';
    else if (statusCode === 404) code = 'NOT_FOUND';
    else code = 'INTERNAL_SERVER_ERROR';
  }

  res.status(statusCode).json({
    error: {
      message,
      code,
    },
  });
}

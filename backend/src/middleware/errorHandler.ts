import { Request, Response, NextFunction } from 'express';

/**
 * ============================================================================
 * CENTRALIZED ERROR HANDLING SYSTEM (middleware/errorHandler.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Provides a custom application error class (`AppError`) with status codes.
 * - Provides an `asyncHandler` wrapper to catch unhandled async Promise rejections.
 * - Provides the terminal 4-parameter Express error handler middleware.
 * 
 * WHY IS THIS CRITICAL IN PRODUCTION / INTERVIEWS?
 * 1. Express 4 does not automatically catch unhandled rejected Promises in async handlers.
 *    Without `asyncHandler` or `try/catch`, an uncaught rejection will cause the request
 *    to hang indefinitely or crash the process.
 * 2. Uniform API Error Contract: Clients (like Next.js frontend) can rely on a consistent
 *    error shape: `{ error: { message: string, code: string } }` with proper HTTP status codes.
 */

/**
 * AppError Class
 * Custom operational error class that attaches an HTTP status code and an application error code.
 */
export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype); // Restore prototype chain
  }
}

/**
 * asyncHandler()
 * 
 * TASK / PURPOSE:
 * Higher-order function that wraps async Express route handlers.
 * 
 * WHEN REQUEST REACHES HERE:
 * Wraps every async endpoint in `email.ts` and `slack.ts`.
 * 
 * HOW IT WORKS:
 * Executes the passed async handler `fn(req, res, next)`.
 * If the promise resolves, execution proceeds normally.
 * If the promise rejects or an error is thrown, `.catch(next)` catches it
 * and forwards it directly to the Express error-handling pipeline.
 * 
 * WHERE CONTROL MOVES NEXT:
 * In case of an error, jumps directly to `errorHandler`.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * errorHandler()
 * 
 * TASK / PURPOSE:
 * Centralized terminal error handler middleware.
 * 
 * WHEN REQUEST REACHES HERE:
 * Whenever any route or middleware calls `next(err)` or throws an error inside `asyncHandler`.
 * 
 * HOW IT GENERATES RESPONSE:
 * 1. Extracts or defaults the HTTP status code (400, 401, 403, 404, or 500).
 * 2. Determines the machine-readable error code string (e.g. 'VALIDATION_ERROR', 'BAD_REQUEST').
 * 3. Logs the stack trace to console for backend debugging.
 * 4. Responds with JSON `{ error: { message, code } }`.
 * 
 * WHERE CONTROL MOVES NEXT:
 * Sends HTTP error response back to client; request lifecycle terminates.
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


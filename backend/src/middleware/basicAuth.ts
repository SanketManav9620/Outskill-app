import { Request, Response, NextFunction } from 'express';
import { env } from '../env';

/**
 * ============================================================================
 * HTTP BASIC AUTHENTICATION MIDDLEWARE (middleware/basicAuth.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Secures the administrative Bull Board queue dashboard (`/admin/queues`).
 * - Parses and decodes the HTTP `Authorization: Basic <base64>` header.
 * - Verifies credentials against configured environment variables.
 * 
 * HOW HTTP BASIC AUTH WORKS (INTERVIEW CONCEPT):
 * 1. Client attempts to access a protected URL without an Authorization header.
 * 2. Server responds with HTTP 401 Unauthorized and header `WWW-Authenticate: Basic realm="..."`.
 * 3. The browser automatically opens a native login prompt asking for username and password.
 * 4. Browser encodes `username:password` into base64 and resends:
 *    `Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=`.
 * 5. Middleware decodes base64 string and validates credentials.
 */

/**
 * basicAuthMiddleware()
 * 
 * TASK / PURPOSE:
 * Enforces username/password security on Bull Board dashboard endpoints.
 * 
 * WHEN REQUEST REACHES HERE:
 * Whenever any request is made to `/admin/queues` or its static assets.
 * 
 * HOW IT WORKS (STEP-BY-STEP):
 * 1. Checks for presence of `req.headers.authorization` starting with 'Basic '.
 * 2. If absent, responds with HTTP 401 and WWW-Authenticate challenge.
 * 3. Base64-decodes credentials and splits into username and password.
 * 4. Compares with env.BULLBOARD_USER and env.BULLBOARD_PASS.
 * 5. If valid, calls `next()` to render Bull Board. Otherwise returns HTTP 401.
 * 
 * WHERE CONTROL MOVES NEXT:
 * If valid: passes to Bull Board's ExpressAdapter router.
 * If invalid: terminates request with HTTP 401.
 */
export function basicAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // 1. Check if Authorization header is present and uses Basic scheme
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard Admin"');
    res.status(401).send('Authentication required for administrative dashboard');
    return;
  }

  // 2. Decode base64 credentials (format: "username:password")
  const credentialsBase64 = authHeader.split(' ')[1] || '';
  const credentials = Buffer.from(credentialsBase64, 'base64').toString('utf8').split(':');
  const username = credentials[0];
  const password = credentials[1];

  // 3. Expected administrative credentials from validated environment
  const expectedUser = env.BULLBOARD_USER || 'admin';
  const expectedPass = env.BULLBOARD_PASS || 'admin123';

  // 4. Validate credentials
  if (username === expectedUser && password === expectedPass) {
    next(); // Access granted; proceed to Bull Board dashboard
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard Admin"');
    res.status(401).send('Invalid admin credentials');
  }
}


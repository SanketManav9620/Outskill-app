import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * ============================================================================
 * NEXTAUTH DYNAMIC CATCH-ALL API ROUTE (api/auth/[...nextauth]/route.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Implements the dynamic catch-all route handler for NextAuth under App Router.
 * - Handles all OAuth endpoints:
 *     - GET  /api/auth/signin
 *     - GET  /api/auth/callback/google
 *     - GET  /api/auth/session
 *     - POST /api/auth/signout
 *     - GET  /api/auth/csrf
 * 
 * CONTROL FLOW:
 * Incoming HTTP requests are passed to `NextAuth(authOptions)`. NextAuth inspects
 * the sub-path parameters and dispatches the corresponding OAuth or session logic.
 */

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };


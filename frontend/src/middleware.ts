import { withAuth } from 'next-auth/middleware';

/**
 * ============================================================================
 * NEXT.JS EDGE ROUTE PROTECTION MIDDLEWARE (frontend/src/middleware.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Runs on the Edge runtime before requests reach the page rendering layer.
 * - Protects all `/dashboard` routes from unauthorized access.
 * - If a user is not logged in with an active NextAuth session, automatically
 *   redirects them to `/login`.
 * 
 * HOW THE REQUEST FLOWS:
 * 1. User navigates to http://localhost:3000/dashboard.
 * 2. Next.js executes this edge middleware before rendering any React components.
 * 3. NextAuth inspects the session cookie (`next-auth.session-token`).
 * 4. If valid JWT exists -> request proceeds to `dashboard/page.tsx`.
 * 5. If missing or expired -> user is redirected to `/login?callbackUrl=/dashboard`.
 */
export default withAuth({
  pages: {
    signIn: '/login', // Redirect target for unauthenticated users
  },
});

// Configure URL route patterns that trigger this middleware
export const config = {
  matcher: ['/dashboard/:path*', '/dashboard'],
};


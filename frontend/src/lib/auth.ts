import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

/**
 * ============================================================================
 * NEXTAUTH AUTHENTICATION CONFIGURATION (frontend/src/lib/auth.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Configures NextAuth v4 options for the Next.js frontend application.
 * - Sets up Google OAuth 2.0 provider integration.
 * - Configures stateless JWT session cookies.
 * - Customizes session and JWT callbacks so the Google user ID (`sub`)
 *   is cleanly mapped into `session.user.id`.
 * 
 * HOW THE OAUTH FLOW WORKS:
 * 1. User clicks "Sign in with Google" on `/login`.
 * 2. NextAuth redirects user to Google's consent screen.
 * 3. Google returns authorization code to `/api/auth/callback/google`.
 * 4. NextAuth exchanges code for tokens, triggers `jwt()` callback, encrypts
 *    token into an HTTP-only secure cookie, and invokes `session()` callback.
 */

export const authOptions: NextAuthOptions = {
  // OAuth Identity Providers
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],

  // Secret used to sign and encrypt JWT session cookies
  secret: process.env.NEXTAUTH_SECRET || 'outskill_nextauth_secret_key_2026_super_secure',

  // Use stateless encrypted JWT cookies instead of server-side database sessions
  session: {
    strategy: 'jwt',
  },

  // Custom route overrides
  pages: {
    signIn: '/login',
  },

  // Lifecycle Callbacks
  callbacks: {
    /**
     * jwt() callback
     * Called whenever a JSON Web Token is created (on sign in) or updated.
     * Maps the user ID to `token.sub`.
     */
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },

    /**
     * session() callback
     * Called whenever client checks session via `useSession()` or `getSession()`.
     * Exposes `session.user.id` so frontend components can pass it to backend API calls.
     */
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};


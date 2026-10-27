'use client';

import React, { useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight } from 'lucide-react';

/**
 * ============================================================================
 * LOGIN / AUTHENTICATION PAGE (app/login/page.tsx)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Provides the authentication entry point for users.
 * - Integrates with NextAuth's `signIn` client helper to trigger Google OAuth.
 * - Monitors session state with `useSession()`: automatically redirects already-authenticated
 *   users to `/dashboard`.
 * 
 * CONTROL FLOW:
 * 1. User arrives at `/login`.
 * 2. `useEffect` checks session status. If already 'authenticated', routes directly to `/dashboard`.
 * 3. If unauthenticated, user clicks "Sign in with Google".
 * 4. `signIn('google', { callbackUrl: '/dashboard' })` redirects browser to Google OAuth.
 */
export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // If already authenticated, skip login and forward user to dashboard
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  // Trigger Google OAuth 2.0 flow
  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/dashboard' });
  };


  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f8f7fa] px-4 py-12 text-[#23456c]">
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#e2deea] bg-[#ffffff] p-8 shadow-xl">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6e2a7e] text-white shadow-sm">
            <Mail className="h-6 w-6" />
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#23456c]">
            Outskill Mailer
          </h1>
          <p className="mt-1.5 text-xs text-[#627289]">
            Sign in to manage your email scheduling queues and integrations.
          </p>
        </div>

        {/* Action Section */}
        <div className="mt-8 space-y-4">
          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-[#e2deea] bg-[#ffffff] px-5 py-3 text-sm font-semibold text-[#23456c] shadow-sm transition-all duration-200 hover:bg-[#c7bcd3]/20 active:scale-[0.98]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>

            <span>Sign in with Google</span>
            <ArrowRight className="ml-auto h-4 w-4 text-[#627289] transition-all duration-200 group-hover:translate-x-1 group-hover:text-[#23456c]" />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Mail, ShieldCheck, Zap, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      {/* Dynamic Background Glow Gradients */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Login Container Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
            <Mail className="h-7 w-7 text-white" />
          </div>
          
          <div className="mt-4 flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>NextAuth OAuth v2 Authentication</span>
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Welcome to Outskill Mailer
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in with your Google account to access your scheduled campaigns, queue status, and integrations.
          </p>
        </div>

        {/* Action Section */}
        <div className="mt-8 space-y-4">
          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/90 px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:border-slate-500 hover:bg-slate-800 hover:shadow-cyan-500/10 active:scale-[0.98]"
          >
            {/* Google Colorful SVG Icon */}
            <svg className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
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
            <ArrowRight className="ml-auto h-4 w-4 opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100" />
          </button>
        </div>

        {/* Feature Highlights Footer */}
        <div className="mt-8 border-t border-slate-800/80 pt-6">
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              <span>OAuth v2 Protected</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <span>Realtime Queuing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

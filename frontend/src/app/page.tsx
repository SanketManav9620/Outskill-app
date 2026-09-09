import React from 'react';
import Link from 'next/link';
import { Database, Server, Cpu, Search, CheckCircle2, ShieldCheck, Terminal, Layers, ArrowRight, LayoutDashboard, LogIn } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Header Hero */}
        <header className="flex flex-col items-start justify-between gap-6 border-b border-slate-800/80 pb-8 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
              Monorepo Active
            </div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Outskill Mailer Dashboard
            </h1>
            <p className="mt-2 text-lg text-slate-400">
              Express + TS Backend &bull; Next.js 14 NextAuth Frontend &bull; Docker Infrastructure
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:opacity-95"
            >
              <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </Link>
          </div>
        </header>

        {/* Infrastructure Cards */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Postgres Card */}
          <div className="group relative rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur transition hover:border-indigo-500/50 hover:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
                <Database className="h-6 w-6" />
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                Port 5432
              </span>
            </div>
            <h3 className="mt-4 text-xl font-bold text-white">PostgreSQL</h3>
            <p className="mt-2 text-sm text-slate-400">
              Relational DB configured with named volume <code className="text-indigo-300">postgres_data</code>.
            </p>
          </div>

          {/* Redis Card */}
          <div className="group relative rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur transition hover:border-rose-500/50 hover:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-rose-500/10 p-3 text-rose-400">
                <Cpu className="h-6 w-6" />
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                Port 6379
              </span>
            </div>
            <h3 className="mt-4 text-xl font-bold text-white">Redis</h3>
            <p className="mt-2 text-sm text-slate-400">
              In-memory data store configured with named volume <code className="text-rose-300">redis_data</code>.
            </p>
          </div>

          {/* Elasticsearch Card */}
          <div className="group relative rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur transition hover:border-amber-500/50 hover:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-amber-500/10 p-3 text-amber-400">
                <Search className="h-6 w-6" />
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                Port 9200
              </span>
            </div>
            <h3 className="mt-4 text-xl font-bold text-white">Elasticsearch</h3>
            <p className="mt-2 text-sm text-slate-400">
              Single-node instance with security disabled (<code className="text-amber-300">xpack.security.enabled=false</code>).
            </p>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex items-center gap-3">
            <Layers className="h-6 w-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white">Monorepo Features Implemented</h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border border-slate-800/60 bg-slate-950/40 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <h4 className="font-semibold text-white">NextAuth Google Provider</h4>
                <p className="text-sm text-slate-400">OAuth v2 authentication with Next.js App Router API route, NextAuth middleware protection, & session persistence.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-800/60 bg-slate-950/40 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <h4 className="font-semibold text-white">Dashboard Layout Shell</h4>
                <p className="text-sm text-slate-400">Header with user avatar/name/email/logout, tab bar (Scheduled/Sent/Failed), & top-right Compose CTA.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-500">
          Monorepo standard template initialized successfully &bull; Outskill Engineering
        </footer>
      </div>
    </main>
  );
}

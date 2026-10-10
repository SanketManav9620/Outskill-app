import React from 'react';
import Link from 'next/link';
import { Send, Zap, Bell, Clock, LayoutDashboard, LogIn, CheckCircle2 } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f7fa] px-6 py-12 text-[#23456c]">
      <div className="mx-auto max-w-6xl space-y-10">
        
        {/* Header Hero Section */}
        <header className="flex flex-col items-start justify-between gap-6 border-b border-[#e2deea] pb-8 md:flex-row md:items-center">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-[#23456c] sm:text-5xl">
              Outskill Mailer
            </h1>
            <p className="mt-2 text-base text-[#627289]">
              Automated Multi-Sender Email Dispatch & Queue Platform
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-[#6e2a7e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#582165]"
            >
              <LayoutDashboard className="h-4 w-4" /> Open Dashboard
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-[#e2deea] bg-[#ffffff] px-4 py-2.5 text-sm font-medium text-[#23456c] transition hover:bg-[#c7bcd3]/20"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </Link>
          </div>
        </header>

        {/* System Capabilities Section */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1 */}
          <div className="rounded-2xl border border-[#e2deea] bg-[#ffffff] p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6e2a7e]/10 text-[#6e2a7e] mb-4">
                <Send className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[#23456c]">Batch Scheduling Engine</h3>
              <p className="mt-2 text-xs text-[#627289] leading-relaxed">
                Import recipient lists via CSV or TXT, configure custom stagger delays, and schedule multi-sender campaigns.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Multi-Sender Support</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-[#e2deea] bg-[#ffffff] p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5e80c4]/15 text-[#5e80c4] mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[#23456c]">Hourly Rate Limiting</h3>
              <p className="mt-2 text-xs text-[#627289] leading-relaxed">
                Automatically throttles dispatch rates per sender account to prevent spam flags and protect domain health.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-[#5e80c4]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Hourly Caps & Delays</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-[#e2deea] bg-[#ffffff] p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6e2a7e]/10 text-[#6e2a7e] mb-4">
                <Bell className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[#23456c]">Slack Real-Time Webhooks</h3>
              <p className="mt-2 text-xs text-[#627289] leading-relaxed">
                Instant failure notifications delivered to team Slack channels whenever an email job fails to deliver.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-[#6e2a7e]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>OAuth v2 Webhook Alert</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-[#e2deea] bg-[#ffffff] p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5e80c4]/15 text-[#5e80c4] mb-4">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[#23456c]">Queue Tracking & Log Search</h3>
              <p className="mt-2 text-xs text-[#627289] leading-relaxed">
                Track scheduled queues, sent histories, and failure logs with real-time updates and instant search indexing.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Live Queue Sync</span>
            </div>
          </div>

        </section>
      </div>
    </main>
  );
}

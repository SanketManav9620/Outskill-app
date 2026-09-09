'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import {
  Mail,
  LogOut,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  User as UserIcon,
  Slack,
} from 'lucide-react';

export interface DashboardLayoutProps {
  activeTab: 'scheduled' | 'sent' | 'failed';
  onTabChange: (tab: 'scheduled' | 'sent' | 'failed') => void;
  onComposeClick: () => void;
  children: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  slackConnected?: boolean;
  slackTeamName?: string | null;
  onConnectSlack?: () => void;
}

export function DashboardLayout({
  activeTab,
  onTabChange,
  onComposeClick,
  children,
  searchQuery = '',
  onSearchChange,
  slackConnected = false,
  slackTeamName = null,
  onConnectSlack,
}: DashboardLayoutProps) {
  const { data: session } = useSession();

  const user = session?.user || {
    name: 'Logged In User',
    email: 'user@example.com',
    image: null,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">Outskill Mailer</span>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Automated Queue & Slack Dispatcher</p>
            </div>
          </div>

          {/* Right Header: Slack Status & User Profile Shell */}
          <div className="flex items-center gap-4">
            
            {/* Slack Connection Badge & Buttons */}
            {onConnectSlack && (
              <div className="hidden sm:flex items-center gap-2">
                {slackConnected ? (
                  <>
                    <span
                      id="slack-connected-badge"
                      className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400"
                    >
                      <Slack className="h-4 w-4" />
                      <span>Slack connected ({slackTeamName || 'Workspace'})</span>
                    </span>
                    <button
                      id="slack-reconnect-btn"
                      onClick={onConnectSlack}
                      className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-800 transition-all"
                    >
                      Reconnect
                    </button>
                  </>
                ) : (
                  <button
                    id="slack-connect-btn"
                    onClick={onConnectSlack}
                    className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-all"
                  >
                    <Slack className="h-4 w-4" />
                    <span>Connect Slack</span>
                  </button>
                )}
              </div>
            )}


            {/* User Profile Info */}
            <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
              <div className="relative h-9 w-9 overflow-hidden rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || 'User Avatar'}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <UserIcon className="h-5 w-5 text-slate-400" />
                )}
              </div>

              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-white leading-tight">{user.name}</p>
                <p className="text-[11px] text-slate-400 leading-tight">{user.email}</p>
              </div>

              {/* Logout Button */}
              <button
                id="logout-btn"
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Subheader Toolbar Section */}
      <div className="border-b border-slate-800/60 bg-slate-900/30">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          
          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-1.5">
            <button
              id="tab-scheduled"
              onClick={() => onTabChange('scheduled')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                activeTab === 'scheduled'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Scheduled emails</span>
            </button>

            <button
              id="tab-sent"
              onClick={() => onTabChange('sent')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                activeTab === 'sent'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Sent emails</span>
            </button>

            <button
              id="tab-failed"
              onClick={() => onTabChange('failed')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                activeTab === 'failed'
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Failed emails</span>
            </button>
          </div>

          {/* Action Row: Search Input & Primary CTA Button */}
          <div className="flex items-center gap-3">
            {onSearchChange && (
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search emails (Elasticsearch)..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>
            )}

            {/* Primary Compose Button (Top-Right CTA) */}
            <button
              id="compose-email-btn"
              onClick={onComposeClick}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:opacity-95 hover:shadow-cyan-500/40 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Compose new email</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

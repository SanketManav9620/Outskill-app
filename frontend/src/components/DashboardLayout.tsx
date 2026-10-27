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
  User as UserIcon,
  Slack,
} from 'lucide-react';

/**
 * ============================================================================
 * DASHBOARD SHELL LAYOUT COMPONENT (components/DashboardLayout.tsx)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Provides the primary visual chrome (navigation bar, header, search bar, profile).
 * - Manages tab switching between 'scheduled', 'sent', and 'failed' queues.
 * - Displays live Slack workspace connection status with interactive Reconnect button.
 * - Exposes the "Schedule Email Campaign" action button triggering the ComposeModal.
 * 
 * PROPS & INTERFACES:
 * - activeTab: current active tab state.
 * - onTabChange: callback fired when user clicks a navigation tab.
 * - onComposeClick: callback fired when user clicks the "Compose" button.
 * - onSearchChange: callback fired when user types into the search bar.
 * - onConnectSlack: initiates the OAuth flow to link team Slack workspace.
 */

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
    <div className="min-h-screen bg-[#f8f7fa] text-[#23456c] antialiased font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#e2deea] bg-[#ffffff] shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          
          {/* Brand Header */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6e2a7e] text-white shadow-sm">
              <Mail className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#23456c]">Outskill Mailer</span>
          </div>

          {/* Right Header: Slack Integration & User Profile */}
          <div className="flex items-center gap-4">
            
            {onConnectSlack && (
              <div className="hidden sm:flex items-center gap-2">
                {slackConnected ? (
                  <>
                    <span
                      id="slack-connected-badge"
                      className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                    >
                      <Slack className="h-4 w-4 text-emerald-600" />
                      <span>Slack connected ({slackTeamName || 'Workspace'})</span>
                    </span>
                    <button
                      id="slack-reconnect-btn"
                      onClick={onConnectSlack}
                      className="rounded-lg border border-[#e2deea] bg-[#f8f7fa] px-2.5 py-1.5 text-xs font-medium text-[#23456c] hover:bg-[#c7bcd3]/30 transition-all"
                    >
                      Reconnect
                    </button>
                  </>
                ) : (
                  <button
                    id="slack-connect-btn"
                    onClick={onConnectSlack}
                    className="flex items-center gap-2 rounded-lg border border-[#5e80c4]/40 bg-[#5e80c4]/10 px-3 py-1.5 text-xs font-semibold text-[#23456c] hover:bg-[#5e80c4]/20 transition-all"
                  >
                    <Slack className="h-4 w-4 text-[#5e80c4]" />
                    <span>Connect Slack</span>
                  </button>
                )}
              </div>
            )}

            {/* User Profile Info */}
            <div className="flex items-center gap-3 border-l border-[#e2deea] pl-4">
              <div className="relative h-9 w-9 overflow-hidden rounded-full border border-[#e2deea] bg-[#c7bcd3]/30 flex items-center justify-center">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || 'User Avatar'}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <UserIcon className="h-5 w-5 text-[#6e2a7e]" />
                )}
              </div>

              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-[#23456c] leading-tight">{user.name}</p>
                <p className="text-[11px] text-[#627289] leading-tight">{user.email}</p>
              </div>

              <button
                id="logout-btn"
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2deea] bg-[#ffffff] text-[#23456c] hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Subheader Toolbar Section */}
      <div className="border-b border-[#e2deea] bg-[#ffffff]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          
          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[#e2deea] bg-[#f8f7fa] p-1.5">
            <button
              id="tab-scheduled"
              onClick={() => onTabChange('scheduled')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                activeTab === 'scheduled'
                  ? 'bg-[#6e2a7e] text-white shadow-sm'
                  : 'text-[#23456c] hover:bg-[#c7bcd3]/40'
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
                  ? 'bg-[#6e2a7e] text-white shadow-sm'
                  : 'text-[#23456c] hover:bg-[#c7bcd3]/40'
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
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-[#23456c] hover:bg-[#c7bcd3]/40'
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Failed emails</span>
            </button>
          </div>

          {/* Action Row: Search Input & Primary Compose Button */}
          <div className="flex items-center gap-3">
            {onSearchChange && (
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#627289]" />
                <input
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search emails..."
                  className="w-full rounded-xl border border-[#e2deea] bg-[#ffffff] py-2 pl-9 pr-4 text-xs text-[#23456c] placeholder-[#627289] focus:border-[#6e2a7e] focus:outline-none focus:ring-1 focus:ring-[#6e2a7e] transition-all"
                />
              </div>
            )}

            <button
              id="compose-email-btn"
              onClick={onComposeClick}
              className="flex items-center gap-2 rounded-xl bg-[#6e2a7e] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#582165] active:scale-[0.98] transition-all duration-200"
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

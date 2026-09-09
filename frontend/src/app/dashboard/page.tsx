'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ComposeModal } from '@/components/ComposeModal';
import { ScheduledEmailsTable } from '@/components/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/SentEmailsTable';
import { FailedEmailsTable } from '@/components/FailedEmailsTable';
import { DataTable, Column } from '@/components/DataTable';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Mail,
  RefreshCw,
  X,
} from 'lucide-react';

export interface EmailJobItem {
  id: string;
  subject: string;
  body: string;
  recipientEmail: string;
  senderId: string;
  status: 'SCHEDULED' | 'SENT' | 'FAILED';
  scheduledAt: string;
  sentAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  sender?: {
    name: string;
    fromEmail: string;
  };
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'failed'>('scheduled');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<EmailJobItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeamName, setSlackTeamName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const handleComposeSuccess = (count: number) => {
    setToastMessage(`🎉 Successfully scheduled ${count} email job(s)!`);
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  const handleFetchError = (err: Error) => {
    setToastError(`⚠️ Error: ${err.message || 'An unexpected error occurred'}`);
    setTimeout(() => {
      setToastError(null);
    }, 5000);
  };

  // Perform Elasticsearch search when searchQuery changes
  const executeSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const url = `${backendUrl}/api/emails/search?q=${encodeURIComponent(searchQuery)}&status=${activeTab}`;
      const res = await fetch(url, {
        headers: { 'x-user-id': 'demo-user-id' },
      });

      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.data || []);
      } else {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || json.error || 'Search query failed');
      }
    } catch (err: any) {
      handleFetchError(err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, activeTab]);

  const checkSlackStatus = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${backendUrl}/api/slack/status`, {
        headers: { 'x-user-id': 'demo-user-id' },
      });
      if (res.ok) {
        const json = await res.json();
        setSlackConnected(json.connected);
        setSlackTeamName(json.teamName || json.teamId || null);
      }
    } catch (err) {
      console.error('Failed to fetch Slack status:', err);
    }
  }, []);

  useEffect(() => {
    checkSlackStatus();
  }, [checkSlackStatus]);

  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  const handleConnectSlack = () => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    window.location.href = `${backendUrl}/auth/slack/start`;
  };

  const searchColumns: Column<EmailJobItem>[] = [
    {
      key: 'recipientEmail',
      header: 'Recipient',
      render: (row) => <span className="font-medium text-white">{row.recipientEmail}</span>,
    },
    {
      key: 'subject',
      header: 'Subject & Content',
      render: (row) => (
        <div className="max-w-xs">
          <p className="font-semibold text-white truncate">{row.subject}</p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{row.body}</p>
        </div>
      ),
    },
    {
      key: 'scheduledAt',
      header: 'Timestamp',
      render: (row) => (
        <span className="text-slate-400">
          {new Date(row.sentAt || row.scheduledAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
            row.status === 'SCHEDULED'
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              : row.status === 'SENT'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}
        >
          {row.status === 'SCHEDULED' && <Clock className="h-3 w-3" />}
          {row.status === 'SENT' && <CheckCircle2 className="h-3 w-3" />}
          {row.status === 'FAILED' && <AlertCircle className="h-3 w-3" />}
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onComposeClick={() => setIsComposeOpen(true)}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      slackConnected={slackConnected}
      slackTeamName={slackTeamName}
      onConnectSlack={handleConnectSlack}
    >
      {/* Content Container */}
      <div className="space-y-6">
        
        {/* Table Control Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold capitalize text-white flex items-center gap-2">
              {activeTab === 'scheduled' && <Clock className="h-5 w-5 text-cyan-400" />}
              {activeTab === 'sent' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
              {activeTab === 'failed' && <AlertCircle className="h-5 w-5 text-rose-400" />}
              <span>{activeTab} Email Jobs</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {searchQuery ? `Search results for "${searchQuery}"` : `SWR 5s Polling Active for ${activeTab} queue items`}
            </p>
          </div>
        </div>

        {/* Conditional Table Rendering: SWR Polled Tables or Search DataTable */}
        {searchQuery.trim() !== '' ? (
          <DataTable
            columns={searchColumns}
            rows={searchResults}
            isLoading={isSearching}
            emptyMessage={`No jobs matched query "${searchQuery}".`}
          />
        ) : activeTab === 'scheduled' ? (
          <ScheduledEmailsTable onError={handleFetchError} />
        ) : activeTab === 'sent' ? (
          <SentEmailsTable onError={handleFetchError} />
        ) : (
          <FailedEmailsTable onError={handleFetchError} />
        )}
      </div>

      {/* Toast Success Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-slate-900/95 px-5 py-3.5 text-xs font-semibold text-emerald-400 shadow-2xl shadow-emerald-500/20 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Toast Error Notification */}
      {toastError && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-rose-500/40 bg-slate-900/95 px-5 py-3.5 text-xs font-semibold text-rose-400 shadow-2xl shadow-rose-500/20 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{toastError}</span>
          <button
            onClick={() => setToastError(null)}
            className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleComposeSuccess}
        onError={(errMsg) => handleFetchError(new Error(errMsg))}
      />
    </DashboardLayout>
  );
}

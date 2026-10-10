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
  X,
  Send,
  ShieldCheck,
  Zap,
  Layers,
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

  // Live Metrics State
  const [metrics, setMetrics] = useState({
    scheduledCount: 0,
    sentCount: 0,
    failedCount: 0,
  });

  const fetchMetrics = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const [schedRes, sentRes, failRes] = await Promise.all([
        fetch(`${backendUrl}/api/emails?status=scheduled&limit=1`, { headers: { 'x-user-id': 'demo-user-id' } }),
        fetch(`${backendUrl}/api/emails?status=sent&limit=1`, { headers: { 'x-user-id': 'demo-user-id' } }),
        fetch(`${backendUrl}/api/emails?status=failed&limit=1`, { headers: { 'x-user-id': 'demo-user-id' } }),
      ]);

      if (schedRes.ok && sentRes.ok && failRes.ok) {
        const [schedData, sentData, failData] = await Promise.all([
          schedRes.json(),
          sentRes.json(),
          failRes.json(),
        ]);
        setMetrics({
          scheduledCount: schedData.totalCount ?? (schedData.data?.length || 0),
          sentCount: sentData.totalCount ?? (sentData.data?.length || 0),
          failedCount: failData.totalCount ?? (failData.data?.length || 0),
        });
      }
    } catch (err) {
      // silent fetch failure for metrics
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleComposeSuccess = (count: number) => {
    setToastMessage(`Successfully scheduled ${count} email job(s)!`);
    fetchMetrics();
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  const handleFetchError = (err: Error) => {
    setToastError(`Error: ${err.message || 'An unexpected error occurred'}`);
    setTimeout(() => {
      setToastError(null);
    }, 5000);
  };

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
      render: (row) => <span className="font-semibold text-[#23456c]">{row.recipientEmail}</span>,
    },
    {
      key: 'subject',
      header: 'Subject & Content',
      render: (row) => (
        <div className="max-w-xs">
          <p className="font-medium text-[#23456c] truncate">{row.subject}</p>
          <p className="text-[11px] text-[#627289] truncate mt-0.5">{row.body}</p>
        </div>
      ),
    },
    {
      key: 'scheduledAt',
      header: 'Timestamp',
      render: (row) => (
        <span className="text-[#627289]">
          {new Date(row.sentAt || row.scheduledAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-semibold border ${
            row.status === 'SCHEDULED'
              ? 'bg-[#6e2a7e]/10 text-[#6e2a7e] border-[#6e2a7e]/20'
              : row.status === 'SENT'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
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
      <div className="space-y-6">
        
        {/* Real Analytical Stats Cards Bar (Fills empty dashboard space) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Stat 1: Scheduled Queue */}
          <div
            onClick={() => setActiveTab('scheduled')}
            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
              activeTab === 'scheduled'
                ? 'border-[#6e2a7e] bg-[#ffffff] shadow-md ring-1 ring-[#6e2a7e]'
                : 'border-[#e2deea] bg-[#ffffff] hover:border-[#6e2a7e]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#627289]">Scheduled Queue</span>
              <div className="rounded-lg bg-[#6e2a7e]/10 p-2 text-[#6e2a7e]">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-[#23456c]">{metrics.scheduledCount}</span>
              <span className="text-[11px] font-semibold text-[#6e2a7e]">Pending Jobs</span>
            </div>
          </div>

          {/* Stat 2: Sent History */}
          <div
            onClick={() => setActiveTab('sent')}
            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
              activeTab === 'sent'
                ? 'border-[#6e2a7e] bg-[#ffffff] shadow-md ring-1 ring-[#6e2a7e]'
                : 'border-[#e2deea] bg-[#ffffff] hover:border-[#6e2a7e]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#627289]">Delivered History</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <Send className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-[#23456c]">{metrics.sentCount}</span>
              <span className="text-[11px] font-semibold text-emerald-700">Dispatched</span>
            </div>
          </div>

          {/* Stat 3: Failed Logs */}
          <div
            onClick={() => setActiveTab('failed')}
            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
              activeTab === 'failed'
                ? 'border-rose-500 bg-[#ffffff] shadow-md ring-1 ring-rose-500'
                : 'border-[#e2deea] bg-[#ffffff] hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#627289]">Failed Jobs</span>
              <div className="rounded-lg bg-rose-50 p-2 text-rose-700">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-[#23456c]">{metrics.failedCount}</span>
              <span className="text-[11px] font-semibold text-rose-700">Needs Review</span>
            </div>
          </div>

          {/* Stat 4: Hourly Sender Rate Cap */}
          <div className="rounded-2xl border border-[#e2deea] bg-[#ffffff] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#627289]">Sender Throttling Rate</span>
              <div className="rounded-lg bg-[#5e80c4]/10 p-2 text-[#5e80c4]">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-[#23456c]">100 <span className="text-xs font-normal text-[#627289]">/ hr</span></span>
              <span className="text-[11px] font-semibold text-[#5e80c4]">Concurrency: 5</span>
            </div>
          </div>
        </div>

        {/* Table Control Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold capitalize text-[#23456c] flex items-center gap-2">
              {activeTab === 'scheduled' && <Clock className="h-5 w-5 text-[#6e2a7e]" />}
              {activeTab === 'sent' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              {activeTab === 'failed' && <AlertCircle className="h-5 w-5 text-rose-600" />}
              <span>{activeTab} Email Jobs</span>
            </h2>
            <p className="text-xs text-[#627289] mt-0.5">
              {searchQuery ? `Filter query: "${searchQuery}"` : `Displaying active items in ${activeTab} queue`}
            </p>
          </div>
        </div>

        {/* Main Table View */}
        {searchQuery.trim() !== '' ? (
          <DataTable
            columns={searchColumns}
            rows={searchResults}
            isLoading={isSearching}
            emptyMessage={`No email jobs match "${searchQuery}".`}
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
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-300 bg-[#ffffff] px-4 py-3 text-xs font-semibold text-emerald-800 shadow-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 rounded-md p-1 text-[#627289] hover:bg-[#c7bcd3]/40 hover:text-[#23456c]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Toast Error Notification */}
      {toastError && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-rose-300 bg-[#ffffff] px-4 py-3 text-xs font-semibold text-rose-800 shadow-lg">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{toastError}</span>
          <button
            onClick={() => setToastError(null)}
            className="ml-2 rounded-md p-1 text-[#627289] hover:bg-[#c7bcd3]/40 hover:text-[#23456c]"
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

'use client';

import React from 'react';
import useSWR from 'swr';
import { DataTable, Column } from './DataTable';
import { EmailJobItem } from '../app/dashboard/page';
import { Clock } from 'lucide-react';

/**
 * ============================================================================
 * SCHEDULED EMAILS QUEUE TABLE COMPONENT (components/ScheduledEmailsTable.tsx)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Displays all pending/delayed email jobs waiting in the queue.
 * - Uses SWR (Stale-While-Revalidate) for reactive client data fetching.
 * - Auto-refreshes every 5 seconds (`refreshInterval: 5000`) so user sees jobs
 *   leave the queue in real-time when the background worker processes them.
 * 
 * CONTROL FLOW:
 * 1. Component mounts in DashboardLayout when activeTab === 'scheduled'.
 * 2. SWR calls `fetcher(endpoint)` with `x-user-id` header.
 * 3. Express API returns matching `SCHEDULED` EmailJob records.
 * 4. Component maps data to columns (Recipient, Subject, Scheduled Time, Status badge)
 *    and renders via `<DataTable>`.
 */

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: { 'x-user-id': 'demo-user-id' },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const errMsg = json.error?.message || json.error || 'Failed to fetch scheduled emails';
    throw new Error(errMsg);
  }
  const json = await res.json();
  return json.data || [];
};

import { getBackendUrl } from '@/lib/api';

export interface ScheduledEmailsTableProps {
  onError?: (err: Error) => void;
}


export function ScheduledEmailsTable({ onError }: ScheduledEmailsTableProps) {
  const backendUrl = getBackendUrl();
  const endpoint = `${backendUrl}/api/emails?status=scheduled&limit=50`;

  const { data: rows = [], error, isLoading } = useSWR<EmailJobItem[]>(
    endpoint,
    fetcher,
    {
      refreshInterval: 5000,
      onError: (err) => {
        if (onError) onError(err);
      },
    }
  );

  const columns: Column<EmailJobItem>[] = [
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
      header: 'Scheduled Time',
      render: (row) => (
        <span className="text-[#627289]">
          {new Date(row.scheduledAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#6e2a7e]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#6e2a7e] border border-[#6e2a7e]/20">
          <Clock className="h-3 w-3" /> Scheduled
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      emptyMessage="No scheduled emails currently in queue."
    />
  );
}

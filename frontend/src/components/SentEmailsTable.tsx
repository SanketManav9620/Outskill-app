'use client';

import React from 'react';
import useSWR from 'swr';
import { DataTable, Column } from './DataTable';
import { EmailJobItem } from '../app/dashboard/page';
import { CheckCircle2 } from 'lucide-react';

/**
 * ============================================================================
 * SENT EMAILS HISTORY TABLE COMPONENT (components/SentEmailsTable.tsx)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Displays successfully delivered email jobs (`status === 'SENT'`).
 * - Shows recipient, subject snippet, delivery timestamp (`sentAt`), and success badge.
 * - Auto-refreshes every 5 seconds via SWR to capture newly completed dispatches.
 * 
 * CONTROL FLOW:
 * SWR issues GET `/api/emails?status=sent&limit=50`. Express returns delivered
 * records, and `DataTable` displays them in descending chronological order.
 */

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: { 'x-user-id': 'demo-user-id' },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const errMsg = json.error?.message || json.error || 'Failed to fetch sent emails';
    throw new Error(errMsg);
  }
  const json = await res.json();
  return json.data || [];
};

import { getBackendUrl } from '@/lib/api';

export interface SentEmailsTableProps {
  onError?: (err: Error) => void;
}


export function SentEmailsTable({ onError }: SentEmailsTableProps) {
  const backendUrl = getBackendUrl();
  const endpoint = `${backendUrl}/api/emails?status=sent&limit=50`;

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
      key: 'sentAt',
      header: 'Sent Time',
      render: (row) => (
        <span className="text-[#627289]">
          {row.sentAt ? new Date(row.sentAt).toLocaleString() : 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3" /> Sent
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      emptyMessage="No sent emails found in history."
    />
  );
}

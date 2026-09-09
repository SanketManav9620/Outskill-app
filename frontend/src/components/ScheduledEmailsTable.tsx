'use client';

import React from 'react';
import useSWR from 'swr';
import { DataTable, Column } from './DataTable';
import { EmailJobItem } from '../app/dashboard/page';
import { Clock } from 'lucide-react';

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

export interface ScheduledEmailsTableProps {
  onError?: (err: Error) => void;
}

export function ScheduledEmailsTable({ onError }: ScheduledEmailsTableProps) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
      header: 'Scheduled Time',
      render: (row) => (
        <span className="text-slate-400">
          {new Date(row.scheduledAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-400 border border-cyan-500/20">
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

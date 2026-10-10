'use client';

import React from 'react';
import useSWR from 'swr';
import { DataTable, Column } from './DataTable';
import { EmailJobItem } from '../app/dashboard/page';
import { AlertCircle } from 'lucide-react';

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: { 'x-user-id': 'demo-user-id' },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const errMsg = json.error?.message || json.error || 'Failed to fetch failed emails';
    throw new Error(errMsg);
  }
  const json = await res.json();
  return json.data || [];
};

export interface FailedEmailsTableProps {
  onError?: (err: Error) => void;
}

export function FailedEmailsTable({ onError }: FailedEmailsTableProps) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const endpoint = `${backendUrl}/api/emails?status=failed&limit=50`;

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
      key: 'errorMessage',
      header: 'Error',
      render: (row) => (
        <span className="text-rose-600 font-medium text-[11px] truncate max-w-xs block">
          {row.errorMessage || 'Unknown error'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 border border-rose-200">
          <AlertCircle className="h-3 w-3" /> Failed
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      emptyMessage="No failed email jobs."
    />
  );
}

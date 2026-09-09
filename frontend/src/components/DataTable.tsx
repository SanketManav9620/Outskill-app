'use client';

import React from 'react';
import { Mail } from 'lucide-react';

export interface Column<T = any> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T = any> {
  columns: Column<T>[];
  rows: T[];
  isLoading: boolean;
  emptyMessage?: string;
}

export function DataTable<T = any>({
  columns,
  rows,
  isLoading,
  emptyMessage = 'No items found in table.',
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-md">
      {isLoading ? (
        /* Loading Skeleton */
        <div className="p-6 space-y-4">
          <div className="h-6 w-full animate-pulse rounded-lg bg-slate-800/80" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 py-3">
                <div className="h-4 w-1/4 animate-pulse rounded bg-slate-800/60" />
                <div className="h-4 w-2/5 animate-pulse rounded bg-slate-800/60" />
                <div className="h-4 w-1/6 animate-pulse rounded bg-slate-800/60" />
                <div className="h-4 w-1/8 animate-pulse rounded bg-slate-800/60" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        /* Empty State */
        <div className="flex h-64 flex-col items-center justify-center p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mb-3 shadow-inner">
            <Mail className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">Empty Queue State</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">{emptyMessage}</p>
        </div>
      ) : (
        /* Normal Table Render */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-6 py-3.5">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {rows.map((row: any, rowIdx: number) => (
                <tr
                  key={row.id || rowIdx}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      {col.render ? col.render(row) : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { Mail } from 'lucide-react';

/**
 * ============================================================================
 * GENERIC REUSABLE DATA TABLE COMPONENT (components/DataTable.tsx)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Provides a strongly typed, reusable tabular data viewer.
 * - Supports custom column cell renderers (`render: (row) => ...`).
 * - Features animated pulse skeleton loaders when `isLoading === true`.
 * - Displays an empty state banner with custom icon and guidance text when `rows.length === 0`.
 * 
 * PROPS:
 * - columns: Array of Column definitions (`key`, `header`, optional `render` callback).
 * - rows: Array of records to display.
 * - isLoading: Boolean flag to render skeleton loading placeholders.
 * - emptyMessage: Informational text when no records are found.
 */

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
  emptyMessage = 'No email jobs found in queue.',
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e2deea] bg-[#ffffff] shadow-sm">
      {isLoading ? (
        <div className="p-6 space-y-4">
          <div className="h-6 w-full animate-pulse rounded-lg bg-[#c7bcd3]/30" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 py-3">
                <div className="h-4 w-1/4 animate-pulse rounded bg-[#c7bcd3]/30" />
                <div className="h-4 w-2/5 animate-pulse rounded bg-[#c7bcd3]/30" />
                <div className="h-4 w-1/6 animate-pulse rounded bg-[#c7bcd3]/30" />
                <div className="h-4 w-1/8 animate-pulse rounded bg-[#c7bcd3]/30" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f8f7fa] border border-[#e2deea] text-[#6e2a7e] mb-3">
            <Mail className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#23456c]">No Email Jobs Found</h3>
          <p className="text-xs text-[#627289] mt-1 max-w-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#e2deea] bg-[#f8f7fa] text-[#23456c] font-semibold uppercase tracking-wider">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-6 py-3.5">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2deea] text-[#23456c]">
              {rows.map((row: any, rowIdx: number) => (
                <tr
                  key={row.id || rowIdx}
                  className="hover:bg-[#c7bcd3]/15 transition-colors"
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

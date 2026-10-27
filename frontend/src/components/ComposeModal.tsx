'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { getBackendUrl } from '@/lib/api';
import {
  X,
  Send,
  Calendar,
  Mail,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Clock,
  Zap,
} from 'lucide-react';

/**
 * ============================================================================
 * COMPOSE & BATCH SCHEDULE MODAL COMPONENT (components/ComposeModal.tsx)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Interactive modal dialog to compose and dispatch email campaigns.
 * - Supports batch recipient importing via CSV or TXT file uploads (via `papaparse`).
 * - Performs client-side regex email validation, separating valid emails from invalid lines.
 * - Allows manual email list entry (comma/newline separated).
 * - Exposes campaign scheduling options:
 *     1. Start Time (`startTime`): scheduled timestamp.
 *     2. Stagger Delay (`delaySeconds`): delay between consecutive emails.
 *     3. Hourly Rate Limit (`hourlyLimit`): sender throttling ceiling.
 * - Submits payload to POST `/api/emails/schedule-batch`.
 * - Fires `onSuccess(count)` to trigger metrics refresh and close modal.
 */

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  onError?: (errorMsg: string) => void;
}

// RFC 5322 compliant email regex for client-side sanity checking
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ComposeModal({ isOpen, onClose, onSuccess, onError }: ComposeModalProps) {
  // Form Input States
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('sender-default-1');
  const [startTime, setStartTime] = useState(
    new Date(Date.now() + 60000).toISOString().slice(0, 16) // Default 1 minute in future
  );
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  // Recipient Processing States
  const [validEmails, setValidEmails] = useState<string[]>([]);
  const [invalidRows, setInvalidRows] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');

  // UI Status States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guard: If modal is not open, render nothing to save DOM resources
  if (!isOpen) return null;

  /**
   * processEmailList()
   * 
   * TASK / PURPOSE:
   * Takes a raw array of email strings, validates each against EMAIL_REGEX,
   * deduplicates entries, and separates them into `validEmails` and `invalidRows`.
   */
  const processEmailList = (rawList: string[]) => {
    const valid: string[] = [];
    const invalid: string[] = [];

    rawList.forEach((item) => {
      const trimmed = item.trim();
      if (!trimmed) return;

      if (EMAIL_REGEX.test(trimmed)) {
        if (!valid.includes(trimmed)) {
          valid.push(trimmed);
        }
      } else {
        if (!invalid.includes(trimmed)) {
          invalid.push(trimmed);
        }
      }
    });

    setValidEmails((prev) => Array.from(new Set([...prev, ...valid])));
    setInvalidRows((prev) => Array.from(new Set([...prev, ...invalid])));
  };

  /**
   * handleFileUpload()
   * 
   * TASK / PURPOSE:
   * Handles user file selection for .csv or .txt files.
   * Uses Papa.parse for structured CSV matrices, or FileReader for plain text lines.
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setError(null);

    const isCsv = file.name.endsWith('.csv');

    if (isCsv) {
      // Parse CSV asynchronously using Papaparse
      Papa.parse(file, {
        complete: (results) => {
          const rawEntries: string[] = [];
          results.data.forEach((row: any) => {
            if (Array.isArray(row)) {
              row.forEach((cell) => {
                if (typeof cell === 'string') rawEntries.push(cell);
              });
            } else if (typeof row === 'string') {
              rawEntries.push(row);
            }
          });
          processEmailList(rawEntries);
        },
        error: (err) => {
          const msg = `Failed to parse CSV file: ${err.message}`;
          setError(msg);
          if (onError) onError(msg);
        },
      });
    } else {
      // Read plain text file line by line
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const lines = content.split(/\r?\n/);
          processEmailList(lines);
        }
      };
      reader.readAsText(file);
    }
  };

  // Parses manually typed or pasted comma/newline-delimited emails
  const handleAddManualEmails = () => {
    if (!manualInput.trim()) return;
    const entries = manualInput.split(/[\n,;]/);
    processEmailList(entries);
    setManualInput('');
  };

  // Clears invalid email lines from preview
  const handleRemoveInvalidRows = () => {
    setInvalidRows([]);
  };

  /**
   * handleSubmit()
   * 
   * TASK / PURPOSE:
   * Submits the campaign payload to the backend REST API (`POST /api/emails/schedule-batch`).
   * 
   * CONTROL FLOW:
   * 1. Validates that at least 1 valid recipient email is queued.
   * 2. Sets loading state and issues HTTP POST fetch request with `x-user-id` header.
   * 3. On success (HTTP 201):
   *    - Clears all form fields.
   *    - Invokes `onSuccess(count)` callback to alert the parent dashboard.
   *    - Closes modal via `onClose()`.
   * 4. On error: displays friendly error message.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validEmails.length === 0) {
      const msg = 'Please add or upload at least one valid recipient email address.';
      setError(msg);
      if (onError) onError(msg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/emails/schedule-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user-id',
        },
        body: JSON.stringify({
          subject,
          body,
          senderId,
          recipients: validEmails,
          startTime: new Date(startTime).toISOString(),
          delaySeconds: Number(delaySeconds),
          hourlyLimit: Number(hourlyLimit),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData.error?.message || errorData.error || 'Failed to schedule batch email jobs';
        throw new Error(errMsg);
      }

      const responseData = await res.json();
      const count = responseData.count || validEmails.length;

      // Reset form state
      setSubject('');
      setBody('');
      setValidEmails([]);
      setInvalidRows([]);
      setUploadedFileName(null);
      
      onSuccess(count);
      onClose();
    } catch (err: any) {
      const errMsg = err.message || 'An unexpected error occurred during batch scheduling';
      setError(errMsg);
      if (onError) onError(errMsg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23456c]/30 p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative my-8 w-full max-w-2xl rounded-2xl border border-[#e2deea] bg-[#ffffff] p-6 shadow-2xl text-[#23456c]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e2deea] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6e2a7e] text-white">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#23456c]">Compose & Schedule Batch Emails</h2>
              <p className="text-xs text-[#627289]">Recipient import, stagger delay & rate limits</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#627289] hover:bg-[#f8f7fa] hover:text-[#23456c] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Error Alert */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          
          {/* Subject & Sender ID */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#23456c] mb-1">
                Subject Line
              </label>
              <input
                id="compose-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Outskill Product Launch Update"
                className="w-full rounded-xl border border-[#e2deea] bg-[#f8f7fa] px-3.5 py-2 text-xs text-[#23456c] placeholder-[#627289] focus:border-[#6e2a7e] focus:outline-none focus:ring-1 focus:ring-[#6e2a7e]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#23456c] mb-1">
                Sender ID
              </label>
              <input
                id="compose-sender"
                type="text"
                required
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="sender-1"
                className="w-full rounded-xl border border-[#e2deea] bg-[#f8f7fa] px-3.5 py-2 text-xs text-[#23456c] placeholder-[#627289] focus:border-[#6e2a7e] focus:outline-none focus:ring-1 focus:ring-[#6e2a7e]"
              />
            </div>
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-semibold text-[#23456c] mb-1">
              Email Content
            </label>
            <textarea
              id="compose-body"
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email body message here..."
              className="w-full rounded-xl border border-[#e2deea] bg-[#f8f7fa] px-3.5 py-2 text-xs text-[#23456c] placeholder-[#627289] focus:border-[#6e2a7e] focus:outline-none focus:ring-1 focus:ring-[#6e2a7e]"
            />
          </div>

          {/* Recipient File Upload Section */}
          <div className="rounded-xl border border-[#e2deea] bg-[#f8f7fa] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#23456c] flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#5e80c4]" />
                <span>Recipients (CSV / TXT Upload)</span>
              </label>

              {validEmails.length > 0 && (
                <span id="detected-count-badge" className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{validEmails.length} email addresses detected</span>
                </span>
              )}
            </div>

            {/* File Dropzone & Manual Add */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-xl border border-dashed border-[#5e80c4]/40 bg-[#5e80c4]/10 px-4 py-2 text-xs font-semibold text-[#23456c] hover:bg-[#5e80c4]/20 transition"
              >
                <Upload className="h-4 w-4 text-[#5e80c4]" />
                <span>{uploadedFileName ? `Uploaded: ${uploadedFileName}` : 'Upload CSV / TXT file'}</span>
              </button>

              <div className="flex flex-1 items-center gap-2 w-full">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Or paste email addresses..."
                  className="flex-1 rounded-xl border border-[#e2deea] bg-[#ffffff] px-3 py-2 text-xs text-[#23456c] placeholder-[#627289] focus:border-[#6e2a7e] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddManualEmails}
                  className="rounded-xl border border-[#e2deea] bg-[#c7bcd3]/30 px-3 py-2 text-xs font-medium text-[#23456c] hover:bg-[#c7bcd3]/50"
                >
                  Add
                </button>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    <span>{invalidRows.length} invalid recipient rows found</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveInvalidRows}
                    className="flex items-center gap-1 rounded-md bg-amber-200/60 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-300/60 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Remove all invalid rows</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[#23456c] mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-[#6e2a7e]" />
                <span>Start Time</span>
              </label>
              <input
                id="compose-start-time"
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-[#e2deea] bg-[#f8f7fa] px-3.5 py-2 text-xs text-[#23456c] focus:border-[#6e2a7e] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#23456c] mb-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-[#6e2a7e]" />
                <span>Delay (Seconds)</span>
              </label>
              <input
                id="compose-delay-seconds"
                type="number"
                min="0"
                required
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full rounded-xl border border-[#e2deea] bg-[#f8f7fa] px-3.5 py-2 text-xs text-[#23456c] focus:border-[#6e2a7e] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#23456c] mb-1 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-[#6e2a7e]" />
                <span>Hourly Limit</span>
              </label>
              <input
                id="compose-hourly-limit"
                type="number"
                min="1"
                required
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-[#e2deea] bg-[#f8f7fa] px-3.5 py-2 text-xs text-[#23456c] focus:border-[#6e2a7e] focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-[#e2deea] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#e2deea] bg-[#ffffff] px-4 py-2 text-xs font-medium text-[#23456c] hover:bg-[#f8f7fa]"
            >
              Cancel
            </button>
            <button
              id="submit-batch-btn"
              type="submit"
              disabled={loading || validEmails.length === 0}
              className="flex items-center gap-2 rounded-xl bg-[#6e2a7e] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#582165] disabled:opacity-50 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{loading ? 'Scheduling...' : `Schedule ${validEmails.length} Email(s)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

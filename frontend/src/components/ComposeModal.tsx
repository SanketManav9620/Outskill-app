'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
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
  Sparkles,
  Clock,
  Zap,
} from 'lucide-react';

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  onError?: (errorMsg: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ComposeModal({ isOpen, onClose, onSuccess, onError }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('sender-default-1');
  const [startTime, setStartTime] = useState(
    new Date(Date.now() + 60000).toISOString().slice(0, 16)
  );
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [validEmails, setValidEmails] = useState<string[]>([]);
  const [invalidRows, setInvalidRows] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setError(null);

    const isCsv = file.name.endsWith('.csv');

    if (isCsv) {
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
      // TXT file or fallback
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

  const handleAddManualEmails = () => {
    if (!manualInput.trim()) return;
    const entries = manualInput.split(/[\n,;]/);
    processEmailList(entries);
    setManualInput('');
  };

  const handleRemoveInvalidRows = () => {
    setInvalidRows([]);
  };

  const handleRemoveValidEmail = (emailToRemove: string) => {
    setValidEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

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
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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

      // Reset form fields
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative my-8 w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Compose & Schedule Batch Emails</h2>
              <p className="text-xs text-slate-400">CSV/TXT recipient upload, stagger delay, & rate limit controls</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Error Alert */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Compose Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          
          {/* Subject & Sender ID Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Subject Line
              </label>
              <input
                id="compose-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Quarterly Product Update"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Sender ID
              </label>
              <input
                id="compose-sender"
                type="text"
                required
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="sender-1"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Content (HTML / Plaintext)
            </label>
            <textarea
              id="compose-body"
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email body message here..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Recipient File Upload Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-cyan-400" />
                <span>Recipients (CSV / TXT Upload)</span>
              </label>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {validEmails.length > 0 && (
                  <span id="detected-count-badge" className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{validEmails.length} email addresses detected</span>
                  </span>
                )}
              </div>
            </div>

            {/* File Dropzone */}
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
                className="flex items-center gap-2 rounded-xl border border-dashed border-cyan-500/40 bg-cyan-500/5 px-4 py-2.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 transition"
              >
                <Upload className="h-4 w-4" />
                <span>{uploadedFileName ? `Uploaded: ${uploadedFileName}` : 'Upload CSV / TXT file'}</span>
              </button>

              {/* Manual Input Fallback */}
              <div className="flex flex-1 items-center gap-2 w-full">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Or paste emails (comma/newline separated)..."
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddManualEmails}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Invalid Rows Warning Banner */}
            {invalidRows.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-amber-400">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    <span>{invalidRows.length} invalid recipient rows found</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveInvalidRows}
                    className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Remove all invalid rows</span>
                  </button>
                </div>
                <div className="max-h-20 overflow-y-auto text-[11px] text-amber-300/80 font-mono space-y-0.5">
                  {invalidRows.map((row, idx) => (
                    <div key={idx} className="truncate">• {row}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Schedule Controls: Start Time, Delay, Hourly Limit */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                <span>Start Time</span>
              </label>
              <input
                id="compose-start-time"
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                <span>Delay (Seconds)</span>
              </label>
              <input
                id="compose-delay-seconds"
                type="number"
                min="0"
                required
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-cyan-400" />
                <span>Hourly Limit</span>
              </label>
              <input
                id="compose-hourly-limit"
                type="number"
                min="1"
                required
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              id="submit-batch-btn"
              type="submit"
              disabled={loading || validEmails.length === 0}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:opacity-95 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{loading ? 'Scheduling Batch...' : `Schedule ${validEmails.length} Email(s)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

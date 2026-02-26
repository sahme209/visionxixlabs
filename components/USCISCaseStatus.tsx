"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchCaseStatus, USCISCaseStatusResponse, CaseStatusError, mapUSCISErrorToFriendly } from "@/lib/services/uscisStatusService";
import Link from "next/link";
import USCISStatusAPIDebug from "./USCISStatusAPIDebug";

interface USCISCaseStatusProps {
  receiptNumber?: string;
  onReceiptNumberChange?: (receiptNumber: string) => void;
  /** Called when USCIS status is successfully fetched — drives Case Timeline */
  onStatusLoaded?: (status: import("@/lib/services/uscisStatusService").USCISCaseStatusResponse) => void;
  /** Called when fetch fails (wrong IOE, case not found, API error) — clears progress on cards */
  onStatusError?: () => void;
  /** Called when fetch starts/stops — drives loading state on Case Timeline */
  onStatusFetching?: (fetching: boolean) => void;
}

type LoadState = "idle" | "loading" | "success" | "error";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export default function USCISCaseStatus({ receiptNumber: initialReceiptNumber = "", onReceiptNumberChange, onStatusLoaded, onStatusError, onStatusFetching }: USCISCaseStatusProps) {
  const router = useRouter();
  const [receiptNumber, setReceiptNumber] = useState(initialReceiptNumber);
  const [status, setStatus] = useState<USCISCaseStatusResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  
  // Secret tap functionality - 7 clicks to reveal debug view (matches iOS)
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [showDebugView, setShowDebugView] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const SECRET_CLICK_THRESHOLD = 7;
  const CLICK_TIMEOUT_MS = 3000; // 3 seconds

  // Fetch status — runs only on manual user action (Save, Refresh, Check Status)
  const fetchStatus = useCallback(async (receipt: string) => {
    if (!receipt || receipt.length !== 13) {
      setLoadState("idle");
      setStatus(null);
      return;
    }

    // Guard: prevent duplicate submissions and calls on re-render
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    setLoadState("loading");
    setError(null);
    setErrorTitle(null);
    onStatusFetching?.(true);

    // Timeout fail-safe (single use, not polling)
    const timeoutId = setTimeout(() => {
      isFetchingRef.current = false;
      const friendly = mapUSCISErrorToFriendly("Request timeout");
      setErrorTitle(friendly.title);
      setError(friendly.message);
      setLoadState("error");
      setStatus(null);
      onStatusError?.();
      onStatusFetching?.(false);
    }, 30000);

    try {
      const result = await fetchCaseStatus(receipt);
      clearTimeout(timeoutId);
      isFetchingRef.current = false;
      setStatus(result);
      setLastFetchTime(new Date());
      setLoadState("success");
      onStatusFetching?.(false);
      onStatusLoaded?.(result);
    } catch (err: any) {
      clearTimeout(timeoutId);
      isFetchingRef.current = false;
      const error = err as CaseStatusError;
      
      // Use friendly error mapping (matches iOS pattern)
      const rawError = error.message || "Unknown error";
      const friendly = mapUSCISErrorToFriendly(rawError);
      
      // Set the friendly error title and message (matches iOS)
      setErrorTitle(friendly.title);
      setError(friendly.message);
      setLoadState("error");
      setStatus(null);
      onStatusFetching?.(false);
      onStatusError?.();
    }
  }, [onStatusLoaded, onStatusError, onStatusFetching]);

  // Sync receipt from props
  useEffect(() => {
    setReceiptNumber(initialReceiptNumber);
    if (!initialReceiptNumber || initialReceiptNumber.length !== 13) {
      setLoadState("idle");
      setStatus(null);
      onStatusFetching?.(false);
    }
  }, [initialReceiptNumber, onStatusFetching]);

  // Auto-fetch on mount: use cached result from profile-setup save, or fetch once
  useEffect(() => {
    const receipt = initialReceiptNumber?.trim();
    if (!receipt || receipt.length !== 13 || isFetchingRef.current) return;

    // Check sessionStorage for result from profile-setup Save and Continue
    try {
      const cached = sessionStorage.getItem("visanova_uscis_pending");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.receiptNumber === receipt) {
          sessionStorage.removeItem("visanova_uscis_pending");
          if (parsed.status) {
            setStatus(parsed.status);
            setLoadState("success");
            setLastFetchTime(new Date());
            onStatusLoaded?.(parsed.status);
          } else if (parsed.error) {
            setErrorTitle(parsed.error.title);
            setError(parsed.error.message);
            setLoadState("error");
            onStatusError?.();
          }
          onStatusFetching?.(false);
          return;
        }
      }
    } catch (_) { /* ignore */ }

    // No cache — auto-fetch so status always displays without pressing Check Status
    fetchStatus(receipt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReceiptNumber]);

  const handleEdit = () => {
    // Navigate to profile setup in edit mode (which includes form selection) - matching iOS behavior
    router.push("/profile-setup?edit=true");
  };

  const handleSave = () => {
    if (receiptNumber.length === 13) {
      onReceiptNumberChange?.(receiptNumber);
      fetchStatus(receiptNumber);
      setShowEdit(false);
    }
  };

  const handleRefresh = () => {
    if (receiptNumber && receiptNumber.length === 13) {
      fetchStatus(receiptNumber);
    }
  };

  // Secret click handler - 7 clicks to reveal debug view (matches iOS)
  const handleSecretClick = useCallback(() => {
    setSecretClickCount((prev) => {
      const newCount = prev + 1;
      console.log(`🔐 Secret click on USCIS card: ${newCount}/${SECRET_CLICK_THRESHOLD}`);
      
      if (newCount >= SECRET_CLICK_THRESHOLD) {
        setShowDebugView(true);
        setSecretClickCount(0);
        console.log("✅ Showing USCISStatusAPIDebug");
        return 0;
      }
      
      // Reset timeout
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      
      // Set new timeout to reset counter after 3 seconds
      clickTimeoutRef.current = setTimeout(() => {
        if (newCount < SECRET_CLICK_THRESHOLD) {
          setSecretClickCount(0);
          console.log("⏱️ Secret click count reset (timeout)");
        }
      }, CLICK_TIMEOUT_MS);
      
      return newCount;
    });
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const isEditable = onReceiptNumberChange !== undefined;

  return (
    <>
      {showDebugView && <USCISStatusAPIDebug onClose={() => setShowDebugView(false)} />}
      <div className="uscis-card card-see-through relative rounded-xl">
        <div className="p-6">
          {/* Mobile: tiny pencil top-right */}
          {receiptNumber && receiptNumber.length === 13 && !showEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit(); }}
              className="sm:hidden absolute top-3 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--uscis-blue)]/10 active:bg-[var(--uscis-blue)]/15 transition-colors"
              aria-label="Edit profile and form type"
              title="Edit profile and form type"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {/* Card Header with Secret Click Handler - Official Format */}
          <div 
            onClick={handleSecretClick}
            className="relative mb-6"
            title="USCIS Case Status"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-[var(--border-color)] rounded-t-lg hidden sm:block"></div>
            <div className="pt-3">
              <div className="flex items-start gap-4">
                <button type="button" className="w-14 h-14 rounded-2xl bg-[var(--uscis-blue)] flex items-center justify-center text-white flex-shrink-0 cursor-pointer hover:opacity-90 active:opacity-80 transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2" aria-label="Case Status Icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-slot="icon" className="w-7 h-7">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd"></path>
                  </svg>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 mb-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">USCIS Case Status</h3>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm">Official</span>
                    </div>
                    {receiptNumber && receiptNumber.length === 13 && !showEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(); }}
                        className="hidden sm:flex sm:ml-auto items-center justify-start gap-1.5 px-3.5 py-2 rounded-full bg-[var(--uscis-blue)]/10 hover:bg-[var(--uscis-blue)]/20 backdrop-blur-sm border border-[var(--uscis-blue)]/20 transition-all group shadow-sm hover:shadow-md shrink-0"
                        aria-label="Edit profile and form type"
                        title="Edit profile and form type"
                      >
                        <svg className="w-3.5 h-3.5 text-[var(--text-primary)] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span className="text-xs font-semibold text-[var(--text-primary)]">Edit</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Check your case status from USCIS
                  </p>
                </div>
              </div>
            </div>
          </div>
        {/* Receipt Number Display (from profile) - Official Format */}
        {receiptNumber && receiptNumber.length === 13 && !showEdit && (
          <div className="mb-5 pb-4 border-b border-[var(--border-color)]/50">
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Receipt Number</p>
              <p className="text-base font-mono font-semibold text-[var(--text-primary)] case-number tracking-wider bg-[var(--bg-surface-alt)] px-4 py-2.5 rounded-xl border border-[var(--border-color)]/30">{receiptNumber.toUpperCase()}</p>
            </div>
          </div>
        )}

        {/* Receipt Number Input (shown when editing) */}
        {showEdit && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Receipt Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value.toUpperCase().trim())}
                placeholder="e.g., MSC1234567890"
                maxLength={13}
                className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono text-sm focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-[var(--uscis-blue)] rounded"
              />
              <button
                onClick={handleSave}
                disabled={receiptNumber.length !== 13 || loadState === "loading"}
                className="px-4 py-2 bg-[var(--uscis-blue)] text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowEdit(false);
                  setReceiptNumber(initialReceiptNumber);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Enter your 13-character receipt number from your I-797 notice
            </p>
          </div>
        )}

        {/* Loading State */}
        {loadState === "loading" && (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--uscis-blue)]"></div>
              <p className="text-sm text-[var(--text-secondary)]">Fetching case status...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {loadState === "error" && error && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-800 dark:text-gray-200 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {errorTitle || "Unable to Fetch Status"}
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-200 mb-3">
                  {error}
                </p>
                {receiptNumber && receiptNumber.length === 13 && (
                  <button
                    onClick={handleRefresh}
                    className="text-sm font-medium text-gray-900 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 underline hover:no-underline"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success State - Timeline layout (Case Tracker-style) */}
        {loadState === "success" && status && status.statusText && !status.statusText.toLowerCase().includes("unavailable") && (
          (() => {
            const txt = status.statusText.toLowerCase();
            const isApproved = txt.includes("approved") || txt.includes("card was delivered") || txt.includes("card is being produced");
            const isDenied = txt.includes("denied");
            const variant = isApproved ? "approved" : isDenied ? "denied" : "in-progress";
            const badgeLabel = variant === "approved" ? "Approved" : variant === "denied" ? "Denied" : "Current Status";
            const trackColor =
              variant === "approved"
                ? "bg-emerald-500"
                : variant === "denied"
                ? "bg-red-500"
                : "bg-[var(--uscis-blue)]";
            const dateLabel = status.lastUpdated || "Latest update";

            return (
              <div className="rounded-2xl mb-6 shadow-md border border-[var(--border-color)]/60 overflow-hidden bg-[var(--bg-surface)]">
                {/* Timeline-style header bar */}
                <div className="relative bg-[var(--bg-surface-alt)] px-5 py-3 flex items-center justify-between border-b border-[var(--border-color)]/70">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[var(--uscis-blue)]/45 via-[var(--uscis-blue-light)]/30 to-[var(--uscis-blue)]/45 pointer-events-none" aria-hidden="true" />
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--bg-surface)] border border-[var(--uscis-blue)]/25 flex items-center justify-center">
                      <span className="text-xs font-semibold text-[var(--uscis-blue)]">I-130</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold tracking-wide uppercase text-[var(--text-primary)]">
                        USCIS Case Status
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        Latest update from case history
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold tracking-wide uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Official
                  </span>
                </div>

                <div className="p-5">
                  {/* Desktop timeline layout */}
                  <div className="relative hidden sm:block">
                    {/* Vertical track */}
                    <div className="absolute left-[176px] top-3 bottom-3 w-px bg-slate-300/70" aria-hidden="true" />

                    <div className="flex gap-4">
                      {/* Date column */}
                      <div className="w-40 pr-6 text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">
                        {dateLabel}
                      </div>

                      {/* Dot + content */}
                      <div className="flex-1 flex gap-4">
                        <div className="flex flex-col items-center mt-0.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${trackColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Badge */}
                          <div
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 ${
                              variant === "approved"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : variant === "denied"
                                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                                : "bg-[var(--uscis-blue)]/10 text-[var(--text-primary)]"
                            }`}
                          >
                            {badgeLabel}
                          </div>

                          {/* Title */}
                          <h4 className="text-[15px] sm:text-base font-semibold text-[var(--text-primary)] mb-1">
                            {status.statusText}
                          </h4>

                          {/* Detail text */}
                          {status.statusDetail && (
                            <div
                              className="uscis-status-detail text-sm text-[var(--text-secondary)] leading-relaxed mb-2 space-y-1 [&_a]:text-[var(--text-primary)] [&_a]:font-medium [&_a]:hover:underline [&_a]:break-all"
                              dangerouslySetInnerHTML={{
                                __html: status.statusDetail.replace(
                                  /<a\s+/gi,
                                  '<a class="text-[var(--text-primary)] font-medium hover:underline" target="_blank" rel="noopener noreferrer" '
                                ),
                              }}
                            />
                          )}

                          {/* Last updated + Refresh */}
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            {status.lastUpdated && (
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Last updated {status.lastUpdated}
                              </p>
                            )}
                            {receiptNumber && receiptNumber.length === 13 && (
                              <button
                                onClick={handleRefresh}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] hover:underline"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                                Refresh
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mobile stacked layout */}
                  <div className="block sm:hidden space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">{dateLabel}</p>
                      <div className="inline-flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${trackColor}`} />
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                            variant === "approved"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : variant === "denied"
                              ? "bg-red-500/10 text-red-700"
                              : "bg-[var(--uscis-blue)]/10 text-[var(--text-primary)]"
                          }`}
                        >
                          {badgeLabel}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                        {status.statusText}
                      </h4>
                      {status.statusDetail && (
                        <div
                          className="uscis-status-detail text-xs text-[var(--text-secondary)] leading-relaxed space-y-1 [&_a]:text-[var(--text-primary)] [&_a]:font-medium [&_a]:hover:underline [&_a]:break-all"
                          dangerouslySetInnerHTML={{
                            __html: status.statusDetail.replace(
                              /<a\s+/gi,
                              '<a class="text-[var(--text-primary)] font-medium hover:underline" target="_blank" rel="noopener noreferrer" '
                            ),
                          }}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-[var(--border-color)]/60 mt-2">
                      {status.lastUpdated && (
                        <p className="text-[11px] text-[var(--text-tertiary)]">
                          Last updated {status.lastUpdated}
                        </p>
                      )}
                      {receiptNumber && receiptNumber.length === 13 && (
                        <button
                          onClick={handleRefresh}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:underline"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Refresh
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* Success State - USCIS temporarily unavailable */}
        {loadState === "success" && status && status.statusText && status.statusText.toLowerCase().includes("unavailable") && (
          <div className="bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 border-l-4 border-[var(--uscis-blue)] p-5 rounded-xl shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-800 dark:text-gray-200" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  USCIS is temporarily unavailable
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-4">
                  The USCIS Case Status API is currently unavailable. This usually happens outside of normal operation hours (M-F 7:00 AM - 8:00 PM EST). Please try again during those hours.
                </p>
                {receiptNumber && receiptNumber.length === 13 && (
                  <button
                    onClick={handleRefresh}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No Receipt State */}
        {loadState === "idle" && !receiptNumber && !showEdit && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Add your receipt number to check your case status
            </p>
            {isEditable && (
              <button
                onClick={() => setShowEdit(true)}
                className="px-4 py-2 bg-[var(--uscis-blue)] text-white font-semibold hover:bg-blue-700 rounded"
              >
                Add Receipt Number
              </button>
            )}
          </div>
        )}

      </div>
    </div>
    </>
  );
}


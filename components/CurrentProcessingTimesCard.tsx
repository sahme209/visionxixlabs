"use client";

import React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { ClockIcon, ArrowPathIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import {
  currentProcessingTimesService,
  ProcessingTimesData,
} from "@/lib/services/currentProcessingTimesService";
import { PremiumUpsell } from "./PremiumUpsell";
import CurrentProcessingTimesDetailView from "./CurrentProcessingTimesDetailView";
import Tooltip from "./Tooltip";
import OfficialBadge from "./OfficialBadge";

interface CurrentProcessingTimesCardProps {
  isSubscribed?: boolean; // For premium gating
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    return "Just now";
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  }
}

function formatFormName(text: string): string {
  const patterns: Array<[string, string]> = [
    ["I-129F", "K-1 Fiancé(e) Visa (I-129F)"],
    ["I-130", "Family/Spouse Petition (I-130)"],
    ["I-485", "Green Card / Adjustment of Status (I-485)"],
    ["I-765", "Work Permit / EAD (I-765)"],
    ["I-131", "Travel Document / Advance Parole (I-131)"],
    ["I-751", "Remove Conditions (I-751)"],
    ["N-400", "Naturalization / Citizenship (N-400)"],
    ["K-1", "K-1 Fiancé(e) Visa"],
    ["K-3", "K-3 Spouse Visa"],
  ];

  const upperText = text.toUpperCase();
  for (const [pattern, formatted] of patterns) {
    if (upperText.includes(pattern.toUpperCase())) {
      return formatted;
    }
  }

  return text.trim();
}

function parseServiceCenterLine(line: string): ServiceCenterDate | null {
  const parts = line.split(":");
  if (parts.length < 2) return null;

  const centerCode = parts[0].trim().toUpperCase();
  const datePart = parts[1].trim();

  const centerNames: Record<string, string> = {
    CSC: "California",
    TSC: "Texas",
    NBC: "National Benefits",
    VSC: "Vermont",
    NSC: "Nebraska",
    WAC: "California",
    SRC: "Texas",
    LIN: "Nebraska",
    EAC: "Vermont",
    MSC: "Missouri",
    YSC: "Potomac",
    IOE: "Electronic",
  };

  const centerName = centerNames[centerCode] || centerCode;

  return { center: centerName, date: datePart };
}

/**
 * Current Processing Times Card
 * Exact match of iOS CurrentProcessingTimesCard.swift
 */
// Export types for detail view
export interface ProcessingTimeEntry {
  formName: string;
  serviceCenters: ServiceCenterDate[];
}

export interface ServiceCenterDate {
  center: string;
  date: string;
}

// Export parse function for detail view
export function parseProcessingTimes(bodyText: string): ProcessingTimeEntry[] {
  const lines = bodyText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const entries: ProcessingTimeEntry[] = [];
  let currentFormName: string | null = null;
  let currentServiceCenters: ServiceCenterDate[] = [];

  for (const line of lines) {
    // Check if line is a form name (contains "I-" or common form identifiers)
    if (/^I-\d+|^N-\d+|^K-1|^K-3|for\s+(K-1|K-3)/i.test(line)) {
      // Save previous entry if exists
      if (currentFormName && currentServiceCenters.length > 0) {
        entries.push({ formName: currentFormName, serviceCenters: currentServiceCenters });
      }

      // Start new entry
      currentFormName = formatFormName(line);
      currentServiceCenters = [];
    } else if (line.includes(":")) {
      // Check if line contains service center and date pattern
      const scEntry = parseServiceCenterLine(line);
      if (scEntry) {
        currentServiceCenters.push(scEntry);
      }
    }
  }

  // Add last entry
  if (currentFormName && currentServiceCenters.length > 0) {
    entries.push({ formName: currentFormName, serviceCenters: currentServiceCenters });
  }

  // If no structured entries found, fall back to simple line-by-line display
  if (entries.length === 0) {
    return lines.slice(0, 8).map((line) => ({ formName: line, serviceCenters: [] }));
  }

  return entries;
}

export default function CurrentProcessingTimesCard({ isSubscribed = false }: CurrentProcessingTimesCardProps) {
  const [data, setData] = useState<ProcessingTimesData>({
    bodyText: null,
    updatedAt: null,
    updatedBy: null,
    version: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);

  useEffect(() => {
    console.log("[CurrentProcessingTimesCard] 🔄 Subscribing to processing times service...");
    setLoading(true);
    setError(null);

    let timeoutId: NodeJS.Timeout | null = null;

    const unsubscribe = currentProcessingTimesService.subscribe((newData) => {
      console.log("[CurrentProcessingTimesCard] 📥 Received data update:", {
        hasBodyText: !!newData.bodyText,
        bodyTextLength: newData.bodyText?.length || 0,
        updatedAt: newData.updatedAt?.toISOString() || null,
      });
      setData(newData);
      setLoading(false);
      
      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // If no data after 5 seconds, show error
      if (!newData.bodyText) {
        timeoutId = setTimeout(() => {
          setError("Unable to load processing times. The document may not exist in Firestore.");
          console.warn("[CurrentProcessingTimesCard] ⚠️ No data received after timeout");
        }, 5000);
      }
    });

    return () => {
      console.log("[CurrentProcessingTimesCard] 🧹 Cleaning up subscription");
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, []);

  const parsedEntries = data.bodyText ? parseProcessingTimes(data.bodyText) : [];
  const displayEntries = parsedEntries.slice(0, 8); // Show up to 8 entries

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow overflow-hidden min-w-0">
      {/* Header - Approvals-style */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)] flex-shrink-0">
          <ClockIcon className="w-5 h-5 text-[var(--text-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Current Processing Times</h3>
            <Tooltip 
              content="Official USCIS processing times showing the dates currently being processed by each service center. Updated daily from USCIS sources."
              iconOnly 
              position="top"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"></div>
              <span className="text-xs text-[var(--text-secondary)] font-medium">Live Data</span>
            </div>
            <OfficialBadge variant="official" size="sm" />
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <div className="mb-3 p-4 rounded-lg border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50">
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-primary)] font-semibold">Real-time processing dates</strong> from USCIS service centers. 
          These dates show what cases are currently being processed, helping you estimate when your case might be reviewed.
        </p>
      </div>

      {/* Content */}
      {loading && !data.bodyText ? (
        <div className="py-4 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent mb-2"></div>
          <p className="text-xs text-[var(--text-secondary)]">Loading processing times...</p>
        </div>
      ) : error ? (
        <div className="py-4 text-center">
          <p className="text-xs text-[var(--text-secondary)] text-red-500">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              // Force refresh by re-subscribing
              const unsubscribe = currentProcessingTimesService.subscribe((newData) => {
                setData(newData);
                setLoading(false);
              });
              setTimeout(() => unsubscribe(), 100);
            }}
            className="mt-2 text-xs text-[var(--text-primary)] hover:underline"
          >
            Retry
          </button>
        </div>
      ) : data.bodyText && data.bodyText.length > 0 ? (
        <div className="space-y-3.5">
          {/* Last Updated Badge */}
          {data.updatedAt && (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1.5">
              <ArrowPathIcon className="w-3 h-3 text-[var(--text-secondary)]" />
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">Last updated</span>
              <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                {formatRelativeDate(data.updatedAt)}
              </span>
            </div>
          )}

          {/* Premium Overlay - Completely hide content */}
          {!isSubscribed ? (
            <div className="relative min-h-[400px] sm:min-h-[450px] rounded-xl bg-[var(--bg-surface)]/95 backdrop-blur-sm border-t border-[var(--border-color)]">
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl">
                <div className="text-center max-w-lg mx-auto p-12 sm:p-16 w-full">
                  <PremiumUpsell
                    title="Get Current Processing Times"
                    subtitle="Know exactly how long your case will take"
                    features={["Up-to-Date Processing Times", "Service Center Breakdowns", "Form-Specific Estimates", "Daily Data Refresh"]}
                    ctaText="Subscribe to Unlock"
                    variant="centered"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Charts section — Approvals-style 3-column layout */}
              {displayEntries.length > 0 && (() => {
                const formsChartData = displayEntries.slice(0, 6).map((e) => ({
                  name: e.formName.replace(/^.*?(I-\d+|N-\d+|K-\d+).*$/i, (_, m) => m || e.formName.slice(0, 8)),
                  centers: e.serviceCenters.length || 1,
                }));
                const firstWithCenters = displayEntries.find((e) => e.serviceCenters.length > 0);
                const centersChartData = firstWithCenters
                  ? firstWithCenters.serviceCenters.slice(0, 6).map((sc) => ({ name: sc.center, value: 1, date: sc.date }))
                  : [];
                const formsCount = displayEntries.length;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
                    <div className="rounded-lg p-4 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50">
                      <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Forms with data</p>
                      <div className="w-full h-24 sm:h-28 min-h-[80px] min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={formsChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} width={20} axisLine={false} tickLine={false} allowDecimals={false} />
                            <RechartsTooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} />
                            <Bar dataKey="centers" fill="var(--uscis-blue)" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {centersChartData.length > 0 && (
                      <div className="rounded-lg p-4 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50">
                        <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">By service center ({firstWithCenters?.formName.slice(0, 12)}…)</p>
                        <div className="w-full h-24 sm:h-28 min-h-[80px] min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={centersChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <RechartsTooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} formatter={(value, name, item) => [(item?.payload as { date?: string })?.date ?? value, "Date"]} />
                              <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={24} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg p-4 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50">
                      <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Forms tracked</p>
                      <div className="w-full h-24 sm:h-28 min-h-[80px] min-w-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-[var(--text-primary)]">{formsCount}</span>
                        <span className="text-sm text-[var(--text-secondary)] ml-1">forms</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {displayEntries.length > 0 ? (
                displayEntries.map((entry, index) => (
                  <ProcessingTimeEntryCard key={index} entry={entry} />
                ))
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">Processing times will appear here once updated.</p>
              )}
              
              {/* View Details Button - Only show for subscribed users */}
              {isSubscribed && data.bodyText && (
                <button
                  className="w-full rounded-xl bg-[var(--uscis-blue)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--uscis-blue-dark)]"
                  onClick={() => setShowDetailView(true)}
                >
                  <span className="flex items-center justify-center gap-2">
                    View Full Details
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          )}
          </div>
        ) : (
          <div className="py-2">
            <p className="text-xs text-[var(--text-secondary)]">
              Processing times will appear here once updated.
            </p>
          </div>
        )}

      {/* Detail View Modal */}
      {showDetailView && data.bodyText && (
        <CurrentProcessingTimesDetailView
          bodyText={data.bodyText}
          updatedAt={data.updatedAt}
          onClose={() => setShowDetailView(false)}
        />
      )}
    </div>
  );
}

// Processing Time Entry Card Component
function ProcessingTimeEntryCard({ entry }: { entry: ProcessingTimeEntry }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50 p-4 min-w-0 overflow-hidden">
      <h4 className="mb-2 text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">{entry.formName}</h4>
      {entry.serviceCenters.length > 0 ? (
        <div className="flex flex-wrap gap-2 min-w-0">
          {entry.serviceCenters.map((sc, index) => (
            <div
              key={index}
              className="rounded-md bg-blue-500/10 px-2 py-1 text-[11px] sm:text-xs font-medium text-[var(--text-primary)] break-words max-w-full"
            >
              <span className="font-semibold">{sc.center}:</span> <span>{sc.date}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-secondary)]">{entry.formName}</p>
      )}
    </div>
  );
}

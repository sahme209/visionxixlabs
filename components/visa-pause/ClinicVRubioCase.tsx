"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { ClinicVRubioCaseInfo, ClinicVRubioUpdate } from "@/lib/data/clinicVRubioCase";
import DocketSection from "./DocketSection";
import LawsuitTimeline from "./LawsuitTimeline";

interface ClinicVRubioApiResponse extends ClinicVRubioCaseInfo {
  updates: (ClinicVRubioUpdate & { type?: "curated" | "news" })[];
  lastFetched?: string;
}

const POLL_INTERVAL_MS = 90_000; // Refresh case updates every 90s

export default function ClinicVRubioCase() {
  const [data, setData] = useState<ClinicVRubioApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCaseData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/clinic-v-rubio", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to load case updates");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Could not load case data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaseData();
  }, [fetchCaseData]);

  useEffect(() => {
    const onFocus = () => fetchCaseData(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchCaseData]);

  useEffect(() => {
    const id = setInterval(() => fetchCaseData(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchCaseData]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-5 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[var(--uscis-blue)]/10 border border-[var(--uscis-blue)]/20 animate-pulse" />
            <div className="flex-1">
              <div className="h-5 w-48 bg-[var(--bg-surface-alt)] rounded animate-pulse mb-2" />
              <div className="h-3 w-32 bg-[var(--bg-surface-alt)] rounded animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[var(--uscis-blue)]/30 border-t-[var(--uscis-blue)] rounded-full animate-spin" />
            <span className="text-sm text-[var(--text-secondary)]">Loading case updates…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-5 sm:py-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">CLINIC v. Rubio</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-2">{error || "Unable to load case data."}</p>
        </div>
      </div>
    );
  }

  const {
    shortName,
    court,
    filedDate,
    summary,
    impact,
    sourceUrls,
    updates,
    docketNumber,
    judge,
    docketEntries,
    relatedCases,
    legalArguments,
    affectedCountries,
    caseStatus,
    exhibits,
    nextHearing,
  } = data;

  return (
    <div className="space-y-6">
      {/* Case Overview */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
        <div className="surface-dark relative px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-gradient-to-br from-[var(--hero-dark)] to-[var(--hero-dark-soft)] border-b border-white/10">
          <div className="absolute inset-0 opacity-[0.04] bg-[url('data:image/svg+xml,%3Csvg width=%2760%27 height=%2760%27 viewBox=%270 0 60 60%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cg fill=%27none%27 fill-rule=%27evenodd%27%3E%3Cg fill=%27%23ffffff%27 fill-opacity=%271%27%3E%3Cpath d=%27M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%27/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
          <div className="relative flex items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex-shrink-0">
              <svg className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--icon)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-xl font-bold flex flex-wrap items-center gap-2 text-fg">
                <span className="break-words">{shortName}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 border border-white/30 text-xs font-semibold flex-shrink-0 text-fg">
                  Active litigation
                </span>
              </h3>
              <p className="text-xs mt-1 text-muted">{court} • Filed {filedDate}</p>
              {docketNumber && (
                <p className="text-xs mt-0.5 font-mono text-muted">Docket: {docketNumber}</p>
              )}
              <p className="text-sm mt-3 leading-relaxed max-w-2xl text-fg">{summary}</p>
              <p className="text-sm mt-2 leading-relaxed max-w-2xl text-fg">{impact}</p>
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 md:px-8 py-5 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-base font-bold text-[var(--text-primary)]">Case updates</h4>
            {data.lastFetched && (
              <span className="text-xs text-[var(--text-tertiary)]">
                Last updated {new Date(data.lastFetched).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="space-y-6">
            <ul className="space-y-4">
              {updates.slice(0, 6).map((u) => (
                <li key={u.id} className="flex gap-4">
                  <div className="flex-shrink-0 w-12 text-right">
                    <span className="text-xs font-semibold text-[var(--text-tertiary)]">{u.date}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{u.title}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">{u.summary}</p>
                    {u.sourceUrl && (
                      <a
                        href={u.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {u.source || "Source"}
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-color)] sources-reading-black">
            <p className="text-xs font-medium mb-2" style={{ color: "#000" }}>Sources & further reading</p>
            <div className="flex flex-wrap gap-2">
              {sourceUrls.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sources-reading-link inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] text-xs font-medium hover:bg-[var(--uscis-blue)] hover:text-white hover:border-[var(--uscis-blue)] transition-colors"
                >
                  <span style={{ color: "#000000" }}>{s.label}</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Docket Section */}
      <DocketSection
        docketNumber={docketNumber}
        judge={judge}
        docketEntries={docketEntries || []}
        relatedCases={relatedCases || []}
        legalArguments={legalArguments || []}
        affectedCountries={affectedCountries || []}
        caseStatus={caseStatus || "Active"}
        exhibits={exhibits || []}
        nextHearing={nextHearing}
      />

      {/* Approximate lawsuit timelines (Red Eagle + CLINIC) */}
      <LawsuitTimeline />
    </div>
  );
}

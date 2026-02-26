"use client";

import { useEffect, useState } from "react";

interface EmbassyWaitTime {
  city: string;
  b1b2WaitTimeMonths?: number;
  b1b2NextAvailableMonths?: number;
  fMjNextAvailableMonths?: number;
  petitionBasedNextAvailableMonths?: number;
  crewTransitNextAvailableMonths?: number;
  i129fWaitTimeDays?: number;
}

interface ApiResponse {
  waitTimes?: EmbassyWaitTime[];
  waitTime?: EmbassyWaitTime;
  error?: string;
}

export default function EmbassySpotlightSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<EmbassyWaitTime | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/embassy-wait-times");
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;

        const list = json.waitTimes ?? (json.waitTime ? [json.waitTime] : []);
        if (!list || list.length === 0) {
          setSpotlight(null);
          return;
        }

        // Pick the city with the longest estimated I-129F wait time as a spotlight
        const withI129f = list.filter((e) => typeof e.i129fWaitTimeDays === "number");
        const source = withI129f.length > 0 ? withI129f : list;
        const sorted = [...source].sort((a, b) => (b.i129fWaitTimeDays ?? 0) - (a.i129fWaitTimeDays ?? 0));
        setSpotlight(sorted[0]);
      } catch (e) {
        if (!cancelled) {
          console.error("[EmbassySpotlightSection] error", e);
          setError("Could not load embassy wait times right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !spotlight) {
    return (
      <div className="rounded-2xl card-see-through border border-[var(--border-color)]/50 bg-[var(--bg-surface)]/98 p-4 sm:p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--uscis-blue)]/10 flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent animate-spin" />
          </div>
          <div>
            <p className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)]">Embassy spotlight</p>
            <p className="text-[10px] sm:text-xs text-[var(--text-secondary)]">
              Loading embassy wait times from State Department…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !spotlight) {
    return (
      <div className="rounded-2xl card-see-through border border-[var(--border-color)]/50 bg-[var(--bg-surface)]/98 p-4 sm:p-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)]">Embassy spotlight</p>
          <p className="text-[10px] sm:text-xs text-[var(--text-secondary)]">
            {error ?? "No embassy wait time data is available right now."}
          </p>
        </div>
      </div>
    );
  }

  const b1Label =
    typeof spotlight.b1b2NextAvailableMonths === "number"
      ? `${spotlight.b1b2NextAvailableMonths.toFixed(1)} months`
      : "—";
  const i129fLabel =
    typeof spotlight.i129fWaitTimeDays === "number" ? `${spotlight.i129fWaitTimeDays} days (est.)` : "—";

  return (
    <div className="rounded-2xl card-see-through border border-[var(--border-color)]/50 bg-[var(--bg-surface)]/98 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[var(--uscis-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M3 5h18M5 9h14l-1 10H6L5 9zM9 9V5m6 4V5"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)]">Embassy spotlight</p>
          <p className="text-[10px] sm:text-xs text-[var(--text-secondary)]">
            Current estimated interview waits at{" "}
            <span className="font-semibold text-[var(--text-primary)]">{spotlight.city}</span>.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] sm:text-xs">
        <div className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]/60">
          <p className="text-[9px] uppercase tracking-wide text-[var(--text-tertiary)] mb-0.5">B1/B2 next available</p>
          <p className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)]">{b1Label}</p>
        </div>
        <div className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]/60">
          <p className="text-[9px] uppercase tracking-wide text-[var(--text-tertiary)] mb-0.5">I-129F estimate</p>
          <p className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)]">{i129fLabel}</p>
        </div>
      </div>
    </div>
  );
}


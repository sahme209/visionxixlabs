"use client";

/**
 * Compact recent-activity feed for the dashboard.
 *
 * Polls /api/dashboard/activity once on mount; refresh button re-runs
 * the fetch. Renders the 8 most-recent audit rows as a tiny timeline
 * with outcome tone + relative time. Empty / migration-pending paths
 * render nothing so the dashboard stays calm.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowPathIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

interface Entry {
  id: string;
  action: string;
  outcome: string;
  occurredAt: string;
  entityRef: string | null;
}

const OUTCOME_TONE: Record<string, string> = {
  success: "text-emerald-300",
  failure: "text-rose-300",
  blocked: "text-zinc-300",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export function RecentActivity() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/activity", { cache: "no-store" });
      const data: { ok?: boolean; entries?: Entry[] } = await res.json();
      if (data?.ok && Array.isArray(data.entries)) setEntries(data.entries);
    } catch {
      // Silent — empty feed is honest.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Don't render anything until we have data — keeps the dashboard
  // calm for fresh tenants who haven't done anything yet.
  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">recent activity</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <ArrowPathIcon className="h-3 w-3" />
            refresh
          </button>
          <Link href="/dashboard/audit" className="text-[11px] text-zinc-500 hover:text-white transition-colors inline-flex items-center gap-1">
            View all <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
        {entries.map((e) => {
          const tone = OUTCOME_TONE[e.outcome] ?? "text-zinc-400";
          return (
            <li key={e.id} className="px-6 py-2.5 flex items-center gap-3">
              <span className={`text-[10px] font-mono uppercase tracking-wider ${tone} w-14 shrink-0`}>
                {e.outcome}
              </span>
              <span className="text-[11px] font-mono text-zinc-300 truncate flex-1 min-w-0">
                {e.action}
                {e.entityRef && <span className="text-zinc-600"> · {e.entityRef}</span>}
              </span>
              <span className="text-[10px] font-mono text-zinc-600 shrink-0">{timeAgo(e.occurredAt)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

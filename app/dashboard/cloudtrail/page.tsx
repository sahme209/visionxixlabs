"use client";

/**
 * /dashboard/cloudtrail — live AWS CloudTrail event tail.
 *
 * Pulls /api/cloud/cloudtrail and renders the last hour of management
 * events with severity + category classification. Lookback selector
 * runs 15m / 1h / 6h / 24h.
 */

import { useCallback, useEffect, useState } from "react";
import {
  EyeIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

type Severity = "info" | "low" | "medium" | "high" | "critical";
type Outcome = "success" | "failure" | "unknown";
type Category = "iam" | "compute" | "storage" | "network" | "security" | "billing" | "console_login" | "other";

interface CloudTrailEvent {
  eventId: string;
  eventName: string;
  eventTime?: string;
  eventSource?: string;
  username?: string;
  region?: string;
  userType?: string;
  rootUser: boolean;
  outcome: Outcome;
  severity: Severity;
  category: Category;
  errorCode?: string;
}

interface Extraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  region?: string;
  lookbackMinutes: number;
  total: number;
  failureCount: number;
  highOrCriticalCount: number;
  rootUserCount: number;
  events: CloudTrailEvent[];
  durationMs: number;
  limitations: string[];
}

const LOOKBACK_OPTIONS = [
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
];

const SEVERITY_TONE: Record<Severity, string> = {
  info: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  low: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  high: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  critical: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

const CATEGORY_LABEL: Record<Category, string> = {
  iam: "IAM",
  compute: "Compute",
  storage: "Storage",
  network: "Network",
  security: "Security",
  billing: "Billing",
  console_login: "Login",
  other: "Other",
};

export default function CloudTrailPage() {
  const [result, setResult] = useState<Extraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookback, setLookback] = useState<number>(60);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");

  const load = useCallback((minutes: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/cloud/cloudtrail?lookbackMinutes=${minutes}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: Extraction; error?: { userMessage?: string } }) => {
        if (json.ok && json.data) setResult(json.data);
        else setError(json.error?.userMessage ?? "CloudTrail unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(lookback); }, [lookback, load]);

  const filtered = result?.events.filter((e) => severityFilter === "all" || e.severity === severityFilter) ?? [];

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(244,114,182,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(124,58,237,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <EyeIcon className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">
              CloudTrail
            </span>
          </span>
          {result?.region && (
            <span className="text-[10px] font-mono text-zinc-500">region {result.region}</span>
          )}
          {result && (
            <span className="text-[10px] font-mono text-zinc-500">{result.durationMs}ms</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Every API call. <span className="text-gradient">Audited.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Live AWS CloudTrail management-plane events with severity classification — root-user activity, IAM key
          changes, deletions, and Console login failures surfaced first.
        </p>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <ClockIcon className="h-4 w-4 text-zinc-500" />
          {LOOKBACK_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setLookback(o.value)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition ${
                lookback === o.value
                  ? "bg-rose-500/15 text-rose-200 border-rose-500/30"
                  : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white hover:border-white/[0.18]"
              }`}
            >
              {o.label}
            </button>
          ))}
          <button
            onClick={() => load(lookback)}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {result && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Events" value={result.total.toLocaleString()} tone="violet" />
            <Stat label="Failures" value={result.failureCount.toLocaleString()} tone={result.failureCount > 0 ? "amber" : "emerald"} icon={ExclamationTriangleIcon} />
            <Stat label="High / critical" value={result.highOrCriticalCount.toLocaleString()} tone={result.highOrCriticalCount > 0 ? "rose" : "emerald"} icon={ShieldExclamationIcon} />
            <Stat label="Root-user" value={result.rootUserCount.toLocaleString()} tone={result.rootUserCount > 0 ? "rose" : "emerald"} />
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">
          // pulling CloudTrail LookupEvents…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && result && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Filter:</span>
            {(["all", "critical", "high", "medium", "low", "info"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                  severityFilter === s
                    ? "bg-violet-500/15 text-violet-200 border-violet-500/30"
                    : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No CloudTrail events in the selected window matched this filter.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] mb-8">
              {filtered.slice(0, 100).map((e) => (
                <div key={e.eventId} className="p-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEVERITY_TONE[e.severity]}`}>
                          {e.severity}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                          {CATEGORY_LABEL[e.category]}
                        </span>
                        {e.rootUser && (
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            root
                          </span>
                        )}
                        {e.outcome === "failure" && (
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                            failure{e.errorCode ? ` · ${e.errorCode}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-semibold text-white truncate">{e.eventName}</p>
                      <p className="text-[11px] font-mono text-zinc-400 truncate">
                        {e.eventSource ?? "—"} · {e.username ?? "—"}{e.userType ? ` · ${e.userType}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                      {e.eventTime ? new Date(e.eventTime).toLocaleTimeString() : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.limitations.length > 0 && (
            <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.03] p-4 mb-8">
              <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-2">// notes</p>
              {result.limitations.map((l, i) => (
                <p key={i} className="text-[12px] text-zinc-300">· {l}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "violet";
  icon?: typeof ExclamationTriangleIcon;
}) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber: "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose: "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    violet: "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}

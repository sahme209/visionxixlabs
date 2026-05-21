"use client";

/**
 * /dashboard/cost-overview — Unified cross-cloud cost dashboard.
 *
 * Consumes /api/billing (which already merges AWS Cost Explorer +
 * Azure Cost Mgmt + GCP Billing + GitHub + Stripe + Vercel). Same
 * data the desktop runtime reads from when paired.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

interface ProviderPosture {
  provider: string;
  mode: string;
  configured: boolean;
  headline: string;
  confirmedDollarsLast30d: number;
  confirmedDollarsPrev30d: number;
  anomalies: { id: string; kind: string; severity: string; headline: string; impactSummary: string; deltaUsd?: number }[];
  missingRequirements: string[];
  externalConsoleHref?: string;
}

interface Report {
  generatedAt: string;
  providers: ProviderPosture[];
  anomalies: { id: string; kind: string; severity: string; headline: string }[];
  summary: {
    providerCount: number;
    liveProviderCount: number;
    totalConfirmedDollarsLast30d: number;
    totalConfirmedDollarsPrev30d: number;
    spendDeltaPct?: number;
    anomaliesTotal: number;
    anomaliesCritical: number;
    anomaliesHigh: number;
  };
  overallSourceMode: string;
  safetyContract: string;
  limitations: string[];
}

const PROVIDER_LABEL: Record<string, string> = {
  aws_cost_explorer: "AWS",
  azure_cost_management: "Azure",
  gcp_billing: "GCP",
  github_billing: "GitHub",
  stripe_meter: "Stripe",
  vercel_billing: "Vercel",
};

export default function CostOverviewPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Cost overview unavailable.");
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const deltaPct = report?.summary.spendDeltaPct;

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-90 pointer-events-none" style={{ background: "radial-gradient(900px 320px at 12% 0%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(245,158,11,0.06), transparent 60%)" }} aria-hidden />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <CurrencyDollarIcon className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              Cloud cost overview
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Every cloud. <span className="text-gradient">Every dollar.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          AWS + Azure + GCP + GitHub + Stripe + Vercel — confirmed cost numbers only. Zero fabricated savings, ever.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Providers reporting" value={`${report.summary.liveProviderCount}/${report.summary.providerCount}`} tone={report.summary.liveProviderCount > 0 ? "emerald" : "amber"} />
            <Stat label="Last 30 days" value={fmt(report.summary.totalConfirmedDollarsLast30d)} tone="emerald" />
            <Stat label="Prev 30 days" value={fmt(report.summary.totalConfirmedDollarsPrev30d)} tone="zinc" />
            <Stat
              label="Δ vs prior"
              value={deltaPct !== undefined ? `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "—"}
              tone={deltaPct === undefined ? "zinc" : deltaPct >= 20 ? "rose" : deltaPct <= -10 ? "emerald" : "amber"}
              icon={deltaPct === undefined ? undefined : deltaPct >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon}
            />
          </div>
        )}
      </div>

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">Loading your cloud cost data…</div>}
      {!loading && error && <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{error}</div>}

      {!loading && !error && report && (
        <>
          {/* Anomalies first — highest signal */}
          {report.anomalies.length > 0 && (
            <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.04] p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <ExclamationTriangleIcon className="h-4 w-4 text-rose-300" />
                <p className="text-[12px] font-semibold text-rose-200">
                  {report.summary.anomaliesTotal} anomaly{report.summary.anomaliesTotal === 1 ? "" : "ies"}
                  {report.summary.anomaliesCritical > 0 ? ` · ${report.summary.anomaliesCritical} critical` : ""}
                  {report.summary.anomaliesHigh > 0 ? ` · ${report.summary.anomaliesHigh} high` : ""}
                </p>
              </div>
              <div className="space-y-1">
                {report.anomalies.slice(0, 10).map((a) => (
                  <div key={a.id} className="rounded-md border border-white/[0.04] bg-white/[0.015] p-2 text-[12px]">
                    <span className={`inline-block text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded mr-2 ${
                      a.severity === "critical" ? "bg-rose-500/20 text-rose-200" :
                      a.severity === "high" ? "bg-rose-500/15 text-rose-300" :
                      "bg-amber-500/15 text-amber-300"
                    }`}>{a.severity}</span>
                    <span className="text-white">{a.headline}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-provider cost cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {report.providers.map((p) => {
              const pct = p.confirmedDollarsPrev30d > 0
                ? ((p.confirmedDollarsLast30d - p.confirmedDollarsPrev30d) / p.confirmedDollarsPrev30d) * 100
                : null;
              return (
                <div key={p.provider} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-white">{PROVIDER_LABEL[p.provider] ?? p.provider}</p>
                    <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      p.mode === "live" ? "bg-emerald-500/15 text-emerald-300" :
                      p.mode === "partial_live" ? "bg-cyan-500/15 text-cyan-300" :
                      p.mode === "blocked" ? "bg-rose-500/15 text-rose-300" :
                      "bg-amber-500/15 text-amber-300"
                    }`}>{p.mode}</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Last 30d</p>
                      <p className="text-[20px] font-bold text-white">{fmt(p.confirmedDollarsLast30d)}</p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>Prev: {fmt(p.confirmedDollarsPrev30d)}</span>
                      {pct !== null && (
                        <span className={pct >= 20 ? "text-rose-300" : pct <= -10 ? "text-emerald-300" : "text-amber-300"}>
                          {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {p.anomalies.length > 0 && (
                      <div className="rounded-md border border-rose-500/[0.18] bg-rose-500/[0.04] p-2">
                        <p className="text-[10px] text-rose-200">{p.anomalies.length} anomaly{p.anomalies.length === 1 ? "" : "ies"}</p>
                      </div>
                    )}
                    {p.missingRequirements.length > 0 && (
                      <div className="rounded-md border border-amber-500/[0.12] bg-amber-500/[0.03] p-2">
                        <p className="text-[9px] font-mono text-amber-300/80 uppercase tracking-wider mb-0.5">Setup needed</p>
                        {p.missingRequirements.slice(0, 2).map((m, i) => (
                          <p key={i} className="text-[10px] text-zinc-300">{m}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">How we calculate this</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                Cost data is read-only — we never modify your cloud bills or apply changes without your approval.
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                {report.limitations.join(" ")}
              </p>
              <Link href="/dashboard/finops" className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-200 hover:text-emerald-100">
                Open FinOps detail <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "zinc";
  icon?: typeof ArrowTrendingUpIcon;
}) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
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

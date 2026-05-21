"use client";

/**
 * /dashboard/cloud-security — Multi-cloud security findings cockpit.
 *
 * AWS GuardDuty + Azure Defender for Cloud + GCP Security Command
 * Center in one premium view. Cross-cloud severity totals + per-
 * cloud breakdown + per-finding row.
 *
 * Desktop runtime consumes the same /api/cloud/security endpoint
 * when paired — single source of truth.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  CloudIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

type Severity = "critical" | "high" | "medium" | "low" | "informational" | "unknown";
type Mode = "live" | "preview" | "blocked" | "disabled" | "unknown";

interface Finding {
  id: string;
  cloud: "aws" | "azure" | "gcp";
  category: string;
  title: string;
  severity: Severity;
  state: string;
  resourceId?: string;
  resourceType?: string;
  region?: string;
  firstSeenAt?: string;
}

interface CloudSection {
  cloud: "aws" | "azure" | "gcp";
  mode: Mode;
  serviceEnabled: boolean;
  total: number;
  bySeverity: Record<Severity, number>;
  findings: Finding[];
  limitations: string[];
}

interface Report {
  generatedAt: string;
  aws: CloudSection;
  azure: CloudSection;
  gcp: CloudSection;
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    enabledCloudCount: number;
  };
  overallSourceMode: Mode;
  safetyContract: "multi_cloud_security_read_only";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const SEVERITY_VISUAL: Record<Severity, { pill: string; label: string }> = {
  critical:      { pill: "bg-rose-500/20 text-rose-200 border-rose-500/40",       label: "CRITICAL" },
  high:          { pill: "bg-rose-500/15 text-rose-300 border-rose-500/30",       label: "HIGH" },
  medium:        { pill: "bg-amber-500/15 text-amber-300 border-amber-500/30",    label: "MEDIUM" },
  low:           { pill: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",       label: "LOW" },
  informational: { pill: "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",       label: "INFO" },
  unknown:       { pill: "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",       label: "?" },
};

const CLOUD_LABEL = {
  aws:   { name: "AWS GuardDuty",                color: "amber"  },
  azure: { name: "Azure Defender for Cloud",     color: "cyan"   },
  gcp:   { name: "GCP Security Command Center",  color: "violet" },
} as const;

export default function CloudSecurityPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cloud/security", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Cloud security unavailable.");
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(244,63,94,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(139,92,246,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ShieldExclamationIcon className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">
              Cloud Security
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          One pane. <span className="text-gradient">Three clouds.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          AWS GuardDuty · Azure Defender for Cloud · GCP Security Command Center. Every cloud's threat detection feed normalized into one typed shape. The autonomy loop reads from here.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Clouds reporting" value={`${report.summary.enabledCloudCount}/3`} tone={report.summary.enabledCloudCount === 3 ? "emerald" : "amber"} />
            <Stat label="Total findings" value={String(report.summary.totalFindings)} tone="zinc" />
            <Stat label="Critical" value={String(report.summary.criticalCount)} tone={report.summary.criticalCount > 0 ? "rose" : "emerald"} />
            <Stat label="High" value={String(report.summary.highCount)} tone={report.summary.highCount > 0 ? "rose" : "emerald"} />
            <Stat label="Medium" value={String(report.summary.mediumCount)} tone="amber" />
          </div>
        )}
      </div>

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">Loading findings from your clouds…</div>}
      {!loading && error && <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{error}</div>}

      {!loading && !error && report && (
        <>
          {/* Per-cloud section cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {(["aws", "azure", "gcp"] as const).map((cloud) => {
              const s = report[cloud];
              const meta = CLOUD_LABEL[cloud];
              return (
                <div key={cloud} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CloudIcon className="h-4 w-4 text-white/70" />
                      <p className="text-[13px] font-semibold text-white">{meta.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        s.mode === "live" ? "bg-emerald-500/15 text-emerald-300" :
                        s.mode === "blocked" ? "bg-rose-500/15 text-rose-300" :
                        "bg-amber-500/15 text-amber-300"
                      }`}>{s.mode}</span>
                      <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        s.serviceEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-300"
                      }`}>{s.serviceEnabled ? "on" : "off"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    <Mini label="Total" value={s.total} tone="zinc" />
                    <Mini label="Critical" value={s.bySeverity.critical} tone={s.bySeverity.critical > 0 ? "rose" : "zinc"} />
                    <Mini label="High" value={s.bySeverity.high} tone={s.bySeverity.high > 0 ? "rose" : "zinc"} />
                    <Mini label="Medium" value={s.bySeverity.medium} tone={s.bySeverity.medium > 0 ? "amber" : "zinc"} />
                  </div>

                  {s.limitations.length > 0 && (
                    <div className="rounded-md border border-amber-500/[0.12] bg-amber-500/[0.03] p-2">
                      <p className="text-[9px] font-mono text-amber-300/80 uppercase tracking-wider mb-0.5">// notes</p>
                      {s.limitations.map((l, i) => (
                        <p key={i} className="text-[10.5px] text-zinc-300 leading-snug">{l}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* All findings combined */}
          {(report.aws.findings.length + report.azure.findings.length + report.gcp.findings.length) > 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// findings across clouds</p>
              <div className="space-y-1.5">
                {[...report.aws.findings, ...report.azure.findings, ...report.gcp.findings]
                  .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
                  .slice(0, 50)
                  .map((f) => {
                    const v = SEVERITY_VISUAL[f.severity];
                    return (
                      <div key={f.id} className="flex items-start gap-2 rounded-md border border-white/[0.04] bg-white/[0.015] p-2.5">
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${v.pill}`}>{v.label}</span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">{f.cloud}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11.5px] text-white font-medium">{f.title}</p>
                          <p className="text-[10px] font-mono text-zinc-500 truncate">
                            {f.category}
                            {f.resourceId ? ` · ${f.resourceId}` : ""}
                            {f.region ? ` · ${f.region}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// safety contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">{report.limitations.join(" ")}</p>
              <Link href={report.safeNextAction.href} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-200 hover:text-emerald-100">
                {report.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function severityRank(s: Severity): number {
  switch (s) { case "critical": return 0; case "high": return 1; case "medium": return 2; case "low": return 3; case "informational": return 4; default: return 5; }
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[20px] font-bold mt-1">{value}</p>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-md border ${cls} p-2`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[14px] font-bold mt-0.5">{value}</p>
    </div>
  );
}

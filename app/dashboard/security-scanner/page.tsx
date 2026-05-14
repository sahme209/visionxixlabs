"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

interface CheckResult {
  id: string;
  title: string;
  description: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  category: string;
  scope: "cloud" | "app" | "supply_chain" | "desktop";
  provider?: string;
  status: "pass" | "fail" | "warn" | "unknown" | "preview";
  evidence: string[];
  remediation?: string;
  source: "live" | "preview";
}

interface ScanSummary {
  total: number;
  pass: number;
  fail: number;
  warn: number;
  unknown: number;
  preview: number;
  score: number;
  topRisk?: CheckResult;
}

interface ScanOutcome {
  generatedAt: string;
  results: CheckResult[];
  summary: ScanSummary;
  mode: "live_signals_partial" | "preview";
}

export default function SecurityScannerPage() {
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<"all" | "cloud" | "app" | "supply_chain" | "desktop">("all");

  async function runScan() {
    setLoading(true);
    try {
      const res = await fetch("/api/security-scan", { method: "POST" });
      const json = await res.json();
      if (json.ok) setOutcome(json.data as ScanOutcome);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { runScan(); }, []);

  const visible = outcome?.results.filter((r) => scope === "all" || r.scope === scope) ?? [];

  return (
    <div className="relative">
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <ShieldExclamationIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-[0.18em]">Security Scanner</p>
            <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
              {outcome?.mode === "live_signals_partial" ? "Live signals · partial" : "Preview"}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Vulnerability + posture <span className="bg-gradient-to-r from-amber-300 to-rose-300 bg-clip-text text-transparent">scanner.</span>
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Continuous checks across cloud, app/platform, supply-chain, and desktop. Every result is typed and honest — preview-source findings are labelled.
          </p>
        </div>
      </Reveal>

      {/* KPI strip */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {outcome && [
          { label: "Score",   value: `${Math.round(outcome.summary.score * 100)}%`, sub: `${outcome.summary.pass} pass · ${outcome.summary.warn} warn`, tone: "emerald" as const, Icon: ShieldCheckIcon },
          { label: "Fails",   value: `${outcome.summary.fail}`,    sub: outcome.summary.fail === 0 ? "Nothing failing" : "Action needed", tone: "red" as const, Icon: XCircleIcon },
          { label: "Preview", value: `${outcome.summary.preview}`, sub: "From preview-source inputs",                          tone: "amber" as const, Icon: ExclamationTriangleIcon },
          { label: "Unknown", value: `${outcome.summary.unknown}`, sub: "Source not provided",                                  tone: "zinc" as const, Icon: QuestionMarkCircleIcon },
        ].map((kpi) => {
          const { Icon } = kpi;
          const toneClass =
            kpi.tone === "emerald" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
            kpi.tone === "red"     ? "text-red-300 bg-red-500/10 border-red-500/20"             :
            kpi.tone === "amber"   ? "text-amber-300 bg-amber-500/10 border-amber-500/20"       :
                                      "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
          return (
            <div key={kpi.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${toneClass}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-2xl font-bold text-white tracking-[-0.04em]">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 uppercase tracking-[0.12em] mt-1">{kpi.label}</p>
              <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{kpi.sub}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Filter bar */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5">
          {(["all", "cloud", "app", "supply_chain", "desktop"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                scope === s ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15 px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Scanning…" : "Re-run scan"}
        </button>
      </div>

      {/* Results */}
      <div className="space-y-2">
        {visible.length === 0 && !loading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-zinc-500 text-sm">No checks in this scope.</div>
        )}
        {visible.map((r) => <CheckRow key={r.id} result={r} />)}
      </div>

      {/* Footer self-serve */}
      <div className="mt-10 grid sm:grid-cols-3 gap-3">
        {[
          { href: "/dashboard/trust",       label: "Trust Center",      sub: "Compliance controls + evidence bundles." },
          { href: "/dashboard/security",    label: "Security Center",   sub: "Tenant isolation, RBAC, credentials." },
          { href: "/dashboard/audit",       label: "Audit Center",      sub: "Evidence-backed audit stories." },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/25 hover:bg-emerald-500/[0.03] transition-colors">
            <p className="text-sm font-semibold text-white">{c.label}</p>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{c.sub}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">Open <ArrowRightIcon className="h-3 w-3" /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CheckRow({ result }: { result: CheckResult }) {
  const Icon =
    result.status === "pass"    ? CheckCircleIcon :
    result.status === "fail"    ? XCircleIcon :
    result.status === "warn"    ? ExclamationTriangleIcon :
    result.status === "preview" ? ExclamationTriangleIcon :
                                  QuestionMarkCircleIcon;
  const tone =
    result.status === "pass"    ? "text-emerald-300" :
    result.status === "fail"    ? "text-red-300" :
    result.status === "warn"    ? "text-amber-300" :
    result.status === "preview" ? "text-amber-300" :
                                  "text-zinc-500";
  const sev =
    result.severity === "critical" ? "text-red-300 bg-red-500/10 border-red-500/20" :
    result.severity === "high"     ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
    result.severity === "medium"   ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                                      "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
  return (
    <div className={`rounded-xl border ${result.status === "fail" ? "border-red-500/20 bg-red-500/[0.03]" : "border-white/[0.06] bg-white/[0.02]"} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 ${tone} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{result.title}</p>
            <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${sev}`}>{result.severity}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider border border-white/[0.08] bg-white/[0.04] text-zinc-400 rounded-full px-1.5 py-px">{result.scope.replace("_", " ")}</span>
            {result.provider && (
              <span className="text-[9px] font-bold uppercase tracking-wider border border-violet-500/20 bg-violet-500/10 text-violet-300 rounded-full px-1.5 py-px">{result.provider}</span>
            )}
            {result.source === "preview" && (
              <span className="text-[9px] font-bold uppercase tracking-wider border border-amber-500/25 bg-amber-500/10 text-amber-300 rounded-full px-1.5 py-px">preview</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">{result.description}</p>
          {result.evidence.length > 0 && (
            <p className="text-[10px] text-zinc-500 font-mono mt-1 truncate">evidence · {result.evidence.join(" · ")}</p>
          )}
          {result.remediation && (
            <p className="text-[11px] text-emerald-300/80 mt-1 leading-relaxed">→ {result.remediation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Public /status page — server-rendered. No auth required.
 *
 * Renders the typed PublicStatusReport with per-component verdict
 * + overall rollup. Same source the JSON endpoint exposes so probes
 * and humans see identical state.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicStatus, type StatusVerdict } from "@/lib/status/publicStatusBuilder";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status — Axiom Agent | Vision XIX Labs",
  description: "Public uptime + autonomy-loop health for the Axiom cross-cloud AGI ops platform.",
};

const TONE: Record<StatusVerdict, string> = {
  operational: "border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-200",
  degraded:    "border-amber-500/30 bg-amber-500/[0.05] text-amber-200",
  down:        "border-rose-500/30 bg-rose-500/[0.06] text-rose-200",
  unknown:     "border-zinc-500/30 bg-zinc-500/[0.04] text-zinc-300",
};

const ICON: Record<StatusVerdict, typeof CheckCircleIcon> = {
  operational: CheckCircleIcon,
  degraded:    ExclamationTriangleIcon,
  down:        XCircleIcon,
  unknown:     MinusCircleIcon,
};

const LABEL: Record<StatusVerdict, string> = {
  operational: "All systems operational",
  degraded:    "Partial degradation",
  down:        "Major outage",
  unknown:     "Status unknown",
};

export default async function StatusPage() {
  const report = await buildPublicStatus();
  const OverallIcon = ICON[report.overall];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200 relative overflow-hidden">
      {/* Restrained aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ambient-drift absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[440px] rounded-full bg-brand-violet/[0.06] blur-[140px]" />
        <div className="ambient-drift absolute top-[30%] right-[5%] w-[420px] h-[340px] rounded-full bg-brand-coral/[0.05] blur-[130px]" style={{ animationDelay: "-9s" }} />
        <div className="ambient-drift absolute bottom-0 left-[5%] w-[360px] h-[280px] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-15s" }} />
      </div>

      <header className="relative z-20 border-b border-white/[0.06] sticky top-0 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="font-bold text-white tracking-[-0.04em]">Axiom</Link>
          <Link href="/dashboard" className="text-[12px] text-zinc-300 hover:text-brand-coral transition-colors">Open dashboard →</Link>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="mono-label inline-flex items-center gap-3 mb-6">
          <span className="text-brand-coral/90 tabular-nums">ST</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Live status
        </p>

        <div className={`surface-frost rounded-3xl p-7 mb-8 flex items-start gap-5`}>
          <div className={`shrink-0 w-14 h-14 rounded-2xl border flex items-center justify-center ${TONE[report.overall]}`}>
            <OverallIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="mono-label mb-1">Overall</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight tracking-[-0.025em]">
              {LABEL[report.overall]}
            </h1>
            <p className="text-[11px] font-mono text-zinc-500 mt-2 tabular-nums">
              Last checked {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <p className="mono-label mb-4">Components · {report.components.length}</p>
        <div className="space-y-2 mb-10">
          {report.components.map((c) => {
            const CIcon = ICON[c.verdict];
            return (
              <div
                key={c.id}
                className={`surface-glass rounded-xl p-4 flex items-start gap-3 hover:border-brand-coral/15 transition-all`}
              >
                <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${TONE[c.verdict]}`}>
                  <CIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-[14px] font-semibold text-white tracking-tight">{c.label}</p>
                    <span className={`text-[9px] font-mono uppercase tracking-[0.18em] border rounded-full px-1.5 py-px ${TONE[c.verdict]}`}>
                      {c.verdict}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-zinc-400 leading-relaxed">{c.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-8 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-zinc-500">
          <p>
            JSON probe:{" "}
            <Link href="/api/status" className="text-brand-coral/85 hover:text-brand-coral transition-colors">/api/status</Link>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/docs/surfaces" className="hover:text-brand-coral transition-colors">Docs</Link>
            <Link href="/plans" className="hover:text-brand-coral transition-colors">Pricing</Link>
            <Link href="/changelog" className="hover:text-brand-coral transition-colors">Changelog</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

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
    <div className="min-h-screen bg-[#09090b] text-zinc-200 relative">
      <header className="border-b border-white/[0.06] sticky top-0 z-10 bg-[#09090b]/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="font-bold text-white tracking-[-0.04em]">Axiom</Link>
          <Link href="/dashboard" className="text-[12px] text-zinc-300 hover:text-white">Open dashboard →</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className={`rounded-3xl border ${TONE[report.overall]} p-6 mb-8 flex items-center gap-4`}>
          <OverallIcon className="h-8 w-8 shrink-0" />
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest opacity-70">// overall</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.04em] leading-tight">
              {LABEL[report.overall]}
            </h1>
            <p className="text-[11px] font-mono text-zinc-400 mt-1">
              Last checked {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-10">
          {report.components.map((c) => {
            const CIcon = ICON[c.verdict];
            return (
              <div
                key={c.id}
                className={`rounded-2xl border ${TONE[c.verdict]} p-4 flex items-start gap-3`}
              >
                <CIcon className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-[14px] font-semibold text-white">{c.label}</p>
                    <span className="text-[9px] font-mono uppercase tracking-widest opacity-70">
                      {c.verdict}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed opacity-90">{c.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[11px] font-mono text-zinc-500">
          <p>
            JSON probe endpoint:{" "}
            <Link href="/api/status" className="text-cyan-300 hover:text-cyan-200">/api/status</Link>
          </p>
          <p className="mt-1">
            Browse <Link href="/docs/surfaces" className="text-cyan-300 hover:text-cyan-200">docs</Link> · or{" "}
            <Link href="/pricing" className="text-cyan-300 hover:text-cyan-200">pricing</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

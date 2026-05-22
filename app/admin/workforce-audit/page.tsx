/**
 * /admin/workforce-audit — internal-only audit of the entire AI workforce.
 *
 * Renders BOTH layers (client + internal) so VisionXIXLabs admins see
 * the complete picture: duplicates, missing pieces, internal marketing/
 * sales agents that never surface to clients. Lives only inside
 * /admin/* — never visible at /dashboard/*.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  Squares2X2Icon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import {
  AGENT_WORKFORCE_REGISTRY,
  listInternalEngineers,
  workforceSummary,
  type AgentEngineer,
} from "@/lib/workforce/agentWorkforceRegistry";

export const metadata: Metadata = {
  title: "Workforce audit · VisionXIXLabs internal",
  description: "Complete audit of the AI workforce — both client-facing engineers and internal marketing/sales agents.",
};

export const dynamic = "force-dynamic";

export default function WorkforceAuditPage() {
  const summary = workforceSummary();
  const internal = listInternalEngineers();
  const withDuplicates = AGENT_WORKFORCE_REGISTRY.filter((e) => e.supersedes && e.supersedes.length > 0);
  const withMissing = AGENT_WORKFORCE_REGISTRY.filter((e) => e.missingPieces.length > 0);

  return (
    <div className="relative">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <UserGroupIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Workforce audit · internal</p>
          <span className="text-[9px] font-mono uppercase tracking-wider text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-full px-2 py-0.5">
            NOT visible to clients
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Full workforce audit.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Every engineer the platform ships across both layers, plus duplicates that were consolidated and implementation gaps still on the board.
        </p>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Total engineers"        value={summary.total} />
        <Stat label="Client-layer"           value={summary.clientLayer} />
        <Stat label="Internal-layer"         value={summary.internalLayer} />
        <Stat label="Open gaps"              value={summary.totalMissingPieces} />
      </section>

      {/* Duplicates */}
      <section className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-6">
        <header className="flex items-center gap-2 mb-3">
          <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Consolidated kernels ({withDuplicates.length})</p>
        </header>
        {withDuplicates.length === 0 ? (
          <p className="text-[12px] text-zinc-400">No duplicates flagged.</p>
        ) : (
          <ul className="space-y-2">
            {withDuplicates.map((e) => (
              <li key={e.id} className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
                <p className="text-[13px] font-semibold text-white">{e.displayName}</p>
                <p className="text-[10.5px] font-mono text-zinc-500">{e.id}</p>
                <ul className="mt-1 text-[11px] text-emerald-100/85 leading-snug list-disc list-inside marker:text-emerald-400/70">
                  {(e.supersedes ?? []).map((s) => <li key={s}>{s}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Open gaps */}
      <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5 mb-6">
        <header className="flex items-center gap-2 mb-3">
          <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">Implementation gaps ({withMissing.length} engineers · {summary.totalMissingPieces} items)</p>
        </header>
        <ul className="space-y-2">
          {withMissing.map((e) => (
            <li key={e.id} className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <p className="text-[12.5px] font-semibold text-white">{e.displayName}</p>
                <span className="text-[10px] font-mono text-zinc-500">{e.productLayer === "client" ? "client" : "internal"}</span>
              </div>
              <ul className="text-[11px] text-amber-100/85 leading-snug list-disc list-inside marker:text-amber-400/70">
                {e.missingPieces.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {/* Internal-only engineers */}
      <section className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5 mb-6">
        <header className="flex items-center gap-2 mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-violet-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">Internal-layer engineers ({internal.length})</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {internal.map((e) => <InternalEngineerCard key={e.id} engineer={e} />)}
        </div>
      </section>

      <p className="text-[10.5px] font-mono text-zinc-500 inline-flex items-center gap-1.5">
        <ArrowRightIcon className="h-3 w-3" />
        Client-facing engineers live at <Link href="/dashboard/workforce" className="text-violet-300 hover:text-violet-200 underline">/dashboard/workforce</Link>.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-[22px] font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

function InternalEngineerCard({ engineer }: { engineer: AgentEngineer }) {
  return (
    <article className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
      <header className="flex items-start justify-between gap-3 mb-1">
        <p className="text-[13px] font-semibold text-white">{engineer.displayName}</p>
        <span className="text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px text-rose-300 bg-rose-500/10 border-rose-500/30">internal</span>
      </header>
      <p className="text-[10.5px] font-mono text-zinc-500 mb-2">{engineer.department}</p>
      <p className="text-[11.5px] text-zinc-400 leading-snug">{engineer.role}</p>
      {engineer.missingPieces.length > 0 && (
        <ul className="mt-2 text-[10.5px] text-amber-100/85 leading-snug list-disc list-inside marker:text-amber-400/70">
          {engineer.missingPieces.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </article>
  );
}

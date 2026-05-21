/**
 * /dashboard/multi-cloud
 *
 * The multi-cloud operating view. Projects from the control plane state
 * — AWS / Azure / GCP side-by-side with connection status, scan status,
 * resource coverage, top findings, posture summaries, missing setup,
 * and next-best actions per provider.
 */

import Link from "next/link";
import {
  CloudIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";

import { buildControlPlaneState } from "@/lib/controlPlane/controlPlaneBuilder";

export const dynamic = "force-dynamic";

const PROVIDER_TONE = {
  aws:   "from-amber-500/20 via-amber-500/10 to-amber-500/5  border-amber-500/30",
  azure: "from-sky-500/20   via-sky-500/10   to-sky-500/5    border-sky-500/30",
  gcp:   "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5 border-emerald-500/30",
};

const STATUS_TONE = {
  healthy:  "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  warning:  "text-amber-300   bg-amber-500/10   border-amber-500/25",
  degraded: "text-rose-300    bg-rose-500/10    border-rose-500/25",
  preview:  "text-violet-300  bg-violet-500/10  border-violet-500/25",
  blocked:  "text-rose-300    bg-rose-500/10    border-rose-500/25",
  unknown:  "text-zinc-300    bg-zinc-500/10    border-zinc-500/25",
};

export default async function MultiCloudPage() {
  const state = await buildControlPlaneState();

  return (
    <div className="space-y-10">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-3">
          <CloudIcon className="h-4 w-4 text-cyan-300" />
          <span className="text-[10px] font-mono font-semibold text-cyan-300 uppercase tracking-[0.22em]">Multi-Cloud Operating View</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-[-0.04em] mb-2">
          One <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-amber-300 bg-clip-text text-transparent">multi-cloud</span> operating system.
        </h1>
        <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
          AWS, Azure, and GCP rendered side-by-side from the canonical control plane state. Every value carries its source mode and confidence. No console-bouncing required.
        </p>
      </header>

      {/* Cloud inventory headline */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total resources"  value={`${state.cloudInventory.totalResources}`} tone="text-violet-300" />
        <Kpi label="AWS resources"    value={`${state.cloudInventory.byProvider.aws}`} tone="text-amber-300"   />
        <Kpi label="Azure resources"  value={`${state.cloudInventory.byProvider.azure}`} tone="text-sky-300"   />
        <Kpi label="GCP resources"    value={`${state.cloudInventory.byProvider.gcp}`} tone="text-emerald-300" />
      </section>

      {/* Provider cards */}
      <section className="grid lg:grid-cols-3 gap-5">
        {state.providers.map((p) => (
          <div key={p.provider} className={`rounded-2xl border bg-gradient-to-br ${PROVIDER_TONE[p.provider]} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-white uppercase">{p.provider}</h2>
              <span className="text-[10px] font-mono text-zinc-400">mode · {p.mode}</span>
            </div>
            <div className="space-y-2 text-[11px] font-mono mb-4">
              <Row label="connection"   value={p.connectionStatus} />
              <Row label="validation"   value={p.validationStatus} />
              <Row label="scan"         value={p.scanStatus} />
              <Row label="source"       value={p.sourceMode} />
              <Row label="confidence"   value={`${(p.confidence * 100).toFixed(0)}%`} />
            </div>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.18em] mb-2">resource kinds</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(p.resourceCounts).map(([k, v]) => (
                <span key={k} className="text-[10px] font-mono text-zinc-300 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.05]">{k}: {v}</span>
              ))}
              {Object.keys(p.resourceCounts).length === 0 && <span className="text-[10px] text-zinc-500">No resource counts yet.</span>}
            </div>
            {p.topFindings.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.18em] mb-2">top finding</p>
                <p className="text-[11px] text-zinc-300">{p.topFindings[0].ruleCode} · risk {p.topFindings[0].risk}</p>
                <p className="text-[10px] text-zinc-500">{p.topFindings[0].resourceRef}</p>
              </div>
            )}
            {p.nextAction && (
              <Link href={p.nextAction.href ?? "/operator/onboarding"} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-violet-200">
                {p.nextAction.label} <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ))}
      </section>

      {/* Posture rail */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <PostureTile title="Security"    state={state.securityPosture} />
        <PostureTile title="Cost"        state={state.costPosture} />
        <PostureTile title="Reliability" state={state.reliabilityPosture} />
        <PostureTile title="Validation"  state={state.validationPosture} />
      </section>

      {/* Capability coverage */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
        <div className="flex items-center gap-2 mb-4">
          <CpuChipIcon className="h-4 w-4 text-violet-300" />
          <h2 className="text-base font-semibold text-white tracking-tight">Capability coverage by domain</h2>
        </div>
        <p className="text-[11px] text-zinc-500 mb-4">{state.sourceMode === "live" ? "Live signals across at least one provider." : "Preview mode — connect a provider to unlock live signals."}</p>
        <div className="grid md:grid-cols-3 gap-3">
          {state.providers.map((p) => (
            <div key={p.provider} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{p.provider}</p>
              {p.missingCapabilities.length === 0 ? (
                <p className="text-[11px] text-emerald-300">All canonical capabilities present.</p>
              ) : (
                <ul className="text-[11px] text-zinc-400 space-y-1">
                  {p.missingCapabilities.slice(0, 5).map((c) => <li key={c}>• {c}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Next-best actions */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <h2 className="text-base font-semibold text-white tracking-tight">Next best actions</h2>
        </div>
        <ul className="space-y-2">
          {state.nextBestActions.slice(0, 6).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                <p className="text-[11px] text-zinc-500 truncate">{a.description}</p>
              </div>
              <Link
                href={a.route ?? "/dashboard"}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-200 hover:text-white"
              >
                Open <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Honest footer */}
      <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <div className="flex items-center gap-2 mb-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
          <p className="text-[10px] font-mono text-amber-300 uppercase tracking-[0.22em]">Known limitations</p>
        </div>
        <ul className="space-y-1 text-xs text-zinc-300">
          <li>• AWS / Azure / GCP scanning runs in preview mode until broker credentials + live adapters are wired.</li>
          <li>• Cost + reliability posture are placeholders until Cost Explorer + backup / replica signals are integrated.</li>
          <li>• Multi-cloud apply is disabled platform-wide — see <Link href="/dashboard/orchestration" className="underline">Orchestration Center</Link> for the Terraform boundary.</li>
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{label}</p>
      <p className={`text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

function PostureTile({ title, state }: { title: string; state: { score: number; status: keyof typeof STATUS_TONE; summary: string; sourceMode: string } }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{title}</p>
      <div className="flex items-baseline gap-2 mb-2">
        <p className="text-2xl font-bold text-white">{state.score}</p>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${STATUS_TONE[state.status]}`}>{state.status}</span>
      </div>
      <p className="text-[11px] text-zinc-500 line-clamp-2">{state.summary}</p>
      <p className="text-[9px] font-mono text-zinc-600 mt-2 uppercase tracking-wider">source · {state.sourceMode}</p>
    </div>
  );
}


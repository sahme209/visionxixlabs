/**
 * /dashboard/multi-cloud
 *
 * The multi-cloud operating view. Projects from the control plane state
 * — AWS / Azure / GCP side-by-side with connection status, scan status,
 * resource coverage, top findings, posture summaries, missing setup,
 * and next-best actions per provider.
 */

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

import { buildControlPlaneState } from "@/lib/controlPlane/controlPlaneBuilder";
import { PageIntro } from "@/components/dashboard/PageIntro";

export const dynamic = "force-dynamic";

// Removed brand-color gradients on provider cards — the rainbow
// amber/sky/emerald row was the loudest thing on the page. Provider
// cards now share a single calm surface; the label in the header is
// the only differentiator.
const STATUS_TONE = {
  healthy:  "text-emerald-300",
  warning:  "text-amber-300",
  degraded: "text-rose-300",
  preview:  "text-zinc-400",
  blocked:  "text-rose-300",
  unknown:  "text-zinc-500",
};

export default async function MultiCloudPage() {
  const state = await buildControlPlaneState();

  return (
    <div className="space-y-10">
      <PageIntro
        kicker="Cloud operations"
        title={<>One multi-cloud <span className="text-zinc-500">operating system.</span></>}
        description="Connect AWS, Azure, or Google Cloud so Axiom can discover resources, check resilience, detect security risks, and prepare human-approved remediation plans."
        helps="Discover every resource across providers, compare posture side-by-side, and route findings to the right AI engineer."
        connectFirst="At least one cloud connector — AWS via CloudFormation, Azure via service principal, or GCP via Cloud Shell."
        engineers={["Cloud Engineer", "Security Engineer", "FinOps Engineer", "Incident Engineer"]}
        requiresApproval="Any write action (rightsizing, role change, policy edit). Read-only scans run without approval once a cloud is connected."
        actions={[
          { label: "Connect a cloud", href: "/dashboard/connect-cloud" },
          { label: "Run a read-only scan", href: "/dashboard/scheduled-scans" },
          { label: "View demo", href: "/demo" },
        ]}
        safetyNote="Read-only by default · Sessions are short-lived · Every action is audit-logged"
      />

      {/* Cloud inventory headline */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total resources"  value={`${state.cloudInventory.totalResources}`} />
        <Kpi label="AWS resources"    value={`${state.cloudInventory.byProvider.aws}`} />
        <Kpi label="Azure resources"  value={`${state.cloudInventory.byProvider.azure}`} />
        <Kpi label="GCP resources"    value={`${state.cloudInventory.byProvider.gcp}`} />
      </section>

      {/* Provider cards */}
      <section className="grid lg:grid-cols-3 gap-3">
        {state.providers.map((p) => (
          <div key={p.provider} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold tracking-tight text-white uppercase">{p.provider}</h2>
              <span className="text-[10px] font-mono text-zinc-500">mode · {p.mode}</span>
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
              <Link href={p.nextAction.href ?? "/dashboard/connect-cloud"} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-white">
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
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">capability coverage</p>
        <p className="text-[11px] text-zinc-500 mb-4">{state.sourceMode === "live" ? "Live signals across at least one provider." : "Preview mode — connect a provider to unlock live signals."}</p>
        <div className="grid md:grid-cols-3 gap-3">
          {state.providers.map((p) => (
            <div key={p.provider} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{p.provider}</p>
              {p.missingCapabilities.length === 0 ? (
                <p className="text-[11px] text-zinc-300">All canonical capabilities present.</p>
              ) : (
                <ul className="text-[11px] text-zinc-500 space-y-1">
                  {p.missingCapabilities.slice(0, 5).map((c) => <li key={c}>• {c}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Next-best actions */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">next best actions</p>
        <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
          {state.nextBestActions.slice(0, 6).map((a) => (
            <li key={a.id}>
              <Link
                href={a.route ?? "/dashboard"}
                className="group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/[0.015] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white truncate">{a.title}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{a.description}</p>
                </div>
                <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Known limitations — quiet, not loud */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-2">known limitations</p>
        <ul className="space-y-1 text-[12px] text-zinc-500">
          <li>· AWS / Azure / GCP scanning runs in preview mode until broker credentials + live adapters are wired.</li>
          <li>· Cost + reliability posture are placeholders until Cost Explorer + backup / replica signals are integrated.</li>
          <li>· Multi-cloud apply is disabled platform-wide — see <Link href="/dashboard/orchestration" className="text-zinc-300 hover:text-white underline">Orchestration Center</Link> for the Terraform boundary.</li>
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{label}</p>
      <p className="text-3xl font-semibold text-white tracking-[-0.02em]">{value}</p>
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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{title}</p>
      <div className="flex items-baseline gap-2 mb-2">
        <p className="text-2xl font-semibold text-white tracking-[-0.02em]">{state.score}</p>
        <span className={`text-[10px] font-mono ${STATUS_TONE[state.status]}`}>· {state.status}</span>
      </div>
      <p className="text-[11px] text-zinc-500 line-clamp-2">{state.summary}</p>
      <p className="text-[9px] font-mono text-zinc-600 mt-2 uppercase tracking-wider">source · {state.sourceMode}</p>
    </div>
  );
}


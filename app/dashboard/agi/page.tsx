"use client";

/**
 * /dashboard/agi — AGI Cockpit.
 *
 * Single-pane mission control rolling up every closed-loop signal:
 *
 *   Telemetry → Incident → Risk → Priority → Simulation → Policy →
 *   Approval → Boundary → Execute → Verify → Audit.
 *
 * Honest sourceMode pills. Pure read-only. No fabricated numbers.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  BoltIcon,
  ServerStackIcon,
  CurrencyDollarIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";

interface SummaryEnvelope<T> { ok?: boolean; data?: T; error?: { userMessage?: string } }

export default function AgiCockpitPage() {
  const [billing, setBilling] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [incidents, setIncidents] = useState<any>(null);
  const [closedLoop, setClosedLoop] = useState<any>(null);
  const [autonomy, setAutonomy] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/billing", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/telemetry", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/incidents", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/closed-loop", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/autonomy/cycle", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: "{}" }).then((r) => r.json()),
    ]).then(([b, t, i, c, a]: SummaryEnvelope<unknown>[]) => {
      if (cancelled) return;
      if (b.ok) setBilling(b.data); else setError(b.error?.userMessage ?? null);
      if (t.ok) setTelemetry(t.data);
      if (i.ok) setIncidents(i.data);
      if (c.ok) setClosedLoop(c.data);
      if (a.ok) setAutonomy(a.data);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Network error.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-90 pointer-events-none" style={{ background: "radial-gradient(900px 320px at 12% 0%, rgba(139,92,246,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.08), transparent 60%), radial-gradient(600px 240px at 50% 100%, rgba(99,102,241,0.06), transparent 60%)" }} aria-hidden />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <CpuChipIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              AGI Cockpit · every signal · every gate · every loop
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          One pane. <span className="text-gradient">Every closed loop.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Telemetry · Incident · Risk · Priority · Simulation · Policy · Approval · Boundary · Execute · Verify · Audit. The view is read-only by construction; every safety contract literal is enforced at the TypeScript level.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 flex items-center gap-3">
          <ArrowPathIcon className="h-4 w-4 text-violet-300 animate-spin" />
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing AGI cockpit…</p>
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-1">// cockpit partial</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Lane row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            <Lane
              icon={CurrencyDollarIcon}
              title="Billing connectors"
              subtitle="AWS Cost Explorer / Azure Cost Mgmt / GCP Billing / GitHub / Stripe / Vercel"
              contract="billing_summary_read_only"
              sourceMode={billing?.overallSourceMode ?? "preview"}
              stats={[
                ["Providers", billing?.summary?.providerCount ?? "—"],
                ["Live", billing?.summary?.liveProviderCount ?? "—"],
                ["Anomalies", billing?.summary?.anomaliesTotal ?? "—"],
                ["Critical", billing?.summary?.anomaliesCritical ?? "—"],
              ]}
              href="/dashboard/finops"
            />
            <Lane
              icon={SignalIcon}
              title="Telemetry ingest"
              subtitle="CloudWatch / X-Ray / Azure Monitor / GCP / Datadog / Grafana / Prometheus / Sentry / NR / OTel"
              contract="telemetry_ingest_read_only"
              sourceMode={telemetry?.overallSourceMode ?? "preview"}
              stats={[
                ["Providers", telemetry?.summary?.providerCount ?? "—"],
                ["Live", telemetry?.summary?.liveProviderCount ?? "—"],
                ["Signals", telemetry?.summary?.signalsTotal ?? "—"],
                ["Critical", telemetry?.summary?.signalsBySeverity?.critical ?? "—"],
              ]}
              href="/dashboard/risks"
            />
            <Lane
              icon={ExclamationTriangleIcon}
              title="Incident response"
              subtitle="PagerDuty / Opsgenie / Slack / Teams / VictorOps / xMatters / Discord"
              contract="incident_response_read_only"
              sourceMode={incidents?.overallSourceMode ?? "preview"}
              stats={[
                ["Providers", incidents?.summary?.providerCount ?? "—"],
                ["Open", incidents?.summary?.openCount ?? "—"],
                ["P1", incidents?.summary?.p1Count ?? "—"],
                ["Total", incidents?.summary?.incidentsTotal ?? "—"],
              ]}
              href="/dashboard/risks"
            />
            <Lane
              icon={ArrowPathIcon}
              title="Closed-loop remediation"
              subtitle="Verifies after-state with INDEPENDENT telemetry · never same-agent verification"
              contract="closed_loop_remediation_gated"
              sourceMode={closedLoop?.overallSourceMode ?? "preview"}
              stats={[
                ["Records", closedLoop?.summary?.total ?? "—"],
                ["Verified", closedLoop?.summary?.verifiedSuccess ?? "—"],
                ["Pending", closedLoop?.summary?.pendingVerification ?? "—"],
                ["Rolled back", closedLoop?.summary?.rolledBack ?? "—"],
              ]}
              href="/dashboard/autonomy"
            />
          </div>

          {/* Autonomy cycle summary */}
          {autonomy && (
            <div className="rounded-2xl border border-violet-500/15 bg-white/[0.015] p-5 mb-6">
              <div className="flex items-start gap-3">
                <BoltIcon className="h-5 w-5 text-violet-300 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-mono text-violet-300/80 uppercase tracking-[0.18em] mb-1">// last autonomy cycle ({autonomy.charter?.mode ?? "observer"})</p>
                  <p className="text-[13px] text-white font-semibold leading-snug mb-2">{autonomy.cycleStatus?.replace(/_/g, " ") ?? "—"}</p>
                  <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                    <Mini label="Considered" value={autonomy.summary?.candidatesConsidered ?? 0} />
                    <Mini label="Deferred"   value={autonomy.summary?.candidatesDeferred ?? 0} />
                    <Mini label="Packets"    value={autonomy.summary?.approvalPacketsPrepared ?? 0} />
                    <Mini label="Handed off" value={autonomy.summary?.executionsHandedOff ?? 0} />
                    <Mini label="Verified"   value={autonomy.summary?.verifiedComplete ?? 0} />
                    <Mini label="Halted"     value={autonomy.summary?.haltedAtGate ?? 0} />
                    <Mini label="Errored"    value={autonomy.summary?.erroredCount ?? 0} />
                  </div>
                  <Link href="/dashboard/autonomy" className="mt-3 inline-flex items-center gap-1 text-[12px] text-white hover:text-violet-100">
                    Open Autonomy Cockpit <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Contract */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// AGI cockpit contracts</p>
              <p className="text-[12px] text-zinc-300 leading-relaxed">
                Every lane carries a literal safety contract enforced at the TypeScript level. The cockpit composes — it never executes. Mutations always route through the Autonomy Loop → Policy → Boundary → Desktop runtime path.
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {["billing_summary_read_only", "telemetry_ingest_read_only", "incident_response_read_only", "closed_loop_remediation_gated", "autonomy_gated_no_unsafe_execution"].map((c) => (
                  <code key={c} className="font-mono text-[10px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-0.5 text-emerald-200">{c}</code>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Lane({
  icon: Icon, title, subtitle, contract, sourceMode, stats, href,
}: {
  icon: typeof CpuChipIcon;
  title: string;
  subtitle: string;
  contract: string;
  sourceMode: string;
  stats: [string, string | number][];
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="h-4 w-4 text-white/70 shrink-0" />
            <p className="text-[13px] font-semibold text-white tracking-tight">{title}</p>
            <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
              sourceMode === "live" ? "bg-emerald-500/15 text-emerald-300" :
              sourceMode === "partial_live" ? "bg-cyan-500/15 text-cyan-300" :
              "bg-white/15 text-zinc-300"
            }`}>{sourceMode.replace(/_/g, " ")}</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-snug">{subtitle}</p>
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-300 hover:text-white">
          open <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        {stats.map(([label, value]) => (<Mini key={label} label={label} value={value} />))}
      </div>
      <p className="text-[9px] font-mono text-zinc-500">
        contract: <code className="bg-black/30 border border-white/[0.06] rounded px-1.5 py-0.5 text-emerald-200/80">{contract}</code>
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/[0.04] bg-white/[0.015] p-2">
      <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-[14px] font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}

/**
 * /dashboard/alerts — native alerting engine landing page.
 *
 * Lists alert rules + recent alert events for the workspace. Today the
 * page renders the layout + empty states — rule editor and persistence
 * land in a follow-up phase. No fake alerts are shown to fresh tenants.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  BellAlertIcon,
  PlusCircleIcon,
  ArrowRightIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { getTenantFreshness } from "@/lib/platform/tenantFreshness";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";

export const metadata: Metadata = {
  title: "Alerts · Axiom",
  description:
    "Native alert rule engine — define rules, see active alerts, watch SLO burn, route to channels of your choice.",
};

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const freshness = await getTenantFreshness();
  const isFresh = freshness.freshTenant;

  return (
    <div className="relative">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <BellAlertIcon className="h-4 w-4 text-zinc-400" />
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Alerts</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Native alert engine — <span className="text-gradient">no false confidence.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Rules attach to Services, fire on real signal, and route to channels you approve. Anomaly detection runs in the background; the AI noise-reducer suppresses duplicates before you ever see them.
        </p>
      </div>

      {isFresh && (
        <div className="mb-8">
          <TenantEmptyState
            icon={<BellAlertIcon className="h-5 w-5" />}
            tone="cyan"
            eyebrow="No alert rules yet"
            title="Wire a telemetry source, then define rules against it."
            description="Alerts attach to Services in the catalog. Once you connect AWS CloudWatch, Grafana, Datadog, or our native pingers, the rule editor lets you compose metric-threshold, log-pattern, or anomaly-detector rules with channel routing and auto-incident promotion."
            agiNote="AGI prunes noisy rules automatically and proposes new ones based on observed signal — you stay in control via the approval queue."
            actions={[
              { href: "/dashboard/observability",    label: "Connect a telemetry source", variant: "primary" },
              { href: "/dashboard/connector-store",  label: "Open Connector Store",        variant: "ghost" },
            ]}
          />
        </div>
      )}

      {/* Two-lane preview: rules + recent events */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-8">
        <article className="surface-glass rounded-2xl p-5 flex flex-col">
          <header className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CpuChipIcon className="h-4 w-4 text-zinc-300" />
              <p className="text-[12px] font-semibold text-white">Alert rules</p>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">0 configured</span>
          </header>
          <div className="flex-1 rounded-lg border border-white/[0.04] bg-black/30 p-4 text-center flex items-center justify-center">
            <p className="text-[12px] text-zinc-500 leading-snug">
              Rules show here once you create them. Each rule defines a trigger, severity, scope (service / source / org), and routing.
            </p>
          </div>
          <button
            className="mt-3 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-white/15 text-zinc-100 border border-white/30 hover:bg-white/25 transition disabled:opacity-50"
            disabled
            title="Rule editor lands in the next phase."
          >
            <PlusCircleIcon className="h-3.5 w-3.5" />
            New rule — coming next phase
          </button>
        </article>

        <article className="surface-glass rounded-2xl p-5 flex flex-col">
          <header className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-rose-300" />
              <p className="text-[12px] font-semibold text-white">Recent alert events</p>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">0 in 24h</span>
          </header>
          <div className="flex-1 rounded-lg border border-white/[0.04] bg-black/30 p-4 text-center flex items-center justify-center">
            <p className="text-[12px] text-zinc-500 leading-snug">
              Firing alerts, ack'd alerts, and resolved alerts land here with severity, evidence, and recommended next action.
            </p>
          </div>
        </article>
      </section>

      {/* Capability strip — what the alert engine does */}
      <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 mb-8">
        <p className="text-[10px] font-semibold text-zinc-300 uppercase tracking-widest mb-3">// alert engine capabilities</p>
        <ul className="grid sm:grid-cols-2 gap-2 text-[12px] text-zinc-300">
          {[
            ["Metric threshold rules",       "Composed against any metric series — native or connector."],
            ["Log pattern rules",            "Match redacted patterns against log streams."],
            ["Anomaly detector rules",       "Backed by the anomaly kernel — no manual threshold needed."],
            ["Security finding rules",       "Promote critical scanner findings to incidents."],
            ["Connector health rules",       "Fire when a connector itself goes unhealthy."],
            ["Scheduled probes",             "Cron-style health checks against any URL or query."],
            ["Multi-channel routing",        "In-app · Email · Slack · Teams · SMS · Webhook · PagerDuty · Opsgenie."],
            ["Auto-incident promotion",      "When severity ≥ critical, an Incident opens automatically."],
            ["Suppression + dedup",          "Same root cause → one alert, not ten."],
            ["AI noise reducer",             "Learns which alerts your team consistently ack — proposes muting."],
          ].map(([q, a]) => (
            <li key={q} className="flex items-start gap-2">
              <CheckCircleIcon className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <span><span className="font-semibold text-zinc-100">{q}</span> <span className="text-zinc-400">— {a}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <Link href="/dashboard/observability" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/25 transition-colors">
          <SignalIcon className="h-4 w-4 text-zinc-400 mb-2" />
          <p className="text-sm font-semibold text-white">Observability</p>
          <p className="text-[11px] text-zinc-500 mt-1">Telemetry sources + service health.</p>
        </Link>
        <Link href="/dashboard/incidents" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/25 transition-colors">
          <ExclamationTriangleIcon className="h-4 w-4 text-zinc-400 mb-2" />
          <p className="text-sm font-semibold text-white">Incidents</p>
          <p className="text-[11px] text-zinc-500 mt-1">Where critical alerts get promoted.</p>
        </Link>
        <Link href="/dashboard/audit" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/25 transition-colors">
          <DocumentTextIcon className="h-4 w-4 text-zinc-400 mb-2" />
          <p className="text-sm font-semibold text-white">Audit log</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every alert action recorded.</p>
        </Link>
      </section>

      <p className="mt-6 text-[10px] font-mono text-zinc-500 inline-flex items-center gap-1.5">
        <ArrowRightIcon className="h-3 w-3" />
        Rule editor + persistence ship in the next phase.
      </p>
    </div>
  );
}

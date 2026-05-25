/**
 * /dashboard/observability — native observability landing page.
 *
 * First sight of the platform's native observability module. When the
 * tenant has no telemetry sources connected, we show a calm empty
 * state with the canonical connector + native-pinger choices. Once
 * sources land, this page renders the service health grid, active
 * alerts, recent incidents, and the AI sitrep.
 *
 * Today the native ingestion + dashboard models are typed-only —
 * persistence lands in a follow-up phase. The empty state here is the
 * stable destination every connector setup wizard points at.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  SignalIcon,
  CloudIcon,
  ServerStackIcon,
  ChartBarSquareIcon,
  BoltIcon,
  ComputerDesktopIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { getTenantFreshness } from "@/lib/platform/tenantFreshness";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";
import { PageIntro } from "@/components/dashboard/PageIntro";

export const metadata: Metadata = {
  title: "Observability · Axiom",
  description:
    "Native service health, alerts, traces, and dashboards — backed by your connected cloud, source-control, and observability tools.",
};

export const dynamic = "force-dynamic";

interface SourceOption {
  id: string;
  name: string;
  kind: "connector" | "native";
  status: "live" | "planned";
  category: string;
  description: string;
  eta?: string;
}

const SOURCE_OPTIONS: readonly SourceOption[] = [
  // Live cloud connectors (already shipped in this workspace)
  { id: "aws-cloudwatch",  name: "AWS CloudWatch",      kind: "connector", status: "live",    category: "Cloud-native logs + metrics", description: "Reads CloudWatch metrics + logs from the connected AWS account." },
  { id: "azure-monitor",   name: "Azure Monitor",       kind: "connector", status: "live",    category: "Cloud-native logs + metrics", description: "Reads Azure Monitor metrics + Log Analytics workspaces." },
  { id: "gcp-monitoring",  name: "Google Cloud Monitoring", kind: "connector", status: "live", category: "Cloud-native logs + metrics", description: "Reads GCP Cloud Monitoring metrics + Cloud Logging." },
  // Planned external observability connectors
  { id: "dynatrace",       name: "Dynatrace",           kind: "connector", status: "planned", category: "External observability", description: "Full-stack APM. Read services, problems, traces.", eta: "Q3 2026" },
  { id: "grafana",         name: "Grafana",             kind: "connector", status: "planned", category: "External observability", description: "Mirror dashboards + alert rules.",                    eta: "Q3 2026" },
  { id: "datadog",         name: "Datadog",             kind: "connector", status: "planned", category: "External observability", description: "APM + logs + metrics + RUM.",                          eta: "Q3 2026" },
  { id: "prometheus",      name: "Prometheus",          kind: "connector", status: "planned", category: "External observability", description: "Federated queries + recording-rule mirror.",            eta: "Q4 2026" },
  { id: "new-relic",       name: "New Relic",           kind: "connector", status: "planned", category: "External observability", description: "Entity catalog + NRQL.",                                eta: "Q4 2026" },
  { id: "splunk",          name: "Splunk",              kind: "connector", status: "planned", category: "External logging",       description: "SPL searches + saved-alert mirror.",                    eta: "Q4 2026" },
  // Native (no external tool needed)
  { id: "native-pinger",   name: "Native HTTP pinger",  kind: "native",    status: "planned", category: "Native ingestion",       description: "Built-in scheduled probe — point at any URL.",          eta: "Q3 2026" },
  { id: "native-desktop",  name: "Desktop agent",       kind: "native",    status: "planned", category: "Native ingestion",       description: "macOS / Win / Linux local logs + machine posture.",      eta: "Q3 2026" },
  { id: "native-webhook",  name: "Webhook ingest",      kind: "native",    status: "planned", category: "Native ingestion",       description: "Push your own metrics / events to /api/telemetry/ingest.", eta: "Q3 2026" },
];

export default async function ObservabilityPage() {
  const freshness = await getTenantFreshness();
  const hasAnything = !freshness.freshTenant;

  return (
    <div className="relative">
      <PageIntro
        kicker="Operations · observability"
        title={<>Native service health, <span className="text-zinc-500">honestly sourced.</span></>}
        description="Connect your existing observability tools, ingest cloud-native telemetry, or run our built-in pingers and desktop agent. Every signal carries a source-of-truth pill so you always know where it came from."
        helps="See service health, error budgets, and SLO breaches across every connected source in one place."
        connectFirst="Grafana, Datadog, Prometheus, or Dynatrace — or rely on cloud-native CloudWatch / Azure Monitor / GCP Cloud Monitoring once a cloud connector is wired."
        engineers={["Monitoring Engineer", "Incident Engineer", "SRE / On-call"]}
        requiresApproval="Alert routing edits, SLO definition changes, on-call rotation updates."
        actions={[
          { label: "Connect a monitoring source", href: "/dashboard/connectors" },
          { label: "View incidents", href: "/dashboard/incidents" },
        ]}
        safetyNote="Read-only ingestion · Every signal labeled with source mode + freshness"
      />

      {!hasAnything && (
        <div className="mb-8">
          <TenantEmptyState
            icon={<SignalIcon className="h-5 w-5" />}
            tone="cyan"
            eyebrow="No telemetry yet"
            title="Wire up a source to see service health."
            description="Pick a path below. Cloud-native is fastest (uses the AWS / Azure / GCP credentials you've already connected). External observability tools land in the queue and follow. Native pingers + the desktop agent need no third party at all."
            agiNote="AGI starts producing recommendations the moment telemetry arrives — anomaly detection, alert deduplication, and incident clustering run automatically on top of the raw signal."
            actions={[
              { href: "/dashboard/connectors", label: "Open Connector Hub", variant: "primary" },
              { href: "/download",             label: "Download desktop agent", variant: "ghost" },
            ]}
          />
        </div>
      )}

      {/* Source options grid — visible to both fresh and connected tenants. */}
      <section className="mb-8">
        <h2 className="text-[13px] font-semibold text-zinc-200 mb-3">Telemetry source options</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {SOURCE_OPTIONS.map((s) => {
            const Icon = pickIcon(s);
            return (
              <article key={s.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col">
                <header className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 text-cyan-300 shrink-0" />
                    <p className="text-[13px] font-semibold text-white truncate">{s.name}</p>
                  </div>
                  <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px whitespace-nowrap ${
                    s.status === "live"
                      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                      : "text-zinc-400 bg-white/[0.04] border-white/[0.10]"
                  }`}>
                    {s.status === "live" ? "Live" : s.eta ?? "Planned"}
                  </span>
                </header>
                <p className="text-[11.5px] text-zinc-400 leading-snug mb-3 flex-1">{s.description}</p>
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  <span>{s.kind === "native" ? "native" : "connector"}</span>
                  <span>{s.category}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Capability roadmap — what this module will surface once telemetry lands. */}
      <section className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.03] p-5">
        <header className="flex items-center gap-2 mb-3">
          <CpuChipIcon className="h-4 w-4 text-cyan-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">What lands here next</p>
        </header>
        <ul className="grid sm:grid-cols-2 gap-2 text-[12px] text-zinc-300">
          {ROADMAP_ITEMS.map((item) => (
            <li key={item.label} className="flex items-start gap-2">
              <ArrowRightIcon className="h-3 w-3 text-cyan-400 shrink-0 mt-1" />
              <span><span className="font-semibold text-zinc-100">{item.label}</span> <span className="text-zinc-400">— {item.detail}</span></span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-zinc-500 mt-4">
          AI agents (anomaly detection, alert noise reducer, root-cause weaver, postmortem drafter) are already wired and will operate over whichever sources you connect.
        </p>
      </section>

      <section className="mt-8 grid sm:grid-cols-3 gap-3">
        <Link href="/dashboard/audit" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-cyan-500/25 transition-colors">
          <ChartBarSquareIcon className="h-4 w-4 text-cyan-400 mb-2" />
          <p className="text-sm font-semibold text-white">Audit log</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every observable action recorded.</p>
        </Link>
        <Link href="/dashboard/security" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-cyan-500/25 transition-colors">
          <ExclamationTriangleIcon className="h-4 w-4 text-cyan-400 mb-2" />
          <p className="text-sm font-semibold text-white">Security center</p>
          <p className="text-[11px] text-zinc-500 mt-1">Posture + findings + compliance.</p>
        </Link>
        <Link href="/dashboard/reliability" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-cyan-500/25 transition-colors">
          <BoltIcon className="h-4 w-4 text-cyan-400 mb-2" />
          <p className="text-sm font-semibold text-white">Reliability</p>
          <p className="text-[11px] text-zinc-500 mt-1">Circuits, retries, recovery.</p>
        </Link>
      </section>
    </div>
  );
}

const ROADMAP_ITEMS: readonly { label: string; detail: string }[] = [
  { label: "Service health grid",     detail: "Tier-1 services up / degraded / down at a glance." },
  { label: "Alert rules + history",   detail: "Native rule engine with operator-approval-gated channels." },
  { label: "Incident timeline",       detail: "Auto-built from alerts + deploys + agent signals." },
  { label: "Dashboard builder",       detail: "Compose metric, log, trace, and alert panels per service." },
  { label: "SLO + error budget",      detail: "Set targets, watch burn rate, get auto-alerts at 50/75/90%." },
  { label: "Root-cause overlay",      detail: "AI-suggested likely cause with linked evidence." },
];

function pickIcon(s: SourceOption) {
  if (s.id.startsWith("aws"))   return CloudIcon;
  if (s.id.startsWith("azure")) return CloudIcon;
  if (s.id.startsWith("gcp"))   return CloudIcon;
  if (s.kind === "native" && s.id.includes("desktop")) return ComputerDesktopIcon;
  if (s.kind === "native")      return ServerStackIcon;
  return SignalIcon;
}

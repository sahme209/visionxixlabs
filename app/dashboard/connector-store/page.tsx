/**
 * /dashboard/connector-store — one-click connector marketplace.
 *
 * Engineer-facing grid of every connector in the registry, grouped by
 * category, with a one-click Connect button per card. Live connectors
 * land you in the proper setup flow (OAuth redirect / paste form / IAM
 * role / desktop pairing / webhook). Planned connectors expose a
 * "Notify me" CTA.
 *
 * Today the Connect button still routes through the env-var-based
 * admin test endpoints — the per-tenant credential vault lands in a
 * follow-up phase. The UI is stable so callers don't have to change.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  CloudIcon,
  CodeBracketIcon,
  ChatBubbleLeftRightIcon,
  ServerStackIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  SignalIcon,
  CircleStackIcon,
  ComputerDesktopIcon,
  BellAlertIcon,
  DocumentTextIcon,
  KeyIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { CONNECTOR_REGISTRY, type ConnectorCategory, type ConnectorRecord } from "@/lib/connectors/connectorRegistry";
import { describeOneClick } from "@/lib/platform/oneClickConnectorMap";

export const metadata: Metadata = {
  title: "Connector store · Axiom",
  description:
    "One-click connect — cloud, source control, observability, security, incidents, messaging. Browse, connect, manage.",
};

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: readonly ConnectorCategory[] = [
  "cloud", "observability", "logging", "security_posture",
  "repository", "ci_cd", "iac",
  "incident", "ticketing", "messaging",
  "database", "container", "edge",
  "desktop", "audit", "identity",
];

const CATEGORY_META: Record<ConnectorCategory, { label: string; description: string; icon: typeof CloudIcon; tone: string }> = {
  cloud:            { label: "Cloud",                 description: "AWS, Azure, GCP — inventory, security posture, cost.",         icon: CloudIcon,             tone: "text-amber-300" },
  observability:    { label: "Observability",         description: "Dynatrace, Grafana, Prometheus, Datadog, New Relic.",            icon: SignalIcon,            tone: "text-cyan-300" },
  logging:          { label: "Logging",               description: "Splunk + cloud-native log streams.",                              icon: DocumentTextIcon,      tone: "text-cyan-300" },
  security_posture: { label: "Security posture",      description: "Wiz, Snyk, Prisma Cloud, CrowdStrike.",                           icon: ShieldCheckIcon,       tone: "text-emerald-300" },
  repository:       { label: "Source control",        description: "GitHub, GitLab.",                                                  icon: CodeBracketIcon,       tone: "text-violet-300" },
  ci_cd:            { label: "CI/CD",                 description: "Azure DevOps, Jenkins.",                                          icon: PuzzlePieceIcon,       tone: "text-violet-300" },
  iac:              { label: "Infrastructure-as-code", description: "Terraform.",                                                      icon: ServerStackIcon,       tone: "text-violet-300" },
  incident:         { label: "Incident response",     description: "PagerDuty, Opsgenie.",                                            icon: BellAlertIcon,         tone: "text-rose-300" },
  ticketing:        { label: "Ticketing / ITSM",      description: "Jira, Linear, ServiceNow.",                                       icon: PuzzlePieceIcon,       tone: "text-fuchsia-300" },
  messaging:        { label: "Messaging",             description: "Slack, Microsoft Teams.",                                         icon: ChatBubbleLeftRightIcon, tone: "text-fuchsia-300" },
  database:         { label: "Databases",             description: "Postgres, MySQL, Mongo, Redis — schema + slow-query analysis.",   icon: CircleStackIcon,        tone: "text-blue-300" },
  container:        { label: "Containers",            description: "Kubernetes, Docker.",                                              icon: ServerStackIcon,        tone: "text-blue-300" },
  edge:             { label: "Edge / DNS",            description: "Cloudflare-style edge + DNS connectors.",                          icon: SignalIcon,             tone: "text-cyan-300" },
  desktop:          { label: "Desktop runtime",        description: "Pair our macOS / Win / Linux app for local execution.",          icon: ComputerDesktopIcon,    tone: "text-violet-300" },
  audit:            { label: "Audit + export",        description: "SIEM webhook + JSON/CSV/NDJSON exports of the audit trail.",      icon: DocumentTextIcon,       tone: "text-zinc-300" },
  identity:         { label: "Identity",              description: "SSO + SCIM — Okta, Auth0, Microsoft Entra (planned).",            icon: KeyIcon,                tone: "text-emerald-300" },
};

export default function ConnectorStorePage() {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    meta: CATEGORY_META[category],
    records: CONNECTOR_REGISTRY.filter((c) => c.category === category),
  })).filter((g) => g.records.length > 0);

  const liveCount = CONNECTOR_REGISTRY.filter((c) => c.status === "live" || c.status === "preview").length;
  const plannedCount = CONNECTOR_REGISTRY.filter((c) => c.status === "planned" || c.status === "expanding").length;

  return (
    <div className="relative">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <PuzzlePieceIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Connector store</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Connect everything. <span className="text-gradient">One click.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Every cloud, observability tool, security scanner, incident system, source-control host, and chat tool you already use — wired to your workspace in seconds. Cancel anytime, scoped per workspace, audit-logged on every action.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1">
            {liveCount} live now
          </span>
          <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 text-zinc-300 px-2.5 py-1">
            {plannedCount} on roadmap
          </span>
        </div>
      </div>

      {/* Category groups */}
      <div className="space-y-10">
        {groups.map(({ category, meta, records }) => {
          const Icon = meta.icon;
          return (
            <section key={category}>
              <header className="flex flex-wrap items-baseline gap-3 mb-3">
                <span className={`inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1`}>
                  <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-200">{meta.label}</span>
                </span>
                <p className="text-[12px] text-zinc-500">{meta.description}</p>
                <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-zinc-500">{records.length}</span>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {records.map((r) => (
                  <ConnectorCard key={r.id} record={r} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-12 rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5 flex items-start gap-3">
        <SparklesIcon className="h-5 w-5 text-violet-300 mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-violet-100 leading-snug">Don't see what you need?</p>
          <p className="text-[12px] text-zinc-300 mt-1 leading-relaxed">
            Tell us which connector to ship next.
            We prioritize the registry based on customer demand — every request joins the public roadmap with an ETA. The native ingestion path (HTTP pinger, webhook ingest, desktop agent) also lets you wire anything that speaks HTTP without waiting on a dedicated connector.
          </p>
          <Link href="/contact?ref=connector-request" className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-violet-300 hover:text-violet-200">
            Request a connector <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function ConnectorCard({ record }: { record: ConnectorRecord }) {
  const one = describeOneClick(record);
  const isLive = record.status === "live" || record.status === "preview";

  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col hover:border-violet-500/30 transition">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{record.name}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">{record.authModel.replace(/_/g, " ")}</p>
        </div>
        <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px whitespace-nowrap ${
          record.status === "live"      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" :
          record.status === "preview"   ? "text-cyan-300    bg-cyan-500/10    border-cyan-500/30"    :
          record.status === "expanding" ? "text-cyan-300    bg-cyan-500/10    border-cyan-500/30"    :
                                          "text-zinc-400    bg-white/[0.04]   border-white/[0.10]"
        }`}>
          {isLive ? "Live" : record.eta ?? "Planned"}
        </span>
      </header>

      <p className="text-[11.5px] text-zinc-400 leading-snug mb-3 flex-1">{record.description}</p>

      <div className="mb-3 text-[10.5px] font-mono text-zinc-500 leading-snug">
        <span className="text-emerald-300/80">reads:</span> {record.reads.slice(0, 2).join(", ")}
        {record.reads.length > 2 && <span className="text-zinc-500"> · +{record.reads.length - 2} more</span>}
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto">
        {one.ready ? (
          <Link
            href={record.setupRoute ?? "/dashboard/connectors"}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/30 hover:bg-violet-500/25 transition"
          >
            <CheckCircleIcon className="h-3.5 w-3.5" />
            {one.buttonLabel}
          </Link>
        ) : (
          <Link
            href={`/contact?ref=connector-${record.id}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-white/[0.04] text-zinc-200 border border-white/[0.08] hover:bg-white/[0.08] transition"
          >
            {one.buttonLabel}
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        )}
        {record.docsRoute && (
          <Link href={record.docsRoute} className="text-[11px] text-zinc-400 hover:text-zinc-200 transition">
            Docs
          </Link>
        )}
      </div>

      <p className="mt-2 text-[10px] text-zinc-500 leading-snug">{one.buttonHelper}</p>
    </article>
  );
}

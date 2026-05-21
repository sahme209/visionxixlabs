/**
 * /dashboard/connectors — the connector hub.
 *
 * Inventory of every connector the platform speaks to today (plus a
 * planned section so buyers can see what's coming). Each card shows
 * connection state, category, auth method, what data it reads, what
 * actions it can perform, and the audit / boundary guarantees.
 *
 * Connection state on this page is currently a static catalog —
 * surface intent + audit truth, not live state. Live state will
 * arrive when this page is rewired to read from the Connector
 * registry (see lib/connectors/connectorRegistry.ts) and per-tenant
 * `CloudAccount` rows from Prisma.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  CloudIcon,
  CodeBracketIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  ServerStackIcon,
  CircleStackIcon,
  CommandLineIcon,
  PuzzlePieceIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import {
  getLiveConnectorState,
  relativeTime,
} from "@/lib/platform/livePlatformState";
import { LiveBadge } from "@/components/platform/LiveBadge";

export const metadata: Metadata = {
  title: "Connectors · Axiom",
  description:
    "Every connector Axiom integrates with — cloud, source control, communication, observability, databases, IaC — with status, category, and audit boundaries.",
};

type ConnectorStatus = "connected" | "available" | "coming_soon";
type ConnectorCategory =
  | "cloud"
  | "source_control"
  | "communication"
  | "observability"
  | "database"
  | "iac"
  | "billing";

interface ConnectorRow {
  id: string;
  name: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  /** Auth method exposed to operators. */
  auth: "oauth" | "iam_role" | "api_key" | "service_account" | "tba";
  /** Short summary of what the connector can read. */
  reads: string;
  /** Short summary of what actions it can perform, or `null` if read-only. */
  writes: string | null;
  /** Cockpit deep link where the connector lives, if any. */
  setupRoute?: string;
  /** True if Axiom holds write capability behind an approval packet (default for write-capable connectors). */
  requiresApproval: boolean;
}

const CONNECTORS: readonly ConnectorRow[] = [
  // ===== Cloud =====
  {
    id: "aws",
    name: "AWS",
    category: "cloud",
    status: "connected",
    auth: "iam_role",
    reads: "Accounts, organisations, EC2 / RDS / Lambda / S3 / ELB / EKS, IAM, GuardDuty, Cost Explorer, CloudTrail.",
    writes: "Apply approved Terraform plans, rotate IAM keys, mutate tags, run StagedRemediationRunbook actions.",
    setupRoute: "/dashboard/aws",
    requiresApproval: true,
  },
  {
    id: "azure",
    name: "Azure",
    category: "cloud",
    status: "connected",
    auth: "service_account",
    reads: "Subscriptions, resource groups, compute, networking, key vault, storage, ARM activity log.",
    writes: null,
    setupRoute: "/dashboard/azure",
    requiresApproval: true,
  },
  {
    id: "gcp",
    name: "Google Cloud",
    category: "cloud",
    status: "connected",
    auth: "service_account",
    reads: "Projects, compute, GKE, storage, Security Command Center, Resource Manager.",
    writes: null,
    setupRoute: "/dashboard/gcp",
    requiresApproval: true,
  },

  // ===== Source control / delivery =====
  {
    id: "github",
    name: "GitHub",
    category: "source_control",
    status: "connected",
    auth: "oauth",
    reads: "Org members, repos, Actions runs, PRs, environment variables, branch protections.",
    writes: "Open PRs with proposed code changes, comment on PRs, dispatch workflow runs.",
    setupRoute: "/dashboard/integrations/github",
    requiresApproval: true,
  },
  {
    id: "azure_devops",
    name: "Azure DevOps",
    category: "source_control",
    status: "available",
    auth: "oauth",
    reads: "Projects, pipelines, builds, releases, variable groups.",
    writes: "Open PRs, dispatch pipeline runs.",
    requiresApproval: true,
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "source_control",
    status: "coming_soon",
    auth: "oauth",
    reads: "Repos, pipelines, merge requests (planned).",
    writes: null,
    requiresApproval: true,
  },

  // ===== Communication =====
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    status: "connected",
    auth: "oauth",
    reads: "OAuth handshake state, signed inbound webhooks for command + reply.",
    writes: "Outbound digests, incident summaries, approval notifications — every outbound message is audited via OutboundNotificationRecord.",
    setupRoute: "/dashboard/notifications-outbound",
    requiresApproval: false,
  },
  {
    id: "microsoft_teams",
    name: "Microsoft Teams",
    category: "communication",
    status: "connected",
    auth: "oauth",
    reads: "Channel + team identifiers, signed inbound webhooks.",
    writes: "Outbound digests + incident posts (audited via OutboundNotificationRecord).",
    setupRoute: "/dashboard/notifications-outbound",
    requiresApproval: false,
  },
  {
    id: "outlook",
    name: "Outlook",
    category: "communication",
    status: "available",
    auth: "oauth",
    reads: "Mailbox metadata (auth scope), signed inbound mail events.",
    writes: "Outbound mail through the audited notification pipeline.",
    requiresApproval: true,
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "communication",
    status: "coming_soon",
    auth: "oauth",
    reads: "Mailbox metadata (planned).",
    writes: null,
    requiresApproval: true,
  },

  // ===== Observability =====
  {
    id: "dynatrace",
    name: "Dynatrace",
    category: "observability",
    status: "coming_soon",
    auth: "api_key",
    reads: "Hosts, problems, events, applied configurations (planned).",
    writes: null,
    requiresApproval: true,
  },
  {
    id: "grafana",
    name: "Grafana",
    category: "observability",
    status: "coming_soon",
    auth: "api_key",
    reads: "Dashboards, alerts, data sources (planned).",
    writes: "Author dashboard JSON via approval packet (planned).",
    requiresApproval: true,
  },
  {
    id: "prometheus",
    name: "Prometheus",
    category: "observability",
    status: "coming_soon",
    auth: "api_key",
    reads: "Metrics, rules, alerts (planned).",
    writes: null,
    requiresApproval: false,
  },
  {
    id: "cloudwatch",
    name: "Amazon CloudWatch",
    category: "observability",
    status: "connected",
    auth: "iam_role",
    reads: "Metrics, logs, alarms — surfaces inside the AWS connector.",
    writes: null,
    setupRoute: "/dashboard/aws",
    requiresApproval: false,
  },

  // ===== Databases =====
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "database",
    status: "coming_soon",
    auth: "tba",
    reads: "Schema, query plans, index usage, slow queries (planned).",
    writes: "Migration scripts via approval packet (planned).",
    requiresApproval: true,
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "database",
    status: "coming_soon",
    auth: "tba",
    reads: "Schema, query plans (planned).",
    writes: null,
    requiresApproval: true,
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "database",
    status: "coming_soon",
    auth: "tba",
    reads: "Collections, indexes, slow queries (planned).",
    writes: null,
    requiresApproval: true,
  },

  // ===== IaC / Containers =====
  {
    id: "kubernetes",
    name: "Kubernetes",
    category: "iac",
    status: "available",
    auth: "service_account",
    reads: "Workloads, ingress, drift, EOL versions — surfaces inside k8s-eol + containers cockpit.",
    writes: null,
    setupRoute: "/dashboard/k8s-eol",
    requiresApproval: true,
  },
  {
    id: "docker",
    name: "Docker",
    category: "iac",
    status: "available",
    auth: "api_key",
    reads: "Image scans, registry inventory.",
    writes: null,
    requiresApproval: false,
  },
  {
    id: "terraform_cloud",
    name: "Terraform Cloud",
    category: "iac",
    status: "available",
    auth: "api_key",
    reads: "Workspaces, runs, state references.",
    writes: "Apply approved plans via approval packet.",
    setupRoute: "/dashboard/remediation",
    requiresApproval: true,
  },

  // ===== Billing =====
  {
    id: "stripe",
    name: "Stripe",
    category: "billing",
    status: "connected",
    auth: "api_key",
    reads: "Customer + subscription state for the tenant's plan and trial.",
    writes: "Subscription updates triggered by the operator from /dashboard/billing.",
    setupRoute: "/dashboard/billing",
    requiresApproval: true,
  },
];

const CATEGORY_META: Record<
  ConnectorCategory,
  { label: string; icon: typeof CloudIcon }
> = {
  cloud:          { label: "Cloud",            icon: CloudIcon              },
  source_control: { label: "Source control",   icon: CodeBracketIcon        },
  communication:  { label: "Communication",    icon: ChatBubbleLeftRightIcon },
  observability:  { label: "Observability",    icon: EyeIcon                },
  database:       { label: "Database",         icon: CircleStackIcon        },
  iac:            { label: "IaC + containers", icon: CommandLineIcon        },
  billing:        { label: "Billing",          icon: PuzzlePieceIcon        },
};

const STATUS_STYLE: Record<ConnectorStatus, { tone: string; label: string }> = {
  connected:   { tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", label: "Connected"   },
  available:   { tone: "border-violet-500/30  bg-violet-500/10  text-violet-300",  label: "Available"   },
  coming_soon: { tone: "border-zinc-500/30    bg-zinc-500/10    text-zinc-400",    label: "Coming soon" },
};

const AUTH_LABEL: Record<ConnectorRow["auth"], string> = {
  oauth:           "OAuth",
  iam_role:        "IAM role",
  api_key:         "API key",
  service_account: "Service account",
  tba:             "TBA",
};

const CATEGORIES_ORDER: readonly ConnectorCategory[] = [
  "cloud",
  "source_control",
  "communication",
  "observability",
  "database",
  "iac",
  "billing",
];

export default async function ConnectorsPage() {
  const counts = CONNECTORS.reduce(
    (acc, c) => {
      acc[c.status] += 1;
      return acc;
    },
    { connected: 0, available: 0, coming_soon: 0 } as Record<ConnectorStatus, number>,
  );

  const live = await getLiveConnectorState();
  const liveConnectedCount = live.accounts.length;

  return (
    <div className="relative">
      {/* Hero */}
      <div className="mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-transparent p-6 md:p-8 relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 14% 0%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(124,58,237,0.08), transparent 60%)",
          }}
          aria-hidden
        />
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300/80">
          Platform · connector hub
        </p>
        <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.03em]">Connectors</h1>
        <p className="mt-3 max-w-2xl text-[14px] text-zinc-400 leading-relaxed">
          Every integration Axiom speaks to today, with what it reads, what it can
          write, and the audit boundary it carries. Write-capable connectors only
          act behind an approval packet — read-only connectors never mutate.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          {live.ok ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 px-2.5 py-1 inline-flex items-center gap-1.5">
              <LiveBadge />
              {liveConnectedCount} live in your tenant
            </span>
          ) : null}
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1">
            {counts.connected} connected
          </span>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 px-2.5 py-1">
            {counts.available} available
          </span>
          <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 text-zinc-400 px-2.5 py-1">
            {counts.coming_soon} coming soon
          </span>
        </div>
      </div>

      {/* Cards grouped by category */}
      <div className="space-y-10">
        {CATEGORIES_ORDER.map((cat) => {
          const inCat = CONNECTORS.filter((c) => c.category === cat);
          if (inCat.length === 0) return null;
          const CatIcon = CATEGORY_META[cat].icon;
          return (
            <section key={cat}>
              <header className="flex items-center gap-2 mb-3">
                <CatIcon className="h-4 w-4 text-zinc-400" />
                <h2 className="text-[14px] font-semibold text-zinc-200">{CATEGORY_META[cat].label}</h2>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  {inCat.length}
                </span>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {inCat.map((c) => {
                  const status = STATUS_STYLE[c.status];
                  // Live overlay: if the operator has a CloudAccount row for
                  // this connector id (aws / azure / gcp), surface its alias
                  // + last-scanned time so the card shows tenant truth.
                  const liveAccount = live.byProvider[c.id];
                  return (
                    <article
                      key={c.id}
                      className={[
                        "rounded-2xl border bg-white/[0.015] p-4 md:p-5 hover:bg-white/[0.025] transition flex flex-col",
                        liveAccount
                          ? "border-emerald-500/30 hover:border-emerald-500/50"
                          : "border-white/[0.06] hover:border-violet-500/30",
                      ].join(" ")}
                    >
                      <header className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-semibold text-white">{c.name}</h3>
                          <p className="mt-0.5 text-[10.5px] font-mono uppercase tracking-widest text-zinc-500">
                            {AUTH_LABEL[c.auth]}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={[
                              "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap",
                              status.tone,
                            ].join(" ")}
                          >
                            {status.label}
                          </span>
                          {liveAccount ? <LiveBadge hint={`Last scan ${relativeTime(liveAccount.lastScannedAt)}`} /> : null}
                        </div>
                      </header>

                      {liveAccount ? (
                        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-[11px] text-emerald-100/85 leading-snug">
                          <p className="font-mono uppercase tracking-widest text-[9.5px] text-emerald-300/80 mb-0.5">
                            wired in your tenant
                          </p>
                          {liveAccount.alias ? (
                            <p>Account: <span className="font-mono text-white">{liveAccount.alias}</span></p>
                          ) : null}
                          <p>Regions: <span className="font-mono text-white">{liveAccount.regions}</span> · autopilot: <span className="font-mono text-white">{liveAccount.autopilotMode}</span></p>
                          <p>Last scan: <span className="font-mono text-white">{relativeTime(liveAccount.lastScannedAt)}</span></p>
                        </div>
                      ) : null}

                      <div className="mt-3 text-[12px] text-zinc-400 leading-relaxed">
                        <p>
                          <span className="font-mono uppercase tracking-widest text-[9.5px] text-zinc-500 mr-1.5">
                            reads
                          </span>
                          {c.reads}
                        </p>
                        {c.writes ? (
                          <p className="mt-2">
                            <span className="font-mono uppercase tracking-widest text-[9.5px] text-violet-300/80 mr-1.5">
                              writes
                            </span>
                            {c.writes}
                          </p>
                        ) : (
                          <p className="mt-2 text-zinc-500 italic">Read-only.</p>
                        )}
                      </div>

                      <footer className="mt-auto pt-4 flex items-center justify-between">
                        {c.setupRoute ? (
                          <Link
                            href={c.setupRoute}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-300 hover:text-violet-200 transition"
                          >
                            Manage
                            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-[11px] text-zinc-500">
                            {c.status === "coming_soon" ? "On roadmap" : "Setup TBA"}
                          </span>
                        )}
                        {c.requiresApproval ? (
                          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                            approval gated
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/70">
                            read · safe
                          </span>
                        )}
                      </footer>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Footnote */}
      <p className="mt-10 text-[12px] text-zinc-500 max-w-3xl leading-relaxed">
        Connector status on this page is a static catalog. The Connector registry
        in <span className="font-mono">lib/connectors/connectorRegistry.ts</span> +
        per-tenant <span className="font-mono">CloudAccount</span> rows are the source of
        truth for runtime state — wiring this page to live state is a planned
        follow-up.
      </p>
    </div>
  );
}

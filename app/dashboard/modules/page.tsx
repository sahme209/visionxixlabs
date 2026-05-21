/**
 * /dashboard/modules — the platform operating-system index.
 *
 * Surfaces every platform module under one roof so the operator can
 * navigate by capability domain (cloud, devops, security, observability,
 * databases, business, HR, support) instead of memorising 80+ sibling
 * routes. Each module declares its maturity, the routes it owns, the
 * agent kernels it relies on, and the connectors it speaks to.
 *
 * Data on this page is a static catalog — when a module ships new
 * surfaces it should be appended here. Marketing follows the build:
 * if a module isn't real, mark it as `planned`.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  CloudIcon,
  CodeBracketIcon,
  ShieldCheckIcon,
  EyeIcon,
  ServerStackIcon,
  BuildingOffice2Icon,
  UsersIcon,
  LifebuoyIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { PlatformHealthStrip } from "@/components/platform/PlatformHealthStrip";

export const metadata: Metadata = {
  title: "Platform modules · Axiom",
  description:
    "Every Axiom platform module — cloud, DevOps, security, observability, databases, business, HR, support — with maturity, owned routes, and connected agents.",
};

type ModuleMaturity = "active" | "partial" | "planned";

interface PlatformModule {
  id: string;
  name: string;
  tagline: string;
  category: "infrastructure" | "delivery" | "business";
  maturity: ModuleMaturity;
  icon: typeof CloudIcon;
  /** Primary entry route inside the cockpit. */
  entryRoute: string;
  /** Additional dashboard routes that belong to this module. */
  routes: ReadonlyArray<{ href: string; label: string }>;
  /** Agent kernels in lib/agents/ that power this module. */
  agentKernels: readonly string[];
  /** Connectors this module speaks to. */
  connectors: readonly string[];
  /** Short note on what's *not* covered yet — honest scope. */
  notCoveredYet?: string;
}

const MODULES: readonly PlatformModule[] = [
  {
    id: "cloud_ops",
    name: "Cloud Operations Center",
    tagline:
      "Multi-cloud posture, cost, resilience, and remediation across AWS, Azure, and GCP.",
    category: "infrastructure",
    maturity: "active",
    icon: CloudIcon,
    entryRoute: "/dashboard/multi-cloud",
    routes: [
      { href: "/dashboard/aws",              label: "AWS" },
      { href: "/dashboard/azure",            label: "Azure" },
      { href: "/dashboard/gcp",              label: "GCP" },
      { href: "/dashboard/multi-cloud",      label: "Multi-cloud" },
      { href: "/dashboard/cloud-inventory",  label: "Cloud inventory" },
      { href: "/dashboard/cost-overview",    label: "Cost overview" },
      { href: "/dashboard/cost-explainer",   label: "Cost explainer" },
      { href: "/dashboard/finops",           label: "FinOps" },
      { href: "/dashboard/resilience",       label: "Resilience" },
      { href: "/dashboard/reliability",      label: "Reliability" },
      { href: "/dashboard/network-topology", label: "Network topology" },
    ],
    agentKernels: ["reasonerHypothesisWeaver", "simulatorSandboxSpec", "policyGateEvaluator", "boundaryGateCatalog"],
    connectors: ["AWS", "Azure", "GCP"],
    notCoveredYet: "Azure / GCP execution paths are read-only today — only AWS supports approved write actions.",
  },
  {
    id: "devops",
    name: "DevOps & CI/CD Operations",
    tagline:
      "Pipeline health, deploy windows, release-readiness, and rollback planning across GitHub + Azure DevOps.",
    category: "delivery",
    maturity: "active",
    icon: CodeBracketIcon,
    entryRoute: "/dashboard/cicd",
    routes: [
      { href: "/dashboard/cicd",           label: "CI/CD cockpit" },
      { href: "/dashboard/releaseops",     label: "Release ops" },
      { href: "/dashboard/github",         label: "GitHub" },
      { href: "/dashboard/integrations/github", label: "GitHub setup" },
      { href: "/dashboard/runbooks",       label: "Runbooks" },
      { href: "/dashboard/runbooks/queue", label: "Runbook queue" },
      { href: "/dashboard/orchestration",  label: "Orchestration" },
    ],
    agentKernels: ["specWriter", "testCoverageProposer", "refactorSequencer", "migrationCoordinator"],
    connectors: ["GitHub", "Azure DevOps"],
    notCoveredYet: "GitLab and Bitbucket connectors are planned, not shipped.",
  },
  {
    id: "security",
    name: "Security Operations Center",
    tagline:
      "IAM risk, exposed-secret detection, misconfiguration scanning, and compliance evidence.",
    category: "infrastructure",
    maturity: "active",
    icon: ShieldCheckIcon,
    entryRoute: "/dashboard/security",
    routes: [
      { href: "/dashboard/security",          label: "Security overview" },
      { href: "/dashboard/cloud-security",    label: "Cloud security" },
      { href: "/dashboard/security-scanner",  label: "Security scanner" },
      { href: "/dashboard/compliance-packet", label: "Compliance packet" },
      { href: "/dashboard/policies",          label: "Policies" },
      { href: "/dashboard/policy-previews",   label: "Policy previews" },
      { href: "/dashboard/governance",        label: "Governance" },
      { href: "/dashboard/cloudtrail",        label: "CloudTrail" },
    ],
    agentKernels: ["policyGateEvaluator", "boundaryGateCatalog", "approverPacketAssembler"],
    connectors: ["AWS", "Azure", "GCP"],
  },
  {
    id: "observability",
    name: "Observability Center",
    tagline:
      "Alerts, traces, metrics, incidents, and AI-generated incident timelines.",
    category: "infrastructure",
    maturity: "partial",
    icon: EyeIcon,
    entryRoute: "/dashboard/traces",
    routes: [
      { href: "/dashboard/traces",            label: "Traces" },
      { href: "/dashboard/topology",          label: "Topology" },
      { href: "/dashboard/notifications",     label: "Notifications" },
      { href: "/dashboard/notifications-outbound", label: "Outbound (Slack / Teams)" },
      { href: "/dashboard/outbound-digest",   label: "Outbound digest" },
    ],
    agentKernels: ["detectorSignalEmitter", "reasonerHypothesisWeaver", "verifierPostExecChecker"],
    connectors: ["Dynatrace", "Grafana", "Prometheus", "CloudWatch"],
    notCoveredYet: "Dynatrace / Grafana / Prometheus are planned ingest sources — only CloudWatch is reading today.",
  },
  {
    id: "database",
    name: "Database Operations",
    tagline:
      "Schema review, query performance, backups, migration risk, and index suggestions.",
    category: "infrastructure",
    maturity: "planned",
    icon: ServerStackIcon,
    entryRoute: "/dashboard/modules",
    routes: [],
    agentKernels: ["migrationCoordinator", "specWriter"],
    connectors: ["PostgreSQL", "MySQL", "MongoDB"],
    notCoveredYet: "Database connectors and the dedicated cockpit surface are on the next planning batch.",
  },
  {
    id: "business",
    name: "Business Operations",
    tagline:
      "Billing, executive summaries, tenant insights, and help analytics — the non-engineering surface for your workspace.",
    category: "business",
    maturity: "partial",
    icon: BuildingOffice2Icon,
    entryRoute: "/dashboard/billing",
    routes: [
      { href: "/dashboard/billing",          label: "Billing & plans" },
      { href: "/dashboard/tenant-insights",  label: "Tenant insights" },
      { href: "/dashboard/executive-summary",label: "Executive summary" },
      { href: "/dashboard/help-analytics",   label: "Help analytics" },
    ],
    agentKernels: ["axiomAssistantAgent"],
    connectors: ["Stripe", "Slack", "Outlook"],
    notCoveredYet: "Custom-success workflows and tenant-specific reporting are scoped, not shipped.",
  },
  {
    id: "hr_ops",
    name: "HR & Internal Operations",
    tagline:
      "Employee onboarding, internal knowledge, and meeting summarisation.",
    category: "business",
    maturity: "planned",
    icon: UsersIcon,
    entryRoute: "/dashboard/modules",
    routes: [],
    agentKernels: ["axiomAssistantAgent"],
    connectors: ["Slack", "Outlook", "Teams"],
    notCoveredYet: "HR Ops is in design — surface, models, and agent specialisation are queued for an upcoming phase.",
  },
  {
    id: "support",
    name: "Support Operations",
    tagline:
      "Help desk routing, support ticket handling, and contextual help suggestions.",
    category: "business",
    maturity: "partial",
    icon: LifebuoyIcon,
    entryRoute: "/dashboard/help",
    routes: [
      { href: "/dashboard/help",             label: "Help & docs" },
      { href: "/dashboard/help-suggestions", label: "Doc suggestions" },
      { href: "/dashboard/help-analytics",   label: "Help analytics" },
    ],
    agentKernels: ["axiomAssistantAgent", "contactResolutionAgent"],
    connectors: ["Slack", "Outlook"],
    notCoveredYet: "Ticket routing automation is single-tenant only today.",
  },
];

const MATURITY_STYLE: Record<ModuleMaturity, { tone: string; label: string }> = {
  active:  { tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", label: "Active" },
  partial: { tone: "border-amber-500/30   bg-amber-500/10   text-amber-300",  label: "Partial" },
  planned: { tone: "border-zinc-500/30    bg-zinc-500/10    text-zinc-400",   label: "Planned" },
};

const CATEGORY_LABEL: Record<PlatformModule["category"], string> = {
  infrastructure: "Infrastructure",
  delivery:       "Delivery",
  business:       "Business",
};

export default function ModulesPage() {
  const counts = MODULES.reduce(
    (acc, m) => {
      acc[m.maturity] += 1;
      return acc;
    },
    { active: 0, partial: 0, planned: 0 } as Record<ModuleMaturity, number>,
  );

  return (
    <div className="relative">
      {/* Hero */}
      <div className="mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-transparent p-6 md:p-8 relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 14% 0%, rgba(124,58,237,0.12), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-violet-300/80">
          Platform · operating system
        </p>
        <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.03em]">Platform modules</h1>
        <p className="mt-3 max-w-2xl text-[14px] text-zinc-400 leading-relaxed">
          Axiom is one operations platform with multiple specialised modules. Each module
          owns a domain — cloud, delivery, security, observability, databases, business —
          and is powered by a typed agent kernel set plus a connector set. Every action
          they propose still requires operator approval.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1">
            {counts.active} active
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2.5 py-1">
            {counts.partial} partial
          </span>
          <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 text-zinc-400 px-2.5 py-1">
            {counts.planned} planned
          </span>
        </div>
      </div>

      <PlatformHealthStrip />

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const maturity = MATURITY_STYLE[m.maturity];
          return (
            <article
              key={m.id}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 md:p-6 hover:border-violet-500/30 hover:bg-white/[0.025] transition flex flex-col"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
                    <Icon className="h-5 w-5 text-violet-300" />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-semibold text-white">{m.name}</h2>
                    <p className="text-[10.5px] font-mono uppercase tracking-widest text-zinc-500 mt-0.5">
                      {CATEGORY_LABEL[m.category]}
                    </p>
                  </div>
                </div>
                <span
                  className={[
                    "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    maturity.tone,
                  ].join(" ")}
                >
                  {maturity.label}
                </span>
              </header>

              <p className="mt-3 text-[13px] text-zinc-400 leading-relaxed">{m.tagline}</p>

              {m.routes.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                    Routes ({m.routes.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.routes.map((r) => (
                      <Link
                        key={r.href}
                        href={r.href}
                        className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-0.5 text-[11px] text-zinc-300 hover:text-white hover:border-violet-500/40 transition"
                      >
                        {r.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">
                    Agent kernels
                  </p>
                  <ul className="space-y-0.5">
                    {m.agentKernels.map((k) => (
                      <li key={k} className="text-[11px] font-mono text-zinc-400 truncate" title={`lib/agents/${k}`}>
                        {k}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">
                    Connectors
                  </p>
                  <ul className="space-y-0.5">
                    {m.connectors.map((c) => (
                      <li key={c} className="text-[11px] text-zinc-400">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {m.notCoveredYet ? (
                <p className="mt-4 text-[11.5px] text-amber-300/80 leading-relaxed border-l-2 border-amber-500/30 pl-3">
                  <span className="font-mono uppercase tracking-widest text-[9.5px] text-amber-400/80">
                    not covered yet
                  </span>
                  <br />
                  {m.notCoveredYet}
                </p>
              ) : null}

              <div className="mt-auto pt-5 flex items-center justify-between">
                <Link
                  href={m.entryRoute}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-violet-300 hover:text-violet-200 transition"
                >
                  Open module
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/dashboard/connectors"
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                >
                  Connectors
                  <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {/* Footnote */}
      <p className="mt-8 text-[12px] text-zinc-500 max-w-3xl leading-relaxed">
        Module catalog is a static configuration in <span className="font-mono">app/dashboard/modules/page.tsx</span>.
        When a new module ships, append it here. When a planned module becomes partial or
        active, update its maturity. Marketing claims about Axiom follow this catalog —
        if a module isn't here, it isn't real.
      </p>
    </div>
  );
}

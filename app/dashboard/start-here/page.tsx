/**
 * /dashboard/start-here — Phase 405 Setup Guide.
 *
 * The single canonical entry point for new operators. Lays out the 12
 * setup steps from the phase spec as a progressive checklist with
 * deep-links into the real surfaces.
 *
 * Replaces the historical mix of /dashboard/setup, /dashboard/onboarding,
 * and ad-hoc onboarding banners. Those routes still exist for backward
 * compat (linked from the "Power tools" section of the sidebar), but
 * this is where every new user lands first.
 */

import Link from "next/link";
import {
  RocketLaunchIcon,
  ShieldCheckIcon,
  CloudIcon,
  CodeBracketIcon,
  ChartBarIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  LockClosedIcon,
  DocumentTextIcon,
  BoltIcon,
  CheckCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

interface SetupStep {
  ord: number;
  title: string;
  purpose: string;
  estimateMins: number;
  requires: string;
  whatHappensNext: string;
  safety: string;
  ctaLabel: string;
  ctaHref: string;
  docsHref?: string;
  demoHref?: string;
  icon: typeof CloudIcon;
}

const STEPS: SetupStep[] = [
  {
    ord: 1, title: "Create your workspace", icon: RocketLaunchIcon,
    purpose: "A workspace is the unit of billing + role assignment. Everything you do happens inside it.",
    estimateMins: 1, requires: "An email and a workspace name.",
    whatHappensNext: "You land on the dashboard in preview mode. All KPIs show sample data until you connect a real source.",
    safety: "Workspace name is shown in the audit log; pick something a teammate would recognize.",
    ctaLabel: "Open dashboard", ctaHref: "/dashboard/command-center",
    docsHref: "/docs/getting-started",
  },
  {
    ord: 2, title: "Invite your team", icon: ShieldCheckIcon,
    purpose: "Most actions need two-person approval. Bring at least one teammate so production changes aren't blocked.",
    estimateMins: 3, requires: "Their email + a role (operator, viewer).",
    whatHappensNext: "Invitees get an email; once they accept, they appear in Users & Roles.",
    safety: "Default role is viewer — no destructive actions until you explicitly upgrade them.",
    ctaLabel: "Invite teammates", ctaHref: "/dashboard/settings/workspace",
    docsHref: "/docs/getting-started",
  },
  {
    ord: 3, title: "Connect your first cloud provider", icon: CloudIcon,
    purpose: "AWS, Azure, or GCP — the platform reads inventory + posture from your real account.",
    estimateMins: 5, requires: "Cross-account IAM role (AWS), service principal (Azure), or service account (GCP).",
    whatHappensNext: "Inventory + risk scan starts within 60 seconds.",
    safety: "Read-only access by default. Nothing can be changed in your cloud until you approve a specific action.",
    ctaLabel: "Open Connectors", ctaHref: "/dashboard/connectors",
    docsHref: "/docs/aws-setup",
    demoHref: "/demo/cloud_operations",
  },
  {
    ord: 4, title: "Connect GitHub or Azure DevOps", icon: CodeBracketIcon,
    purpose: "Lets the DevOps Engineer read pipeline runs, PRs, and recent deploys for incident correlation.",
    estimateMins: 3, requires: "OAuth approval or a fine-grained personal access token.",
    whatHappensNext: "Repos appear in the DevOps overview; recent build statuses populate within minutes.",
    safety: "Read-only at install. Modifying any pipeline or branch requires explicit approval.",
    ctaLabel: "Connect GitHub", ctaHref: "/dashboard/integrations/github",
    docsHref: "/docs/github-setup",
    demoHref: "/demo/devops_pipeline",
  },
  {
    ord: 5, title: "Connect a monitoring source", icon: ChartBarIcon,
    purpose: "Pulls alerts + metrics so Monitoring/Incident engineers can correlate failures with recent changes.",
    estimateMins: 5, requires: "API key from CloudWatch, Grafana, Dynatrace, or Prometheus.",
    whatHappensNext: "Alerts ingest in real time; service-health board populates.",
    safety: "Read-only ingestion. The platform never silences or modifies an alert without approval.",
    ctaLabel: "Open Monitoring", ctaHref: "/dashboard/observability",
    docsHref: "/docs/monitoring",
    demoHref: "/demo/monitoring_alert",
  },
  {
    ord: 6, title: "Install the desktop app", icon: ComputerDesktopIcon,
    purpose: "Lets engineers analyze local repos, validate cloud credentials locally, and receive signed webhook events.",
    estimateMins: 2, requires: "macOS, Windows, or Linux laptop.",
    whatHappensNext: "Settings → API key → paste → dashboard shows live workspace.",
    safety: "Desktop only acts on what you explicitly authorize (local capability scope).",
    ctaLabel: "Download desktop", ctaHref: "/download",
    docsHref: "/docs/desktop-overview",
    demoHref: "/demo/desktop_app_pairing",
  },
  {
    ord: 7, title: "Connect a local repo or developer tool", icon: CodeBracketIcon,
    purpose: "Brings AI engineers into your IDE so you don't have to context-switch into the web.",
    estimateMins: 4, requires: "VS Code or the desktop app paired.",
    whatHappensNext: "DevOps Engineer chat panel appears in the IDE sidebar.",
    safety: "Each command from the IDE is audited; modifying code is via PR + approval.",
    ctaLabel: "Open Developer Tools", ctaHref: "/dashboard/developer-tools",
    docsHref: "/docs/developer-tools",
    demoHref: "/demo/developer_tools",
  },
  {
    ord: 8, title: "Configure approval rules", icon: LockClosedIcon,
    purpose: "Pick who approves what. Most production changes are two-person by default — adjust per action class.",
    estimateMins: 5, requires: "At least two teammates with operator role.",
    whatHappensNext: "Future remediations + automations gate on the policy you set here.",
    safety: "Defaults are SAFE. Loosening a policy requires explicit operator confirmation.",
    ctaLabel: "Open Policies", ctaHref: "/dashboard/policies",
    docsHref: "/docs/approval-workflow",
  },
  {
    ord: 9, title: "Enable your first AI engineer", icon: CpuChipIcon,
    purpose: "Engineers are scoped, named workers (Cloud, DevOps, Security, Monitoring, Incident, Database, etc.). Activate the one closest to your immediate need.",
    estimateMins: 2, requires: "At least one connector live.",
    whatHappensNext: "Engineer becomes available; you can ask it for a read-only analysis right away.",
    safety: "Every engineer is read-only at activation. Granting write access is a separate explicit step.",
    ctaLabel: "Open AI Engineers", ctaHref: "/dashboard/workforce",
    docsHref: "/docs/ai-engineers",
    demoHref: "/demo/ai_workforce_overview",
  },
  {
    ord: 10, title: "Run your first read-only scan", icon: SparklesIcon,
    purpose: "Validates the connector + populates your first risk list. No changes to your cloud or code.",
    estimateMins: 2, requires: "A connector + an engineer activated.",
    whatHappensNext: "Risk queue populates; Executive Summary becomes available.",
    safety: "Read-only by construction. Every action emits an audit row.",
    ctaLabel: "Open Risk Queue", ctaHref: "/dashboard/risks",
    docsHref: "/docs/scanning",
  },
  {
    ord: 11, title: "Review your first report", icon: DocumentTextIcon,
    purpose: "Posture + risks + next actions in a shareable doc.",
    estimateMins: 2, requires: "At least one completed scan.",
    whatHappensNext: "Report generates; you can share the link with your team or export PDF.",
    safety: "Sharing a report does not grant workspace access — it only exposes the report contents.",
    ctaLabel: "Open Executive Summary", ctaHref: "/dashboard/executive-summary",
    docsHref: "/docs/reporting",
  },
  {
    ord: 12, title: "Create your first automation (safely)", icon: BoltIcon,
    purpose: "Pick a curated Python script or workflow. Dry-run first — never go straight to execution.",
    estimateMins: 6, requires: "Approval rules configured.",
    whatHappensNext: "Dry-run produces a plan; reviewing → approval → audited execution.",
    safety: "Dry-run only writes nothing. Real execution requires two-person approval AND emits a closed-union audit action.",
    ctaLabel: "Open Automations", ctaHref: "/dashboard/automation",
    docsHref: "/docs/automation",
    demoHref: "/demo/automation_dry_run",
  },
];

export default function StartHerePage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em]">start here</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">Setup Guide</h1>
        <p className="text-zinc-400 max-w-2xl leading-relaxed">
          12 progressive steps from cold-start to your first audited automation. Each step is
          read-only or self-approve by default — the platform never makes a change in your cloud
          without your explicit go-ahead.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 text-[12px] text-violet-300 hover:text-violet-200 transition-colors"
          >
            Prefer to explore first? Open the sandbox →
          </Link>
        </div>
      </header>

      <ol className="space-y-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li
              key={step.ord}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 hover:border-white/[0.10] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-violet-300" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-[10px] font-mono text-zinc-600 tabular-nums">
                      {String(step.ord).padStart(2, "0")}
                    </span>
                    <h2 className="text-base font-semibold text-white">{step.title}</h2>
                    <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                      ~{step.estimateMins} min
                    </span>
                  </div>
                  <p className="text-[13px] text-zinc-300 leading-relaxed">{step.purpose}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <StepDetail label="Requires" value={step.requires} />
                    <StepDetail label="What happens next" value={step.whatHappensNext} />
                    <StepDetail label="Safety" value={step.safety} tone="safety" />
                  </div>
                  <div className="flex items-center flex-wrap gap-2 pt-3">
                    <Link
                      href={step.ctaHref}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium transition-colors"
                    >
                      {step.ctaLabel} <span aria-hidden>→</span>
                    </Link>
                    {step.demoHref && (
                      <Link
                        href={step.demoHref}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-500/[0.10] text-violet-200 text-[12px] font-medium border border-violet-500/20 hover:bg-violet-500/[0.18] transition-colors"
                      >
                        View demo
                      </Link>
                    )}
                    {step.docsHref && (
                      <Link
                        href={step.docsHref}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.04] text-zinc-200 text-[12px] font-medium border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
                      >
                        Docs
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-emerald-200">All 12 steps complete?</h3>
            <p className="text-[13px] text-zinc-300 leading-relaxed mt-1">
              Your workspace is fully set up. From here, the AI workforce can read posture, propose
              fixes, and (with your approval) execute changes — every action audited.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function StepDetail({ label, value, tone }: { label: string; value: string; tone?: "safety" }) {
  return (
    <div>
      <p className={`text-[10px] font-mono uppercase tracking-[0.18em] mb-1 ${tone === "safety" ? "text-emerald-400" : "text-zinc-500"}`}>
        {label}
      </p>
      <p className="text-[12px] text-zinc-400 leading-relaxed">{value}</p>
    </div>
  );
}

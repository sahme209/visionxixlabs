/**
 * /dashboard/engineer-workspace — unified engineer surface.
 *
 * Brings web + desktop signals together: PRs needing review, alerts
 * from connected observability tools, incident triage queue, recent
 * deploys, and local desktop actions waiting for approval. This is
 * the "engineer's home" inside the client portal.
 *
 * Today the page renders the LAYOUT and the empty states. Real data
 * flows in once telemetry sources are wired (Connector Store) and the
 * native modules ship their persistence layer. No fake data ever.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  CodeBracketIcon,
  ComputerDesktopIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  RocketLaunchIcon,
  CpuChipIcon,
  PlayCircleIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import { getTenantFreshness } from "@/lib/platform/tenantFreshness";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";

export const metadata: Metadata = {
  title: "Engineer workspace · Axiom",
  description:
    "Your unified engineer surface — PRs, alerts, incidents, deploys, and desktop actions all in one place.",
};

export const dynamic = "force-dynamic";

export default async function EngineerWorkspacePage() {
  const freshness = await getTenantFreshness();
  const isFresh = freshness.freshTenant;

  return (
    <div className="relative">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CpuChipIcon className="h-4 w-4 text-zinc-500" />
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Engineer workspace</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Everything an engineer needs, <span className="text-gradient">in one calm view.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Pull requests, alerts, incidents, deploys, and local desktop actions — surfaced together with AI prioritization. Web and desktop signals merge automatically; you approve risky moves once, the platform handles the rest.
        </p>
      </div>

      {isFresh ? (
        <div className="mb-8">
          <TenantEmptyState
            icon={<CpuChipIcon className="h-5 w-5" />}
            tone="violet"
            eyebrow="Workspace empty"
            title="Connect tools and pair your desktop to light this surface up."
            description="The Engineer Workspace shows your unified queue across GitHub (PRs needing review), connected observability tools (alerts firing), incidents (active and pending postmortem), CI/CD (deploys ready or stuck), and the desktop app (local actions awaiting approval)."
            agiNote="AGI ranks the queue automatically — what to look at first based on blast radius + your team's recent patterns. Nothing changes anything until you press approve."
            actions={[
              { href: "/dashboard/connector-store",  label: "Open Connector Store",   variant: "primary" },
              { href: "/download",                   label: "Download desktop app",   variant: "ghost" },
            ]}
          />
        </div>
      ) : null}

      {/* Lane grid — each lane will fill with real data per connector / module wiring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Lane
          icon={CodeBracketIcon}
          tone="text-violet-300"
          title="Pull requests"
          description="PRs needing review across every connected repo."
          ctaHref="/dashboard/connector-store#repository"
          empty="No PRs yet — connect GitHub or GitLab in the Connector Store."
        />
        <Lane
          icon={BellAlertIcon}
          tone="text-rose-300"
          title="Active alerts"
          description="Firing alerts from connected observability and security tools."
          ctaHref="/dashboard/observability"
          empty="No alerts yet — wire CloudWatch, Grafana, Datadog, or our native HTTP pinger."
        />
        <Lane
          icon={ExclamationTriangleIcon}
          tone="text-zinc-300"
          title="Incident triage"
          description="Open incidents + postmortems awaiting your input."
          ctaHref="/dashboard/incidents"
          empty="No incidents — they auto-create when an alert rule with autoCreateIncident=true fires."
        />
        <Lane
          icon={RocketLaunchIcon}
          tone="text-cyan-300"
          title="Deploys"
          description="Recent CI/CD runs + their risk signal."
          ctaHref="/dashboard/connector-store#ci_cd"
          empty="No deploys yet — connect GitHub Actions, Azure DevOps, or Jenkins."
        />
        <Lane
          icon={ComputerDesktopIcon}
          tone="text-fuchsia-300"
          title="Desktop queue"
          description="Local actions handed off from the platform — pending your approval on-device."
          ctaHref="/download"
          empty="Pair the desktop app to enable local execution with on-device approval."
        />
        <Lane
          icon={ArrowsRightLeftIcon}
          tone="text-emerald-300"
          title="Approvals waiting"
          description="Risky actions staged by AI agents awaiting human sign-off."
          ctaHref="/dashboard/approvals"
          empty="No approvals waiting — the loop only stages risky changes when policy says so."
        />
      </div>

      {/* Vision strip — what this surface becomes */}
      <section className="mt-10 rounded-2xl border border-violet-500/15 bg-white/[0.015] p-5">
        <header className="flex items-center gap-2 mb-3">
          <SparklesPlaceholder />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">Where this surface is going</p>
        </header>
        <ul className="grid sm:grid-cols-2 gap-2 text-[12px] text-zinc-300">
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span><span className="font-semibold text-zinc-100">Unified queue.</span> Web + desktop signals merged, ranked by AI.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span><span className="font-semibold text-zinc-100">One-click connect.</span> Every tool wires in via OAuth or paste-form — no env-var manual work.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span><span className="font-semibold text-zinc-100">Local execution, safe.</span> Desktop app runs scripts only with on-device approval.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span><span className="font-semibold text-zinc-100">Approval-only contract.</span> AGI proposes; humans approve. Every change audited.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span><span className="font-semibold text-zinc-100">VS Code + JetBrains plugins.</span> Same surface inside the editor (roadmap).</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span><span className="font-semibold text-zinc-100">Reasoning, not noise.</span> AI explains every flagged item with linked evidence.</span>
          </li>
        </ul>
      </section>

      {/* Bottom links */}
      <section className="mt-8 grid sm:grid-cols-3 gap-3">
        <Link href="/dashboard/connector-store" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <PlayCircleIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Connector store</p>
          <p className="text-[11px] text-zinc-500 mt-1">One-click connect every tool you already use.</p>
        </Link>
        <Link href="/dashboard/observability" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <SignalIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Observability</p>
          <p className="text-[11px] text-zinc-500 mt-1">Service health + telemetry sources.</p>
        </Link>
        <Link href="/download" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <ComputerDesktopIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Desktop app</p>
          <p className="text-[11px] text-zinc-500 mt-1">macOS / Win / Linux local runtime.</p>
        </Link>
      </section>
    </div>
  );
}

function Lane({
  icon: Icon,
  tone,
  title,
  description,
  empty,
  ctaHref,
}: {
  icon: typeof CodeBracketIcon;
  tone: string;
  title: string;
  description: string;
  empty: string;
  ctaHref: string;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 ${tone} shrink-0`} />
          <p className="text-[13px] font-semibold text-white truncate">{title}</p>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px text-zinc-500 bg-white/[0.04] border-white/[0.08]">
          empty
        </span>
      </header>
      <p className="text-[11.5px] text-zinc-400 leading-snug mb-3">{description}</p>
      <div className="rounded-lg border border-white/[0.04] bg-black/30 px-3 py-3 flex-1 flex items-center justify-center text-center">
        <p className="text-[11.5px] text-zinc-500 leading-snug">{empty}</p>
      </div>
      <Link
        href={ctaHref}
        className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-zinc-300 hover:text-white self-end"
      >
        Configure <ArrowRightIcon className="h-3 w-3" />
      </Link>
    </article>
  );
}

function SparklesPlaceholder() {
  return (
    <span className="inline-block w-4 h-4 rounded-full bg-violet-400/40" aria-hidden />
  );
}

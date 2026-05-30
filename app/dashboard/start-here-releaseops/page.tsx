/**
 * /dashboard/start-here-releaseops — Phase 505.
 *
 * In-app version of docs/RELEASEOPS_GETTING_STARTED.md — the canonical
 * "land here and figure it out" page for new clients. Renders the
 * onboarding checklist at the top, then the four-step explainer,
 * then the model map + the cause→effect loop description.
 */

import Link from "next/link";
import {
  RocketLaunchIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  BoltIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";

export default function StartHereReleaseOpsPage() {
  return (
    <div className="relative">
      <PageIntro
        kicker="ReleaseOps · zero-touch onboarding"
        title={<>Install. <span className="text-zinc-500">Push.</span> Ship.</>}
        description="The Axiom ReleaseOps platform is built to self-serve. This page is the single canonical 'start here' surface — install the GitHub App once, then your repos onboard themselves as you push to them, branch protection projects automatically, and every state change flows into a unified audit trail."
        helps="Reach 'first audited release deployed' without messaging support. Each panel below maps to a working dashboard surface."
        connectFirst="The GitHub App install is the only prerequisite. Everything else cascades from there."
        engineers={["Release Captain", "DevOps", "SRE", "Compliance"]}
        requiresApproval="No write-to-prod actions run here — this page is read-only orientation."
        actions={[
          { label: "Install the GitHub App", href: "/dashboard/github-app" },
          { label: "View applications",      href: "/dashboard/applications" },
          { label: "View releases",          href: "/dashboard/releases" },
        ]}
        safetyNote="Read-only · all actions are deep-linked to their respective dashboard pages"
      />

      <OnboardingChecklist alwaysShow />

      {/* Four-step explainer */}
      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="text-[14px] font-semibold text-white mb-4">The 4-step path</h2>
        <ol className="space-y-4">
          <Step
            num={1}
            icon={<BoltIcon className="h-5 w-5 text-violet-300" />}
            title="Install the Axiom GitHub App"
            body="One click. The App's org-wide webhook delivery means you don't paste a URL anywhere — Axiom starts receiving push/PR/release/workflow events for every repo in scope the moment install completes."
            href="/dashboard/github-app"
            cta="Open install page"
          />
          <Step
            num={2}
            icon={<CpuChipIcon className="h-5 w-5 text-violet-300" />}
            title="Register your first application"
            body="Applications are the governance unit — releases attach to an application, not a repo. Slug + name + owning team is all you need. Idempotent on (org, slug) so re-runs are safe."
            href="/dashboard/applications"
            cta="Register an application"
          />
          <Step
            num={3}
            icon={<RocketLaunchIcon className="h-5 w-5 text-violet-300" />}
            title="Push to any tracked repo (auto-onboard)"
            body="After install, the first push/PR/release webhook for a repo auto-creates the Repository row in your tenant. No manual + Register repository click needed. You can also pre-register explicitly via the Repositories page if you prefer."
            href="/dashboard/repositories"
            cta="Open repositories"
          />
          <Step
            num={4}
            icon={<CheckCircleIcon className="h-5 w-5 text-violet-300" />}
            title="Cut your first release"
            body="Pin a tag + commit + planned-window to an application. The release starts in draft; you advance the lifecycle (ready → deploying → deployed) via the lifecycle transitions API. Readiness scoring, evidence packs, and the audit log all hang off the release."
            href="/dashboard/releases"
            cta="Create a release"
          />
        </ol>
      </section>

      {/* The cause → effect loop */}
      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-violet-500/[0.025] p-5">
        <h2 className="text-[14px] font-semibold text-violet-100 mb-2">The cause → effect loop</h2>
        <p className="text-[12.5px] text-zinc-300 mb-4">
          Two surfaces close the post-deploy reconciliation loop:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">cause</p>
            <p className="text-[13px] font-semibold text-white mb-1">Manual fixes</p>
            <p className="text-[11.5px] text-zinc-400 mb-2">
              When an engineer patches an environment by hand (typically prod), log the action. The pending status flows back to source-of-truth once a PR / IaC catch-up commit captures it.
            </p>
            <Link href="/dashboard/manual-fixes" className="text-[11px] font-mono text-zinc-300 hover:text-white underline-offset-2 hover:underline">
              Open manual fixes →
            </Link>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">effect</p>
            <p className="text-[13px] font-semibold text-white mb-1">Deployment incidents</p>
            <p className="text-[11.5px] text-zinc-400 mb-2">
              Post-deploy regressions pinned to a release. open → mitigated → resolved | wont_fix. Pairs with manual fixes for the full audit story.
            </p>
            <Link href="/dashboard/deployment-incidents" className="text-[11px] font-mono text-zinc-300 hover:text-white underline-offset-2 hover:underline">
              Open deployment incidents →
            </Link>
          </div>
        </div>
      </section>

      {/* Audit + governance */}
      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="text-[14px] font-semibold text-white mb-2">Audit + governance</h2>
        <p className="text-[12.5px] text-zinc-300 mb-3">
          Every state-changing endpoint best-effort appends to the audit
          log. Compliance exports read directly from this table.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/release-audit" className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[12px] font-mono text-zinc-200 hover:border-white/[0.12] transition-colors">
            Release audit log
          </Link>
          <Link href="/dashboard/policy-violations" className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[12px] font-mono text-zinc-200 hover:border-white/[0.12] transition-colors">
            Policy violations
          </Link>
          <Link href="/dashboard/release-readiness" className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[12px] font-mono text-zinc-200 hover:border-white/[0.12] transition-colors">
            Release readiness
          </Link>
          <Link href="/dashboard/branch-protection" className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[12px] font-mono text-zinc-200 hover:border-white/[0.12] transition-colors">
            Branch protection
          </Link>
          <Link href="/dashboard/webhook-deliveries" className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[12px] font-mono text-zinc-200 hover:border-white/[0.12] transition-colors">
            Webhook deliveries
          </Link>
        </div>
      </section>

      {/* Honest gaps */}
      <section className="mb-8 rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.03] p-5">
        <h2 className="text-[14px] font-semibold text-amber-200 mb-2">
          <ShieldCheckIcon className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          What's still manual (honest gaps)
        </h2>
        <ul className="space-y-2 text-[12.5px] text-zinc-300">
          <li>
            <span className="font-mono text-amber-300">Branch protection auto-sync</span> — the projector + persistence + paste-in panel are live; the automated <code className="font-mono text-zinc-100">gh api</code> fetch ships when the App private key is wired in.
          </li>
          <li>
            <span className="font-mono text-amber-300">Installation-token repo discovery</span> — after install, we know the installation_id but don't yet call <code className="font-mono text-zinc-100">/installation/repositories</code>; that lands with the private key wiring.
          </li>
          <li>
            <span className="font-mono text-amber-300">Slack notifications for incidents</span> — model + responder + UI live; the Slack outbound hop is a separate phase.
          </li>
        </ul>
        <p className="text-[11.5px] text-zinc-400 mt-3">
          Each gap uses the platform's <code className="font-mono text-zinc-200">migration_pending</code> graceful-degradation pattern — the UI stays calm until the follow-on phase ships.
        </p>
      </section>
    </div>
  );
}

function Step({ num, icon, title, body, href, cta }: {
  num: number;
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-500/[0.12] border border-white/[0.12] flex items-center justify-center mt-0.5">
        <span className="text-[11px] font-mono font-semibold text-white">{num}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <p className="text-[13px] font-semibold text-white">{title}</p>
        </div>
        <p className="text-[12px] text-zinc-400 mb-1.5">{body}</p>
        <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-300 hover:text-white">
          <span>{cta}</span>
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>
    </li>
  );
}

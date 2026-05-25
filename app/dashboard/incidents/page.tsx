/**
 * /dashboard/incidents — native incident management.
 *
 * The platform's own incident surface — independent of PagerDuty /
 * Opsgenie / ServiceNow but able to mirror from them when their
 * connectors are configured. Today this page renders the layout +
 * empty state. Real incidents flow in once alert rules with
 * autoCreateIncident=true fire OR an external connector mirrors them.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ClockIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  BellAlertIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { getTenantFreshness } from "@/lib/platform/tenantFreshness";
import { PageIntro } from "@/components/dashboard/PageIntro";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";

export const metadata: Metadata = {
  title: "Incidents · Axiom",
  description:
    "Native incident management — open, triage, resolve, postmortem. Works alongside PagerDuty/Opsgenie or stands on its own.",
};

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const freshness = await getTenantFreshness();
  const isFresh = freshness.freshTenant;

  return (
    <div className="relative">
      <PageIntro
        kicker="Operations · incidents"
        title={<>When something breaks, <span className="text-zinc-500">AGI runs the playbook.</span></>}
        description="Open incidents land here with severity, owner, affected services, evidence, and an AI-built timeline. Native — works without PagerDuty or Opsgenie — but mirrors from them when you connect them."
        helps="See active incidents, the AI-generated timeline, the proposed remediation, and what's blocked on approval."
        connectFirst="Optional: PagerDuty or Opsgenie for two-way sync. Otherwise incidents are detected from your monitoring + cloud signals."
        engineers={["Incident Engineer", "SRE / On-call", "Cloud Engineer"]}
        requiresApproval="Any remediation that changes infrastructure. AGI proposes; you approve."
        actions={[
          { label: "Configure monitoring", href: "/dashboard/observability" },
          { label: "View pending approvals", href: "/dashboard/approvals" },
        ]}
        safetyNote="Remediations are proposed, never auto-executed · Every action audit-logged"
      />

      {isFresh && (
        <div className="mb-8">
          <TenantEmptyState
            icon={<ExclamationTriangleIcon className="h-5 w-5" />}
            tone="fuchsia"
            eyebrow="No incidents"
            title="Quiet so far — that's the goal."
            description="Incidents open automatically when an alert rule with autoCreateIncident=true fires, when a critical security finding lands, or when an external incident system (PagerDuty / Opsgenie / ServiceNow) mirrors one in. You'll see active + triage + postmortem-pending lanes here."
            agiNote="AGI builds the timeline live: alerts → deploys → log spikes → recovery actions, all linked. The postmortem drafter then turns it into a publishable doc you edit before sharing."
            actions={[
              { href: "/dashboard/connector-store#incident", label: "Connect PagerDuty / Opsgenie", variant: "primary" },
              { href: "/dashboard/observability",             label: "Set up alert rules",          variant: "ghost" },
            ]}
          />
        </div>
      )}

      {/* Lane grid — visible regardless of freshness so engineers see the model */}
      <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Lane title="Active" tone="text-rose-300" icon={BellAlertIcon} empty="No active incidents — when one opens, it shows here with severity + owner." />
        <Lane title="Triage" tone="text-amber-300" icon={WrenchScrewdriverIcon} empty="No incidents awaiting triage. Triage = AI has identified a likely root cause; human reviews." />
        <Lane title="Postmortem" tone="text-emerald-300" icon={DocumentTextIcon} empty="No postmortems pending. After resolution, the drafter writes one for your edit." />
      </section>

      {/* Incident lifecycle explainer */}
      <section className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.04] p-5 mb-8">
        <p className="text-[10px] font-semibold text-rose-300 uppercase tracking-widest mb-3">// the incident lifecycle</p>
        <div className="grid sm:grid-cols-2 gap-2 text-[12px] text-zinc-300">
          {[
            { stage: "Open",          icon: BellAlertIcon,           detail: "Alert fires, security finding lands, or external connector mirrors in. Owner auto-assigned by on-call schedule." },
            { stage: "Investigate",   icon: ClockIcon,               detail: "AI builds timeline live — linking alerts, deploys, log spikes. Engineer sees evidence in one view." },
            { stage: "Mitigate",      icon: WrenchScrewdriverIcon,   detail: "Recommended actions appear with risk + rollback. Risky ones require approval." },
            { stage: "Resolve",       icon: CheckCircleIcon,         detail: "Verifier confirms the action achieved expected outcome. Audit row written." },
            { stage: "Postmortem",    icon: DocumentTextIcon,        detail: "Drafter writes timeline, root cause, contributing factors, action items. You edit before sharing." },
            { stage: "Follow-up",     icon: UserGroupIcon,           detail: "Action items become tasks. Linked to services. Tracked to closure." },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.stage} className="flex items-start gap-2">
                <Icon className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-zinc-100">{step.stage}</p>
                  <p className="text-zinc-400 mt-0.5 leading-snug">{step.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <Link href="/dashboard/observability" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-rose-500/25 transition-colors">
          <BellAlertIcon className="h-4 w-4 text-rose-400 mb-2" />
          <p className="text-sm font-semibold text-white">Observability</p>
          <p className="text-[11px] text-zinc-500 mt-1">Alert rules + telemetry sources.</p>
        </Link>
        <Link href="/dashboard/approvals" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-rose-500/25 transition-colors">
          <CheckCircleIcon className="h-4 w-4 text-rose-400 mb-2" />
          <p className="text-sm font-semibold text-white">Approvals</p>
          <p className="text-[11px] text-zinc-500 mt-1">Risky mitigations live here before execution.</p>
        </Link>
        <Link href="/dashboard/audit" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-rose-500/25 transition-colors">
          <DocumentTextIcon className="h-4 w-4 text-rose-400 mb-2" />
          <p className="text-sm font-semibold text-white">Audit log</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every action that touched the incident.</p>
        </Link>
      </section>
    </div>
  );
}

function Lane({ title, tone, icon: Icon, empty }: { title: string; tone: string; icon: typeof BellAlertIcon; empty: string }) {
  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col">
      <header className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <p className="text-[12px] font-semibold text-white">{title}</p>
        <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-zinc-500">0</span>
      </header>
      <p className="text-[11.5px] text-zinc-500 leading-snug">{empty}</p>
    </article>
  );
}

import {CustomerJourneyEntry} from '@/components/shared/CustomerJourneyEntry';
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { readBillingPlanWithAvailability } from "@/lib/billing/tenantBillingStore";
import { PUBLIC_PLAN_CATALOG, publicPlanIdFor } from "@/lib/billing/publicPlanCatalog";
import { readCurrentAIAllowance } from "@/lib/billing/currentAIAllowance";
import { withIsolatedWorkspaceScope } from "@/lib/billing/isolatedApplication/scope";
import { decideDesktopCommercialAccess } from "@/lib/desktop/desktopCommercialAccessPolicy";
import { readStabilityWarning, type StabilityRepo } from "@/lib/releaseops/stabilityWarning";
import { evaluateChangeWindow, parseChangeWindowRule } from "@/lib/releaseops/environmentChangeWindow";

type Overview = {
  pendingActions: number;
  members: number;
  activeIntegrations: number;
  integrationsNeedingAttention: number;
  environments: number;
};

async function readOverview(organizationId: string): Promise<Overview | null> {
  try {
    const [pendingActions, members, activeIntegrations, integrationsNeedingAttention, environments] = await Promise.all([
      prisma.agentActionProposal.count({ where: { organizationId, status: "proposed" } }),
      prisma.orgMembership.count({ where: { organizationId, acceptedAt: { not: null } } }),
      prisma.tenantIntegrationConnection.count({ where: { organizationId, status: "active" } }),
      prisma.tenantIntegrationConnection.count({ where: { organizationId, status: "needs_attention" } }),
      prisma.environment.count({ where: { organizationId } }),
    ]);
    return { pendingActions, members, activeIntegrations, integrationsNeedingAttention, environments };
  } catch {
    return null;
  }
}

type GovernanceAttention = { pendingPolicyChanges: number; blockingChecks: number; checksFailingLatest: number; frozen: Array<{ name: string; reason: string; until: string }> };

/** Optional release-governance signals; a read failure hides only this section. */
async function readGovernanceAttention(organizationId: string): Promise<GovernanceAttention | null> {
  try {
    const [pendingPolicyChanges, blocking, environments] = await Promise.all([
      prisma.policyChangeRequest.count({ where: { organizationId, status: "pending" } }),
      prisma.deploymentCheck.findMany({ where: { organizationId, enabled: true, mode: "blocking" }, take: 200, select: { key: true } }),
      (async () => prisma.environment.findMany({ where: { organizationId }, take: 200, select: { name: true, changeWindowRuleJson: true } }))().catch(() => [] as Array<{ name: string; changeWindowRuleJson: unknown }>),
    ]);
    const now = new Date();
    const frozen = environments.flatMap((e) => { const d = evaluateChangeWindow(parseChangeWindowRule(e.changeWindowRuleJson), now); return !d.open && d.reason === "freeze" ? [{ name: e.name, reason: d.freezeReason, until: d.freezeEndsAt }] : []; });
    const keys = blocking.map((b) => b.key);
    const recent = keys.length ? await prisma.deploymentCheckResult.findMany({ where: { organizationId, checkKey: { in: keys } }, orderBy: { reportedAt: "desc" }, take: 500, select: { checkKey: true, status: true } }) : [];
    const latest = new Map<string, string>();
    for (const r of recent) if (!latest.has(r.checkKey)) latest.set(r.checkKey, r.status);
    return { pendingPolicyChanges, blockingChecks: keys.length, checksFailingLatest: [...latest.values()].filter((s) => s !== "passed").length, frozen };
  } catch {
    return null;
  }
}

export default async function ControlOverviewPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control");
  if (!context.roles.length) return <p role="alert" className="text-sm text-zinc-300">A current workspace membership is required. Refresh to verify access.</p>;
  const organizationId = String(context.organizationId);
  const [overview, billing, allowance, attention, stability] = await Promise.all([
    readOverview(organizationId),
    readBillingPlanWithAvailability(organizationId).catch(() => null),
    withIsolatedWorkspaceScope(context, "read", () => readCurrentAIAllowance(prisma, organizationId)).catch(() => ({ available: false } as const)),
    readGovernanceAttention(organizationId),
    readStabilityWarning(prisma as unknown as StabilityRepo, organizationId, new Date()),
  ]);
  const plan = billing?.available ? billing.plan : null;
  // Same plan name as Usage & billing, so the two pages never disagree (for example "14-day trial" beside "Free · no plan").
  const planName = plan ? (PUBLIC_PLAN_CATALOG.find(entry => entry.id === (plan.publicPlanId ?? publicPlanIdFor(plan.tier, plan.status)))?.name ?? "Unavailable") : "Unavailable";
  const desktopAccess = plan ? decideDesktopCommercialAccess(plan) : null;
  const money = (cents: number) => new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(cents / 100);

  return (
    <div className="w-full min-w-0">

      <h1 className="text-2xl font-medium tracking-tight">Overview</h1>
      <p className="mt-1 max-w-2xl text-[13px] leading-5 text-zinc-400">Your account, connected services, and governed workspace.</p>

      <CustomerJourneyEntry/>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section aria-labelledby="current-plan-heading" className="flex min-h-48 flex-col rounded-2xl bg-[#111111] p-4">
          <div className="flex items-center justify-between gap-3"><h2 id="current-plan-heading" className="text-xs font-normal text-zinc-400">Current plan</h2><Link href="/control/plans" className="inline-flex min-h-8 items-center rounded-full bg-[#f3f3f3] px-3.5 text-[13px] text-black hover:bg-white">Review plans</Link></div>
          <p className="mt-4 text-2xl">{planName}</p>
          <p className="mt-2 text-xs text-zinc-400">{plan ? `Subscription status: ${plan.status.replaceAll("_", " ")}` : "Billing status could not be verified."}</p>
          <Link href="/control/usage-billing" className="mt-auto pt-5 text-xs text-zinc-300 underline underline-offset-4">View usage &amp; billing</Link>
        </section>
        <section aria-labelledby="account-allowance-heading" className="rounded-2xl bg-[#111111] p-4">
          <h2 id="account-allowance-heading" className="text-xs font-normal text-zinc-400">AI allowance remaining</h2>
          <p className="mt-4 text-2xl tabular-nums">{allowance.available ? money(allowance.includedRemainingCents) : "Unavailable"}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-400">{allowance.available ? `${money(allowance.poolCents)} current allowance · ${money(allowance.heldCents)} held for unresolved requests` : "Allowance could not be verified. No zero balance is inferred."}</p>
          <Link href="/control/usage-billing" className="mt-5 inline-flex text-xs text-zinc-300 underline underline-offset-4">Review allowance &amp; transactions</Link>
        </section>
      </div>
      {stability?.level === "elevated" && (
        <section aria-labelledby="stability-warning-heading" role="status" className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <h2 id="stability-warning-heading" className="text-sm font-medium text-amber-200">Stability warning</h2>
          <p className="mt-2 text-sm text-amber-100/90">{stability.message}</p>
          <p className="mt-2 text-xs text-zinc-400">Production deployments ask for a reason while this warning is active. <Link href="/control/insights#insights-stability" className="underline underline-offset-4">See Insights</Link></p>
        </section>
      )}
      {attention && (attention.pendingPolicyChanges > 0 || attention.blockingChecks > 0 || attention.frozen.length > 0) && (
        <section aria-labelledby="release-governance-heading" className="mt-6 rounded-2xl bg-[#111111] p-4">
          <h2 id="release-governance-heading" className="text-xs font-normal text-zinc-400">Release governance</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {attention.pendingPolicyChanges > 0 && <li><Link href="/control/governance#policy-as-code-heading" className="underline underline-offset-4">{attention.pendingPolicyChanges} policy change {attention.pendingPolicyChanges === 1 ? "request awaits" : "requests await"} a second approver</Link></li>}
            {attention.blockingChecks > 0 && <li className="text-zinc-300">{attention.blockingChecks} blocking deployment {attention.blockingChecks === 1 ? "check" : "checks"}{attention.checksFailingLatest > 0 ? <>; <Link href="/control/checks" className="text-amber-300 underline underline-offset-4">{attention.checksFailingLatest} failed on {attention.checksFailingLatest === 1 ? "its" : "their"} latest reported run</Link></> : <> · <Link href="/control/checks" className="underline underline-offset-4">Review checks</Link></>}</li>}
            {attention.frozen.map((f) => <li key={f.name} className="text-zinc-300">{f.name} is frozen: {f.reason}, until {new Date(f.until).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Deployments there are refused.</li>)}
          </ul>
        </section>
      )}
      <section aria-label="V19 products and connections" className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl bg-[#111111] p-4"><h2 className="text-sm font-medium">V19</h2><p className="mt-2 text-xs text-zinc-300">{desktopAccess?.title ?? "Access status unavailable"}</p><p className="mt-1 text-xs leading-5 text-zinc-400">Workspace access is checked by the desktop service. Paired devices are managed separately.</p><Link href="/control/settings?section=sessions" className="mt-4 inline-flex text-xs text-zinc-200 underline underline-offset-4">Manage desktop sessions</Link></article>
        <article className="rounded-2xl bg-[#111111] p-4"><h2 className="text-sm font-medium">Integrations</h2><p className="mt-2 text-xs leading-5 text-zinc-400">Connect workspace services and review their validated permissions.</p><Link href="/control/integrations" className="mt-4 inline-flex text-xs text-zinc-200 underline underline-offset-4">Connect services</Link></article>
        <article className="rounded-2xl bg-[#111111] p-4"><h2 className="text-sm font-medium">Apps &amp; skills</h2><p className="mt-2 text-xs leading-5 text-zinc-400">Explore capabilities and the skills available to your Agent.</p><Link href="/control/plugins" className="mt-4 inline-flex text-xs text-zinc-200 underline underline-offset-4">Browse capabilities</Link></article>
      </section>

      {!overview ? (
        <div role="alert" className="mt-10 border-y border-white/8 py-6">
          <p className="text-sm font-medium">Organization status is temporarily unavailable.</p>
          <p className="mt-2 text-sm text-zinc-500">No cached or simulated values are shown. Refresh after the service connection recovers.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="decision-heading" className="mt-6 rounded-2xl bg-[#111111] p-4">
            <p className="text-xs text-zinc-500">Most important next action</p>
            <div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <h2 id="decision-heading" className="text-base font-medium tracking-tight">
                  {overview.pendingActions > 0 ? `${overview.pendingActions} agent ${overview.pendingActions === 1 ? "action awaits" : "actions await"} review` : "No agent actions await review"}
                </h2>
                <p className="mt-2 text-sm text-zinc-500">Every action follows your workspace policy and approval rules.</p>
              </div>
              {overview.pendingActions > 0 && <Link href="/control/governance" className="shrink-0 rounded-lg bg-[#f54e00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff6424]">Review approvals</Link>}
            </div>
          </section>

          <dl className="grid gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8 sm:grid-cols-2 lg:grid-cols-4 mt-8">
            {[
              ["Members", overview.members],
              ["Active integrations", overview.activeIntegrations],
              ["Environments", overview.environments],
              ["Integration alerts", overview.integrationsNeedingAttention],
            ].map(([label, value]) => (
              <div key={label} className="bg-[#171717] p-5">
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="mt-3 text-2xl font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <section aria-label="Organization and desktop" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#111111] p-4">
        <div><h2 className="text-sm font-medium">Your organization</h2><p className="mt-1 text-xs text-zinc-400">{overview ? `${overview.members} accepted ${overview.members === 1 ? "member" : "members"}` : "Member count unavailable"} · workspace permissions apply to every action.</p></div>
        <div className="flex flex-wrap gap-3"><Link href="/control/members" className="inline-flex min-h-8 items-center rounded-full border border-white/15 px-3.5 text-xs hover:bg-white/5">Manage members</Link><Link href="/control/governance" className="inline-flex min-h-8 items-center rounded-full border border-white/15 px-3.5 text-xs hover:bg-white/5">Open governance</Link><Link href="/control/desktop" className="inline-flex min-h-8 items-center text-xs text-orange-300 hover:text-orange-200">Download or update Agent ↗</Link></div>
      </section>
    </div>
  );
}

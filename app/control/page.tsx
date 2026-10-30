import {CustomerJourneyEntry} from '@/components/shared/CustomerJourneyEntry';
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { readBillingPlanWithAvailability } from "@/lib/billing/tenantBillingStore";
import { readCurrentAIAllowance } from "@/lib/billing/currentAIAllowance";
import { withIsolatedWorkspaceScope } from "@/lib/billing/isolatedApplication/scope";
import { decideDesktopCommercialAccess } from "@/lib/desktop/desktopCommercialAccessPolicy";

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

export default async function ControlOverviewPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control");
  if (!context.roles.length) return <p role="alert" className="text-sm text-zinc-300">A current workspace membership is required. Refresh to verify access.</p>;
  const organizationId = String(context.organizationId);
  const [overview, billing, allowance] = await Promise.all([
    readOverview(organizationId),
    readBillingPlanWithAvailability(organizationId).catch(() => null),
    withIsolatedWorkspaceScope(context, "read", () => readCurrentAIAllowance(prisma, organizationId)).catch(() => ({ available: false } as const)),
  ]);
  const plan = billing?.available ? billing.plan : null;
  const planName = plan ? (plan.publicPlanId ? ({free:"Free",pro:"Pro",enterprise:"Enterprise"})[plan.publicPlanId] : plan.spec?.label ?? (plan.status === "no_plan" ? "No subscription" : plan.tier)) : "Unavailable";
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
      <section aria-label="Axiom products and connections" className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl bg-[#111111] p-4"><h2 className="text-sm font-medium">Axiom Agent</h2><p className="mt-2 text-xs text-zinc-300">{desktopAccess?.title ?? "Access status unavailable"}</p><p className="mt-1 text-xs leading-5 text-zinc-400">Workspace access is checked by the desktop service. Paired devices are managed separately.</p><Link href="/control/settings?section=sessions" className="mt-4 inline-flex text-xs text-zinc-200 underline underline-offset-4">Manage desktop sessions</Link></article>
        <article className="rounded-2xl bg-[#111111] p-4"><h2 className="text-sm font-medium">Integrations</h2><p className="mt-2 text-xs leading-5 text-zinc-400">Connect workspace services and review their validated permissions.</p><Link href="/control/integrations" className="mt-4 inline-flex text-xs text-zinc-200 underline underline-offset-4">Connect services</Link></article>
        <article className="rounded-2xl bg-[#111111] p-4"><h2 className="text-sm font-medium">Apps &amp; skills</h2><p className="mt-2 text-xs leading-5 text-zinc-400">Explore capabilities and the skills available to your Agent.</p><Link href="/control/plugins" className="mt-4 inline-flex text-xs text-zinc-200 underline underline-offset-4">Browse capabilities</Link></article>
      </section>

      {!overview ? (
        <div role="alert" className="mt-10 border-y border-white/[0.08] py-6">
          <p className="text-sm font-medium">Organization status is temporarily unavailable.</p>
          <p className="mt-2 text-sm text-zinc-500">No cached or simulated values are shown. Refresh after the service connection recovers.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="decision-heading" className="mt-6 rounded-2xl bg-[#111111] p-4">
            <p className="text-xs text-zinc-500">Most important next action</p>
            <div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <h2 id="decision-heading" className="text-base font-medium tracking-[-0.025em]">
                  {overview.pendingActions > 0 ? `${overview.pendingActions} agent ${overview.pendingActions === 1 ? "action awaits" : "actions await"} review` : "No agent actions await review"}
                </h2>
                <p className="mt-2 text-sm text-zinc-500">Every action follows your workspace policy and approval rules.</p>
              </div>
              {overview.pendingActions > 0 && <Link href="/control/governance" className="shrink-0 rounded-lg bg-[#f54e00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff6424]">Review approvals</Link>}
            </div>
          </section>

          <dl className="grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4 mt-8">
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

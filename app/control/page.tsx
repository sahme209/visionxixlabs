import Link from "next/link";
import { redirect } from "next/navigation";

import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

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
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control");
  const overview = await readOverview(String(context.organizationId));

  return (
    <div className="max-w-5xl">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff783d]">Governance control plane</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Know what needs a decision.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Configure authority here. Engineers perform repository and deployment work in the desktop app; Axiom’s backend enforces every protected action.</p>

      {!overview ? (
        <div role="alert" className="mt-10 border-y border-white/[0.08] py-6">
          <p className="text-sm font-medium">Organization status is temporarily unavailable.</p>
          <p className="mt-2 text-sm text-zinc-500">No cached or simulated values are shown. Refresh after the service connection recovers.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="decision-heading" className="mt-10 border-y border-white/[0.08] py-7">
            <p className="text-xs text-zinc-500">Most important next action</p>
            <div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <h2 id="decision-heading" className="text-xl font-medium tracking-[-0.025em]">
                  {overview.pendingActions > 0 ? `${overview.pendingActions} agent ${overview.pendingActions === 1 ? "action awaits" : "actions await"} review` : "No agent actions await review"}
                </h2>
                <p className="mt-2 text-sm text-zinc-500">Approval never executes from presentation state; the backend revalidates scope, policy, and action identity.</p>
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

      <section className="mt-12 grid gap-7 sm:grid-cols-2">
        <div>
          <h2 className="text-base font-medium">Govern centrally</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Roles, repository access, environments, approved models, budgets, integrations, and production controls belong here.</p>
        </div>
        <div>
          <h2 className="text-base font-medium">Operate in desktop</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Repository editing, diffs, pull requests, deployment requests, Airflow monitoring, and troubleshooting remain in Axiom Agent.</p>
          <Link href="/download" className="mt-3 inline-flex text-sm text-[#ff783d] hover:text-[#ff9a6d]">Download or update Axiom Agent →</Link>
        </div>
      </section>
    </div>
  );
}

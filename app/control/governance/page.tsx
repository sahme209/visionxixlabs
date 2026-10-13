import { redirect } from "next/navigation";

import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { ApprovalDecisionButtons } from "./ApprovalDecisionButtons";

export default async function GovernancePage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/governance");
  const organizationId = String(context.organizationId);
  const [members, environments, proposals] = await Promise.all([
    prisma.orgMembership.groupBy({ by: ["role"], where: { organizationId, acceptedAt: { not: null } }, _count: { _all: true } }),
    prisma.environment.findMany({ where: { organizationId }, select: { id: true, name: true, slug: true, tier: true, approvalPolicyId: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
    prisma.agentActionProposal.findMany({ where: { organizationId, status: "proposed" }, select: { id: true, toolName: true, riskLevel: true, createdAt: true, approvalExpiresAt: true, actionDigest: true, proposedByUserId: true }, orderBy: { createdAt: "asc" }, take: 20 }),
  ]);
  const canDecide = canDecideApprovals({ email: context.email, roles: context.roles });

  return (
    <div className="max-w-5xl">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff783d]">Governance</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">Authority before execution.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">This view reads the organization’s current roles, environments, and pending Agent actions. Decisions remain backend-enforced and cannot be granted by changing browser state.</p>

      <section className="mt-10 border-t border-white/[0.08] py-7">
        <h2 className="text-base font-medium">Pending approvals</h2>
        {proposals.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No Agent actions currently await approval.</p>
        ) : (
          <div className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                <div><p className="text-sm text-zinc-200">{proposal.toolName.replaceAll("_", " ")}</p><p className="mt-1 font-mono text-[11px] text-zinc-600">{proposal.id}</p></div>
                <div className="text-left sm:text-right"><p className="text-xs uppercase tracking-[0.12em] text-[#ff783d]">{proposal.riskLevel} risk</p><time className="mt-1 block text-xs text-zinc-600">{proposal.createdAt.toLocaleString()}</time></div>
                <ApprovalDecisionButtons proposalId={proposal.id} disabledReason={!canDecide ? "An authorized approver role is required." : proposal.proposedByUserId === String(context.userId) ? "A different authorized user must decide this proposal." : !proposal.actionDigest ? "This legacy proposal has no integrity binding and cannot be decided in the browser." : proposal.approvalExpiresAt && proposal.approvalExpiresAt <= new Date() ? "This proposal has expired." : undefined} />
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-zinc-600">Approvals are bound to the exact action, expire after 24 hours, require a separate authorized reviewer, and are claimed once before backend execution.</p>
      </section>

      <section className="border-t border-white/[0.08] py-7">
        <h2 className="text-base font-medium">Organization roles</h2>
        {members.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No accepted organization memberships were found.</p> : (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{members.map((entry) => <div key={entry.role} className="rounded-xl border border-white/[0.08] bg-[#171717] p-4"><dt className="text-xs capitalize text-zinc-500">{entry.role.replaceAll("_", " ")}</dt><dd className="mt-2 text-xl tabular-nums">{entry._count._all}</dd></div>)}</dl>
        )}
      </section>

      <section className="border-t border-white/[0.08] py-7">
        <h2 className="text-base font-medium">Environment policy posture</h2>
        {environments.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No environments are configured. Environment creation remains in its current verified flow during migration.</p> : (
          <div className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">{environments.map((environment) => <div key={environment.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm">{environment.name}</p><p className="mt-1 font-mono text-[11px] text-zinc-600">{environment.slug}</p></div><div className="text-right"><p className="text-xs uppercase tracking-[0.12em] text-zinc-400">{environment.tier}</p><p className="mt-1 text-xs text-zinc-600">{environment.approvalPolicyId ? "Approval policy assigned" : "No approval policy assigned"}</p></div></div>)}</div>
        )}
      </section>
    </div>
  );
}

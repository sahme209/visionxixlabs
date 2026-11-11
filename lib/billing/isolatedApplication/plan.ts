import { newTestAllocationPricingPlan } from "../newTestSubscription/allocationPlan";
import { readFixtureEnrollment } from "../newTestSubscription/fixtureAllocation";
import "server-only";
import type { Prisma } from "@/lib/prismaClient";
import { requireIsolatedWorkspaceScope } from "./scope";
import { readVerifiedNewTestContract } from "../newTestSubscription/verifiedContract";
import { newTestPricingPlan } from "../newTestSubscription/paidPlan";
export async function resolveIsolatedApplicationPlan(tx: Prisma.TransactionClient, organizationId: string, kind: "read" | "admission") {
  const identity = requireIsolatedWorkspaceScope(organizationId, kind);
  const member = await tx.orgMembership.findUnique({ where: { userId_organizationId: { userId: identity.scope.userId, organizationId } } });
  if (!member?.acceptedAt || kind === "admission" && !["owner", "admin"].includes(member.role)) throw new Error("isolated_workspace_authority_required");
  const verified = await readVerifiedNewTestContract(tx, identity, organizationId);
  if (!verified) {
    const scope = { runtimeId: identity.runtimeId, accountId: identity.accountId, organizationId }, state = await readFixtureEnrollment(tx, scope);
    if (!state || state.paidBasis) throw new Error("new_test_contract_unavailable");
    return newTestAllocationPricingPlan(tx, scope, null, state);
  }
  return newTestPricingPlan(tx, verified);
}

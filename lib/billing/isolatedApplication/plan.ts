import "server-only";
import type { Prisma } from "@prisma/client";
import { requireIsolatedWorkspaceScope } from "./scope";
import { readVerifiedNewTestContract } from "../newTestSubscription/verifiedContract";
import { PUBLIC_PLAN_CATALOG } from "../publicPlanCatalog";
import { planForStripeTier } from "../planRegistry";
export async function resolveIsolatedApplicationPlan(tx: Prisma.TransactionClient, organizationId: string, kind: "read" | "admission") {
  const identity = requireIsolatedWorkspaceScope(organizationId, kind);
  const member = await tx.orgMembership.findUnique({ where: { userId_organizationId: { userId: identity.scope.userId, organizationId } } });
  if (!member?.acceptedAt || kind === "admission" && !["owner", "admin"].includes(member.role)) throw new Error("isolated_workspace_authority_required");
  const verified = await readVerifiedNewTestContract(tx, identity, organizationId);
  if (!verified) throw new Error("new_test_contract_unavailable");
  const id = verified.contract.status === "active" ? verified.contract.planId : "free";
  const catalog = PUBLIC_PLAN_CATALOG.find(p => p.id === id);
  if (!catalog) throw new Error("policy_unresolved");
  const base = catalog.monthlyAiCreditCents * (catalog.aiCreditBasis === "paid_seat" ? verified.contract.seatQuantity : 1);
  if (!Number.isSafeInteger(base) || base < 0) throw new Error("credit_evidence_unavailable");
  const legacy = planForStripeTier("starter");
  return { ...legacy, entitlements: { ...legacy.entitlements, includedAICreditsCents: base, overagePolicy: "hard_stop" as const } };
}

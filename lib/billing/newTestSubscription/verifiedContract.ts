import { originalCreateProofDigest, readFixtureEnrollment } from "./fixtureAllocation";
import "server-only";
import type { Prisma } from "@prisma/client";
import type { Contract, Intent } from "./service";
import { NEW_TEST_CATALOG_VERSION } from "../newTestSubscriptionContract";
import { hasOriginalCreateProof } from "./lifecycle";
import { readFixtureCoverage } from "./fixtureCoverage";
import { paidIdentity, validateEvidence } from "./paidCoverage";
/** Shared IO verification, not a caller-supplied contract assertion. The new
 * application lane must treat null as unavailable, never a legacy fallback. */
export async function readVerifiedNewTestContract(tx: Prisma.TransactionClient, identity: { runtimeId: string; accountId: string }, org: string) {
  const marker = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "IsolatedTestRuntime" WHERE id=$1 AND account=$2', identity.runtimeId, identity.accountId);
  if (marker.length !== 1) throw new Error("isolated_fixture_marker_missing");
  const rows = await tx.$queryRawUnsafe<Array<{ body: Contract; periodEnd: Date | null; status: string | null; seatQuantity: number | null; eventToken: string | null; customer: string | null; subscription: string | null }>>('SELECT c.body,p."currentPeriodEndsAt" AS "periodEnd",p.status,p."seatQuantity",p."lastStripeEventId" AS "eventToken",p."stripeCustomerId" AS customer,p."stripeSubscriptionId" AS subscription FROM "OrganizationTestSubscriptionContract" c LEFT JOIN "TenantBillingPlan" p ON p."organizationId"=c.org WHERE c.org=$1', org);
  const row = rows[0]; if (!row) return null;
  if (row.body.organizationId !== org || !row.status || !["active", "past_due", "canceled", "trialing", "no_plan"].includes(row.status) || typeof row.seatQuantity !== "number" || !Number.isSafeInteger(row.seatQuantity) || row.seatQuantity < 1 || !row.eventToken || row.body.customerId !== row.customer || row.body.subscriptionId !== row.subscription || row.body.runtimeId !== identity.runtimeId || row.body.catalogVersion !== NEW_TEST_CATALOG_VERSION || row.body.livemode !== false || row.body.accountId !== identity.accountId) throw new Error("verified_contract_binding_unavailable");
  const intents = await tx.$queryRawUnsafe<Array<{ body: Intent }>>('SELECT body FROM "RecurringSubscriptionIntent" WHERE id=$1 AND org=$2', row.body.originatingIntentId, org);
  const intent = intents[0]?.body;
  if (!intent || intent.organizationId !== org || intent.livemode !== false || intent.runtimeId !== identity.runtimeId || intent.accountId !== identity.accountId || intent.state !== "bound" || intent.terms.catalogVersion !== NEW_TEST_CATALOG_VERSION || intent.terms.planId !== row.body.planId || intent.subscriptionId !== row.subscription || intent.customerId !== row.customer || intent.sessionId !== row.body.sessionId) throw new Error("new_test_contract_unavailable");
  if (!hasOriginalCreateProof(intent) || row.seatQuantity !== intent.terms.seatQuantity) throw new Error("attempt_provenance_unavailable");
  const contract = { ...row.body, status: row.status, seatQuantity: row.seatQuantity, eventToken: row.eventToken };
  const coverage = await readFixtureCoverage(tx, org);
  if (coverage) {
    validateEvidence(paidIdentity(contract, intent), coverage.originalEvidence);
    if (!(row.periodEnd instanceof Date) || !Number.isFinite(row.periodEnd.getTime()) || row.periodEnd.toISOString() !== coverage.observation.currentPeriodEnd) throw new Error("paid_coverage_unavailable");
  }
  if (!intent.allowanceV2 && coverage && (coverage.originalEvidence.version !== 1 || coverage.observation.collection.kind === "collected" && coverage.observation.collection.evidence.version !== 1)) throw new Error("allowance_provenance_unavailable");
  const allowance = intent.allowanceV2 ? await readFixtureEnrollment(tx, { ...identity, organizationId: org }) : null;
  if (intent.allowanceV2 && (!allowance?.paidBasis || allowance.enrollment.digest !== intent.allowanceV2.enrollmentDigest || allowance.paidBasis.origin.intentId !== intent.id || allowance.paidBasis.origin.createProofDigest !== originalCreateProofDigest(intent)
    || coverage?.originalEvidence.version !== 2 || coverage.originalEvidence.digest !== allowance.paidBasis.origin.firstCollectionDigest || coverage.originalEvidence.originalAnchor !== allowance.paidBasis.anchor)) throw new Error("allowance_provenance_unavailable");
  return { contract, intent, coverage, allowance };
}

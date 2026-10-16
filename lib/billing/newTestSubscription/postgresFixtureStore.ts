import { readVerifiedNewTestContract } from "./verifiedContract";
import { PrismaClient, type Prisma } from "@prisma/client";
import type { Store, Transaction, Intent, Contract, Scope } from "./service";
import { consumeSubscriptionEventInTransaction, type SubscriptionTransaction } from "../consumeSubscriptionEvent";
import { reserveAICredits } from "../aiCreditReservation";
import { planForStripeTier } from "../planRegistry";
import { PUBLIC_PLAN_CATALOG } from "../publicPlanCatalog";
import type { BillingStatus } from "../tierCatalog";
import { NEW_TEST_CATALOG_VERSION } from "../newTestSubscriptionContract";

/** Owned-loopback fixture adapter only. Constructs its own database client;
 * no DATABASE_URL fallback and no production route/import invokes this lane. */
export function postgresFixtureStore(target: string, runtimeId: string, accountId: string) {
  const url = new URL(target);
  if (!["postgresql:", "postgres:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/axiom_new_test_contract_rehearsal" || url.search || url.hash || !runtimeId || !accountId) throw new Error("isolated_fixture_target_required");
  const client = new PrismaClient({ datasources: { db: { url: target } } });
  const checkMarker = async (tx: Prisma.TransactionClient) => {
    const marker = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "IsolatedTestRuntime" WHERE id=$1 AND account=$2', runtimeId, accountId);
    if (marker.length !== 1) throw new Error("isolated_fixture_marker_missing");
  };
  const readContract = async (tx: Prisma.TransactionClient, org: string): Promise<Contract | null> => (await readVerifiedNewTestContract(tx, { runtimeId, accountId }, org))?.contract ?? null;

  const store: Store = { runtimeId, transaction: operation => client.$transaction(async tx => {
    await checkMarker(tx);
    const one = async <T>(sql: string, ...args: unknown[]) => (await tx.$queryRawUnsafe<T[]>(sql, ...args))[0] ?? null;
    const readIntent = async (id: string) => (await one<{ body: Intent }>('SELECT body FROM "RecurringSubscriptionIntent" WHERE id=$1', id))?.body ?? null;
    const port: Transaction = {
      eligible: async scope => { const row = await tx.orgMembership.findUnique({ where: { userId_organizationId: { userId: scope.userId, organizationId: scope.organizationId } } }); return !!row?.acceptedAt && ["owner", "admin"].includes(row.role); },
      acceptedSeats: org => tx.orgMembership.count({ where: { organizationId: org, acceptedAt: { not: null } } }),
      intent: readIntent,
      activeIntent: async org => { const row = await one<{ intent: string }>('SELECT intent FROM "RecurringSubscriptionPurchaseFence" WHERE org=$1', org); return row ? readIntent(row.intent) : null; },
      async insertIntent(i) {
        await tx.$executeRawUnsafe('INSERT INTO "RecurringSubscriptionIntent" (id,org,body) VALUES ($1,$2,$3::jsonb)', i.id, i.organizationId, JSON.stringify(i));
        await tx.$executeRawUnsafe('INSERT INTO "RecurringSubscriptionPurchaseFence" (org,intent) VALUES ($1,$2)', i.organizationId, i.id);
      },
      async saveIntent(i, revision) { const n = await tx.$executeRawUnsafe('UPDATE "RecurringSubscriptionIntent" SET body=$1::jsonb WHERE id=$2 AND org=$3 AND (body->>\'revision\')::int=$4', JSON.stringify(i), i.id, i.organizationId, revision); if (n !== 1) throw new Error("intent_revision_changed"); },
      contract: org => readContract(tx, org),
      legacyBinding: async org => { const p = await tx.tenantBillingPlan.findUnique({ where: { organizationId: org } }); return !!(p?.stripeCustomerId || p?.stripeSubscriptionId); },
      eventExists: async id => !!await tx.stripeBillingEvent.findUnique({ where: { id } }),
      async bind(c, event) {
        const expected = await tx.tenantBillingPlan.findUnique({ where: { organizationId: c.organizationId }, select: { stripeCustomerId: true, stripeSubscriptionId: true, lastStripeEventId: true } });
        const applied = await consumeSubscriptionEventInTransaction(tx as unknown as SubscriptionTransaction, "customer.subscription.updated", { organizationId: c.organizationId, tier: c.planId === "enterprise" ? "enterprise" : "growth", status: c.status as BillingStatus, stripeCustomerId: c.customerId, stripeSubscriptionId: c.subscriptionId, lastStripeEventId: event, seatQuantity: c.seatQuantity }, expected);
        if (applied !== "applied") throw new Error("subscription_event_not_applied");
        const identity = { ...c };
        delete (identity as Partial<Contract>).status;
        delete (identity as Partial<Contract>).seatQuantity;
        delete (identity as Partial<Contract>).eventToken;
        await tx.$executeRawUnsafe('INSERT INTO "OrganizationTestSubscriptionContract" (org,intent,customer,subscription,body) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (org) DO UPDATE SET body=EXCLUDED.body', c.organizationId, c.originatingIntentId, c.customerId, c.subscriptionId, JSON.stringify(identity));
      },
      async creditEvidence(org, month, now) {
        const start = new Date(`${month}-01T00:00:00Z`); const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
        const [used, held, purchases] = await Promise.all([
          tx.usageEvent.aggregate({ where: { organizationId: org, eventKind: "ai_invocation", createdAt: { gte: start, lt: end } }, _sum: { billedCents: true } }),
          tx.aIUsageReservation.aggregate({ where: { organizationId: org, OR: [{ status: "pending_settlement" }, { status: "reserved", usageEventId: { not: null } }, { status: "reserved", usageEventId: null, expiresAt: { gt: now } }] }, _sum: { reservedCents: true } }),
          tx.addOnPurchase.findMany({ where: { organizationId: org, status: { in: ["paid", "partially_refunded"] }, OR: [{ validFor: "current_month", periodMonth: month }, { validFor: "permanent", refundedAt: null }] } }),
        ]);
        return { usedCents: used._sum.billedCents ?? 0, heldCents: held._sum.reservedCents ?? 0, paidTopUpsCents: purchases.reduce((sum, p) => sum + Math.max(0, p.deliveredAICreditsCents - Math.max(0, p.reversedAICreditsCents)), 0) };
      },
    };
    return operation(port);
  }, { isolationLevel: "Serializable" }) };
  return { ...store, disconnect: () => client.$disconnect(),
    reserveCredits: (scope: Scope, input: { idempotencyKey: string; reservedCents: number }, now: Date) => reserveAICredits(client, { ...input, organizationId: scope.organizationId }, now, async (tx: Prisma.TransactionClient, org: string) => {
      await checkMarker(tx);
      const member = await tx.orgMembership.findUnique({ where: { userId_organizationId: { userId: scope.userId, organizationId: org } } });
      if (!member?.acceptedAt || !["owner", "admin"].includes(member.role)) throw new Error("test_manager_required");
      const contract = await readContract(tx, org); if (!contract) throw new Error("new_test_contract_unavailable");
      const rows = await tx.$queryRawUnsafe<Array<{ body: Intent }>>('SELECT body FROM "RecurringSubscriptionIntent" WHERE id=$1 AND org=$2', contract.originatingIntentId, org);
      const intent = rows[0]?.body; if (!intent || intent.organizationId !== org || intent.livemode !== false || intent.runtimeId !== runtimeId || intent.accountId !== contract.accountId || intent.state !== "bound" || intent.terms.catalogVersion !== NEW_TEST_CATALOG_VERSION || intent.terms.planId !== contract.planId || intent.subscriptionId !== contract.subscriptionId || intent.customerId !== contract.customerId) throw new Error("new_test_contract_unavailable");
      const planId = contract.status === "active" ? intent.terms.planId : "free";
      const catalog = PUBLIC_PLAN_CATALOG.find(p => p.id === planId); if (!catalog) throw new Error("policy_unresolved");
      const legacy = planForStripeTier("starter");
      return { ...legacy, entitlements: { ...legacy.entitlements, includedAICreditsCents: catalog.monthlyAiCreditCents * (catalog.aiCreditBasis === "paid_seat" ? contract.seatQuantity : 1), overagePolicy: "hard_stop" } };
    }),
  };
}

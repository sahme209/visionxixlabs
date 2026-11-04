import "server-only";
import type { PublicCheckoutContract, PublicCheckoutIntent, PublicCheckoutStore, PublicCheckoutTransaction } from "./publicCheckoutService";

/** Small SQL surface shared by Prisma and the isolated PostgreSQL rehearsal. */
export interface PublicSql {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}
export interface PublicSqlRepository {
  $transaction<T>(fn: (tx: PublicSql) => Promise<T>, options: { isolationLevel: "Serializable" | "RepeatableRead" }): Promise<T>;
}
export type PublicEnrollment = { organizationId: string; id: string; accountId: string; livemode: boolean; policy: "axiom_public_anniversary_v1"; legacyFreeMonth: string; legacyFreeUsedCents: number };
export async function lockPublicOrganization(tx: PublicSql, org: string): Promise<void> {
  if (!org || org.length > 256) throw Error("billing_scope_invalid");
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))', `axiom-public-billing:${org}`);
}
export async function readPublicEnrollment(tx: PublicSql, org: string): Promise<PublicEnrollment | null> {
  const rows = await tx.$queryRawUnsafe<PublicEnrollment[]>('SELECT "organizationId",id,"accountId",livemode,policy,"legacyFreeMonth","legacyFreeUsedCents" FROM "PublicBillingEnrollment" WHERE "organizationId"=$1', org);
  if (rows.length > 1) throw Error("public_enrollment_invalid");
  const row = rows[0];
  if (!row) return null;
  if (row.organizationId !== org || row.policy !== "axiom_public_anniversary_v1" || !row.id || !row.accountId || typeof row.livemode !== "boolean" || !Number.isSafeInteger(row.legacyFreeUsedCents) || row.legacyFreeUsedCents < 0) throw Error("public_enrollment_invalid");
  return row;
}
export async function readPublicContract(tx: PublicSql, org: string): Promise<PublicCheckoutContract | null> {
  const rows = await tx.$queryRawUnsafe<Array<{ body: PublicCheckoutContract; revision: number }>>('SELECT body,revision FROM "PublicSubscriptionContract" WHERE "organizationId"=$1', org);
  const row = rows[0];
  if (!row) return null;
  if (rows.length !== 1 || !row.body || row.body.organizationId !== org || row.body.revision !== row.revision || row.body.binding.organizationId !== org || row.body.binding.policy !== "axiom_public_anniversary_v1") throw Error("public_contract_invalid");
  return row.body;
}
export async function readPublicIntent(tx: PublicSql, id: string): Promise<PublicCheckoutIntent | null> {
  const rows = await tx.$queryRawUnsafe<Array<{ body: PublicCheckoutIntent; revision: number; state: string; organizationId: string; providerKey: string; sessionId: string | null }>>('SELECT body,revision,state,"organizationId","providerKey","sessionId" FROM "PublicCheckoutIntent" WHERE id=$1', id);
  const row = rows[0];
  if (!row) return null;
  const b = row.body;
  if (rows.length !== 1 || !b || b.id !== id || b.organizationId !== row.organizationId || b.revision !== row.revision || b.state !== row.state || b.providerKey !== row.providerKey || b.sessionId !== row.sessionId || b.policy !== "axiom_public_anniversary_v1") throw Error("public_intent_invalid");
  return b;
}
export async function ensurePublicEnrollment(tx: PublicSql, intent: Pick<PublicCheckoutIntent,"organizationId"|"enrollmentId"|"accountId"|"livemode">) {
  await lockPublicOrganization(tx, intent.organizationId);
  const existing = await readPublicEnrollment(tx, intent.organizationId);
  if (existing) {
    if (existing.id !== intent.enrollmentId || existing.accountId !== intent.accountId || existing.livemode !== intent.livemode) throw Error("public_enrollment_mismatch");
    return;
  }
  // No unresolved legacy call can be silently transferred into a new pool.
  const held = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT h.id FROM "AIUsageReservation" h WHERE h."organizationId"=$1 AND
    (status IN ('pending_settlement','dispatch_unknown') OR status='reserved' AND ("usageEventId" IS NOT NULL OR "expiresAt">clock_timestamp() AT TIME ZONE 'UTC' OR EXISTS(SELECT 1 FROM "PipelineAICallReservation" c WHERE c."workspaceReservationId"=h.id AND c."organizationId"=h."organizationId"))) LIMIT 1`, intent.organizationId);
  if (held.length) throw Error("legacy_ai_reconciliation_required");
  const priorPurchases = await tx.$queryRawUnsafe<unknown[]>('SELECT id FROM "AddOnPurchase" WHERE "organizationId"=$1 AND "deliveredAICreditsCents">0 LIMIT 1',intent.organizationId);
  if (priorPurchases.length) throw Error("legacy_purchased_credit_reconciliation_required");
  await tx.$executeRawUnsafe(`UPDATE "AIUsageReservation" h SET status='expired',"releasedAt"=clock_timestamp() AT TIME ZONE 'UTC',"updatedAt"=clock_timestamp() AT TIME ZONE 'UTC' WHERE "organizationId"=$1 AND status='reserved' AND "usageEventId" IS NULL AND "expiresAt"<=clock_timestamp() AT TIME ZONE 'UTC' AND NOT EXISTS(SELECT 1 FROM "PipelineAICallReservation" c WHERE c."workspaceReservationId"=h.id AND c."organizationId"=h."organizationId")`, intent.organizationId);
  await tx.$executeRawUnsafe(`INSERT INTO "PublicBillingEnrollment" ("organizationId",id,"accountId",livemode,policy,"legacyFreeMonth","legacyFreeUsedCents")
    SELECT $1,$2,$3,$4,'axiom_public_anniversary_v1',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM'),
    COALESCE((SELECT sum("billedCents") FROM "UsageEvent" WHERE "organizationId"=$1 AND "eventKind"='ai_invocation' AND "createdAt">=date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC')),0)::integer`, intent.organizationId, intent.enrollmentId, intent.accountId, intent.livemode);
  const projected = await tx.$queryRawUnsafe<Array<{ stripeCustomerId:string|null; stripeSubscriptionId:string|null }>>('SELECT "stripeCustomerId","stripeSubscriptionId" FROM "TenantBillingPlan" WHERE "organizationId"=$1 FOR UPDATE',intent.organizationId);
  if (projected.some(p=>p.stripeCustomerId||p.stripeSubscriptionId)) throw Error("existing_customer_unchanged");
  await tx.$executeRawUnsafe(`INSERT INTO "TenantBillingPlan" ("organizationId",tier,status,"seatQuantity","cancelAtPeriodEnd","createdAt","updatedAt") VALUES ($1,'public_free_v1','active',2,false,clock_timestamp() AT TIME ZONE 'UTC',clock_timestamp() AT TIME ZONE 'UTC') ON CONFLICT ("organizationId") DO UPDATE SET tier='public_free_v1',status='active',"seatQuantity"=2,"updatedAt"=EXCLUDED."updatedAt"`,intent.organizationId);

}
export function createPublicSqlStore(repo: PublicSqlRepository): PublicCheckoutStore {
  return {
    transaction: fn => repo.$transaction(async tx => {
      const methods: PublicCheckoutTransaction = {
        eligibility: async scope => {
          await lockPublicOrganization(tx, scope.organizationId);
          const members = await tx.$queryRawUnsafe<Array<{ role: string; acceptedAt: Date | null }>>('SELECT role,"acceptedAt" FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2 FOR SHARE', scope.organizationId, scope.userId);
          const count = await tx.$queryRawUnsafe<Array<{ seats: number }>>('SELECT count(*)::integer AS seats FROM "OrgMembership" WHERE "organizationId"=$1 AND "acceptedAt" IS NOT NULL', scope.organizationId);
          const plans = await tx.$queryRawUnsafe<Array<{ tier:string; status:string; stripeCustomerId: string | null; stripeSubscriptionId: string | null }>>('SELECT tier,status,"stripeCustomerId","stripeSubscriptionId" FROM "TenantBillingPlan" WHERE "organizationId"=$1', scope.organizationId);
          const own = await readPublicContract(tx, scope.organizationId), row = plans[0];
          return { manager: members.length === 1 && members[0].acceptedAt !== null && ["owner","admin"].includes(members[0].role), acceptedSeats: count[0]?.seats ?? 0,
            legacyBinding: (!!row && !row.tier.startsWith("public_") && !["trial","free"].includes(row.tier) && row.status!=="no_plan") || !!(row?.stripeCustomerId || row?.stripeSubscriptionId) && (!own || own.binding.customerId !== row?.stripeCustomerId || own.binding.subscriptionId !== row?.stripeSubscriptionId) };
        },
        intent: id => readPublicIntent(tx, id),
        activeIntent: async org => {
          const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "PublicCheckoutIntent" WHERE "organizationId"=$1 AND state<>'expired'`, org);
          return rows[0] ? readPublicIntent(tx, rows[0].id) : null;
        },
        putIntent: async (intent, expected) => {
          if (expected === null) {
            await ensurePublicEnrollment(tx, intent);
            await tx.$executeRawUnsafe('INSERT INTO "PublicCheckoutIntent" (id,"organizationId",revision,state,"providerKey","sessionId",body) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)', intent.id,intent.organizationId,intent.revision,intent.state,intent.providerKey,intent.sessionId,JSON.stringify(intent));
          } else {
            const changed = await tx.$executeRawUnsafe('UPDATE "PublicCheckoutIntent" SET revision=$3,state=$4,"sessionId"=$5,body=$6::jsonb WHERE id=$1 AND revision=$2', intent.id,expected,intent.revision,intent.state,intent.sessionId,JSON.stringify(intent));
            if (changed !== 1) throw Error("intent_snapshot_changed");
          }
        },
        contract: org => readPublicContract(tx, org),
        eventSeen: async id => (await tx.$queryRawUnsafe<unknown[]>('SELECT id FROM "PublicBillingEvent" WHERE id=$1',id)).length > 0,
        fulfill: async (contract, expected, eventId, eventType, initialCollection) => {
          const { binding: b, coverage } = contract;
          await lockPublicOrganization(tx, contract.organizationId);
          const e = await readPublicEnrollment(tx, contract.organizationId);
          if (!e || e.id !== contract.enrollmentId || e.accountId !== b.accountId || e.livemode !== b.livemode) throw Error("public_enrollment_mismatch");
          await tx.$executeRawUnsafe('INSERT INTO "PublicBillingEvent" (id,"organizationId",type) VALUES ($1,$2,$3)',eventId,contract.organizationId,eventType);
          for (const coverage of [initialCollection, contract.coverage].filter((c): c is NonNullable<typeof c> => !!c)) {
            await tx.$executeRawUnsafe('INSERT INTO "PublicInvoiceCollection" ("invoiceId","organizationId",digest,body) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT ("invoiceId") DO NOTHING',coverage.invoiceId,contract.organizationId,coverage.evidenceDigest,JSON.stringify(coverage));
            const stored = await tx.$queryRawUnsafe<Array<{ digest: string; organizationId: string }>>('SELECT digest,"organizationId" FROM "PublicInvoiceCollection" WHERE "invoiceId"=$1',coverage.invoiceId);
            if (stored.length !== 1 || stored[0].digest !== coverage.evidenceDigest || stored[0].organizationId !== contract.organizationId) throw Error("invoice_evidence_changed");
          }
          if (expected === null) {
            await tx.$executeRawUnsafe('INSERT INTO "PublicSubscriptionContract" ("organizationId","intentId","subscriptionId","customerId",revision,body) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',contract.organizationId,b.intentId,b.subscriptionId,b.customerId,contract.revision,JSON.stringify(contract));
          } else if (await tx.$executeRawUnsafe('UPDATE "PublicSubscriptionContract" SET revision=$3,body=$4::jsonb WHERE "organizationId"=$1 AND revision=$2',contract.organizationId,expected,contract.revision,JSON.stringify(contract)) !== 1) throw Error("contract_snapshot_changed");
          const conflict = await tx.$queryRawUnsafe<unknown[]>('SELECT "organizationId" FROM "TenantBillingPlan" WHERE ("stripeCustomerId"=$1 OR "stripeSubscriptionId"=$2) AND "organizationId"<>$3 LIMIT 1',b.customerId,b.subscriptionId,contract.organizationId);
          if (conflict.length) throw Error("subscription_ownership_conflict");
          const existing = await tx.$queryRawUnsafe<Array<{ stripeCustomerId: string | null; stripeSubscriptionId: string | null }>>('SELECT "stripeCustomerId","stripeSubscriptionId" FROM "TenantBillingPlan" WHERE "organizationId"=$1 FOR UPDATE',contract.organizationId);
          if (existing.some(p => p.stripeCustomerId && p.stripeCustomerId !== b.customerId || p.stripeSubscriptionId && p.stripeSubscriptionId !== b.subscriptionId)) throw Error("existing_customer_unchanged");
          await tx.$executeRawUnsafe(`INSERT INTO "TenantBillingPlan" ("organizationId",tier,status,"stripeCustomerId","stripeSubscriptionId","seatQuantity","cancelAtPeriodEnd","currentPeriodEndsAt","lastStripeEventId","createdAt","updatedAt")
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz AT TIME ZONE 'UTC',$9,clock_timestamp() AT TIME ZONE 'UTC',clock_timestamp() AT TIME ZONE 'UTC')
            ON CONFLICT ("organizationId") DO UPDATE SET tier=EXCLUDED.tier,status=EXCLUDED.status,"stripeCustomerId"=EXCLUDED."stripeCustomerId","stripeSubscriptionId"=EXCLUDED."stripeSubscriptionId","seatQuantity"=EXCLUDED."seatQuantity","cancelAtPeriodEnd"=EXCLUDED."cancelAtPeriodEnd","currentPeriodEndsAt"=EXCLUDED."currentPeriodEndsAt","lastStripeEventId"=EXCLUDED."lastStripeEventId","updatedAt"=EXCLUDED."updatedAt"`,
            contract.organizationId,b.planId==='pro'?'public_pro_v1':'public_enterprise_v1',contract.status,b.customerId,b.subscriptionId,b.paidSeats,contract.cancelAtPeriodEnd,coverage?.serviceEnd ?? null,eventId);
        },
      };
      return fn(methods);
    }, { isolationLevel: "Serializable" }),
  };
}

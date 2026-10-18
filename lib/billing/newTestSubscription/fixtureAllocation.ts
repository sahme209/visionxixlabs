import { fixtureUsageGuardsDDL } from "./fixtureUsageGuards";
import { resolveAllocationV2, type AllocationFactsV2, type HoldV2, type PurchaseV2, type ReservationAttributionV2, type UsageV2 } from "./allocationV2";
import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { Contract, Intent } from "./service";
import { hasOriginalCreateProof } from "./lifecycle";
import { paidIdentity, validateEvidence, type CoverageObservation, type PaidInvoiceEvidence } from "./paidCoverage";
import { ANNIVERSARY_POLICY_V2, createAllowanceBasisV2, resolveAllowanceWindowV2, type AllowanceBasisV2, type FreeBasisInputV2, type PaidBasisInputV2 } from "./anniversaryWindow";
export type AllocationScopeV2 = { runtimeId: string; accountId: string; organizationId: string };
export type EnrollmentV2 = AllocationScopeV2 & { version: 2; policy: typeof ANNIVERSARY_POLICY_V2; digest: string };
export type VerifiedEnrollmentV2 = { enrollment: EnrollmentV2; freeBasis: AllowanceBasisV2 & FreeBasisInputV2; paidBasis: (AllowanceBasisV2 & PaidBasisInputV2) | null; revision: number };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function deny(): never { throw new Error("allowance_provenance_unavailable"); }
export function createEnrollmentV2(scope: AllocationScopeV2): EnrollmentV2 {
  if (!scope || [scope.runtimeId, scope.accountId, scope.organizationId].some(v => typeof v !== "string" || !v.trim())) deny();
  const body = { version: 2 as const, policy: ANNIVERSARY_POLICY_V2, runtimeId: scope.runtimeId, accountId: scope.accountId, organizationId: scope.organizationId };
  return Object.freeze({ ...body, digest: hash(body) });
}
export function originalCreateProofDigest(intent: Intent): string {
  if (!hasOriginalCreateProof(intent)) deny();
  const p = intent.originalCreateProof!;
  return hash({ runtimeId: p.runtimeId, accountId: p.accountId, sessionId: p.sessionId, outboundRequestKey: p.outboundRequestKey, outboundRequestDigest: p.outboundRequestDigest, requestId: p.requestId, statusCode: p.statusCode,
    ...(p.observedIdempotencyKey !== undefined ? { observedIdempotencyKey: p.observedIdempotencyKey } : {}), ...(p.observedAccountId !== undefined ? { observedAccountId: p.observedAccountId } : {}), ...(p.apiVersion !== undefined ? { apiVersion: p.apiVersion } : {}) });
}
export function paidBasisForOriginalCollection(enrollment: EnrollmentV2, intent: Intent, evidence: PaidInvoiceEvidence): AllowanceBasisV2 & PaidBasisInputV2 {
  if (createEnrollmentV2(enrollment).digest !== enrollment.digest || evidence.version !== 2 || intent.allowanceV2?.policy !== ANNIVERSARY_POLICY_V2 || intent.allowanceV2.enrollmentDigest !== enrollment.digest
    || evidence.policy !== ANNIVERSARY_POLICY_V2 || evidence.enrollmentDigest !== enrollment.digest || evidence.originalCreateProofDigest !== originalCreateProofDigest(intent)
    || evidence.originalAnchor !== evidence.serviceStart || evidence.originatingIntentId !== intent.id || evidence.sessionId !== intent.sessionId
    || evidence.runtimeId !== enrollment.runtimeId || evidence.accountId !== enrollment.accountId || evidence.organizationId !== enrollment.organizationId
    || intent.runtimeId !== enrollment.runtimeId || intent.accountId !== enrollment.accountId || intent.organizationId !== enrollment.organizationId) deny();
  const contract = { ...evidence, catalogVersion: intent.terms.catalogVersion, livemode: false, status: "active", eventToken: "basis" } as Contract;
  validateEvidence(paidIdentity(contract, intent), evidence);
  return createAllowanceBasisV2({ ...enrollment, version: 2, enrollmentDigest: enrollment.digest, kind: "paid", anchor: evidence.originalAnchor, terms: intent.terms,
    origin: { intentId: intent.id, sessionId: evidence.sessionId, customerId: evidence.customerId, subscriptionId: evidence.subscriptionId, createProofDigest: evidence.originalCreateProofDigest, firstCollectionDigest: evidence.digest } });
}
/** Explicit fixture setup only. These tables contain provenance, never balances. */
export const fixtureAllocationDDL = [
  `CREATE TABLE "NewTestAllowanceBasis" (digest text PRIMARY KEY,org text NOT NULL,runtime text NOT NULL REFERENCES "IsolatedTestRuntime"(id),account text NOT NULL,kind text NOT NULL CHECK(kind IN ('free','paid')),body jsonb NOT NULL,UNIQUE(digest,org),CHECK(body->>'digest' IS NOT DISTINCT FROM digest AND body->>'organizationId' IS NOT DISTINCT FROM org AND body->>'runtimeId' IS NOT DISTINCT FROM runtime AND body->>'accountId' IS NOT DISTINCT FROM account AND body->>'kind' IS NOT DISTINCT FROM kind AND body->>'policy' IS NOT DISTINCT FROM 'axiom_test_anniversary_v2' AND body->>'version' IS NOT DISTINCT FROM '2'))`,
  `CREATE TABLE "OrganizationTestAllowanceEnrollment" (org text PRIMARY KEY,runtime text NOT NULL REFERENCES "IsolatedTestRuntime"(id),account text NOT NULL,"freeBasisDigest" text NOT NULL,"paidBasisDigest" text,revision integer NOT NULL CHECK(revision>0),body jsonb NOT NULL,FOREIGN KEY("freeBasisDigest",org) REFERENCES "NewTestAllowanceBasis"(digest,org),FOREIGN KEY("paidBasisDigest",org) REFERENCES "NewTestAllowanceBasis"(digest,org),CHECK(body->>'organizationId' IS NOT DISTINCT FROM org AND body->>'runtimeId' IS NOT DISTINCT FROM runtime AND body->>'accountId' IS NOT DISTINCT FROM account AND body->>'policy' IS NOT DISTINCT FROM 'axiom_test_anniversary_v2' AND body->>'version' IS NOT DISTINCT FROM '2'))`,
  `CREATE TABLE "NewTestReservationAttribution" ("reservationId" text PRIMARY KEY REFERENCES "AIUsageReservation"(id),org text NOT NULL REFERENCES "OrganizationTestAllowanceEnrollment"(org),"enrollmentDigest" text NOT NULL,body jsonb NOT NULL,"releaseEvidence" jsonb)`,
  `CREATE FUNCTION freeze_test_allowance_basis() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'allowance_basis_immutable'; END $$`,
  'CREATE TRIGGER freeze_test_allowance_basis BEFORE UPDATE OR DELETE ON "NewTestAllowanceBasis" FOR EACH ROW EXECUTE FUNCTION freeze_test_allowance_basis()',
  `CREATE FUNCTION freeze_test_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' OR OLD.org IS DISTINCT FROM NEW.org OR OLD.runtime IS DISTINCT FROM NEW.runtime OR OLD.account IS DISTINCT FROM NEW.account OR OLD.body IS DISTINCT FROM NEW.body OR OLD."freeBasisDigest" IS DISTINCT FROM NEW."freeBasisDigest" OR OLD."paidBasisDigest" IS NOT NULL OR NEW."paidBasisDigest" IS NULL OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'enrollment_immutable'; END IF; RETURN NEW; END $$`,
  'CREATE TRIGGER freeze_test_enrollment BEFORE UPDATE OR DELETE ON "OrganizationTestAllowanceEnrollment" FOR EACH ROW EXECUTE FUNCTION freeze_test_enrollment()',
  `CREATE FUNCTION check_test_attribution() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE h record; e record; b record; a jsonb; total bigint:=0; seen text[]:='{}'; source_key text;
  BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'attribution_immutable'; END IF;
    IF NEW."releaseEvidence" IS NOT NULL THEN RAISE EXCEPTION 'test_unused_proof_unsupported'; END IF;
    IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'attribution_immutable'; END IF;
    SELECT * INTO STRICT h FROM "AIUsageReservation" WHERE id=NEW."reservationId";
    SELECT * INTO STRICT e FROM "OrganizationTestAllowanceEnrollment" WHERE org=NEW.org;
    SELECT * INTO STRICT b FROM "NewTestAllowanceBasis" WHERE digest=NEW.body->>'basisDigest' AND org=NEW.org;
    IF jsonb_typeof(NEW.body) IS DISTINCT FROM 'object' OR NOT NEW.body ?& ARRAY['version','policy','runtimeId','accountId','organizationId','enrollmentDigest','basisDigest','bucketId','kind','windowStart','windowEnd','admittedAt','allocation','digest']
      OR NEW.body-ARRAY['version','policy','runtimeId','accountId','organizationId','enrollmentDigest','basisDigest','bucketId','kind','windowStart','windowEnd','admittedAt','allocation','digest']<>'{}'::jsonb
      OR h."organizationId"<>NEW.org OR NEW.body->>'organizationId' IS DISTINCT FROM NEW.org OR NEW.body->>'enrollmentDigest' IS DISTINCT FROM NEW."enrollmentDigest"
      OR e.body->>'digest' IS DISTINCT FROM NEW."enrollmentDigest" OR NEW.body->>'runtimeId' IS DISTINCT FROM e.runtime OR NEW.body->>'accountId' IS DISTINCT FROM e.account
      OR NEW.body->>'policy' IS DISTINCT FROM 'axiom_test_anniversary_v2' OR NEW.body->'version' IS DISTINCT FROM '2'::jsonb OR NEW.body->>'kind' IS DISTINCT FROM b.kind
      OR NEW.body->>'bucketId' IS NULL OR NEW.body->>'bucketId' !~ '^[a-f0-9]{64}$' OR NEW.body->>'digest' IS NULL OR NEW.body->>'digest' !~ '^[a-f0-9]{64}$'
      OR NEW.body->>'admittedAt' IS NULL OR NEW.body->>'windowStart' IS NULL OR NEW.body->>'windowEnd' IS NULL THEN RAISE EXCEPTION 'attribution_scope'; END IF;
    IF jsonb_typeof(NEW.body->'allocation') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.body->'allocation')<1 OR jsonb_array_length(NEW.body->'allocation')>101 THEN RAISE EXCEPTION 'attribution_amount'; END IF;
    FOR a IN SELECT * FROM jsonb_array_elements(NEW.body->'allocation') LOOP
      source_key:=(a->>'source')||':'||coalesce(a->>'purchaseId',a->>'bucketId');
      IF source_key IS NULL OR source_key=ANY(seen) THEN RAISE EXCEPTION 'attribution_duplicate'; END IF;
      seen:=array_append(seen,source_key);
      IF jsonb_typeof(a->'maxCents') IS DISTINCT FROM 'number' OR (a->>'maxCents')::bigint<=0 THEN RAISE EXCEPTION 'attribution_amount'; END IF;
      total:=total+(a->>'maxCents')::bigint;
      IF a->>'source'='purchase' THEN
        IF a-ARRAY['source','purchaseId','maxCents']<>'{}'::jsonb OR NOT EXISTS(SELECT 1 FROM "AddOnPurchase" WHERE id=a->>'purchaseId' AND "organizationId"=NEW.org) THEN RAISE EXCEPTION 'attribution_purchase_scope'; END IF;
      ELSIF a->>'source'='included' THEN
        IF a-ARRAY['source','bucketId','maxCents']<>'{}'::jsonb OR cardinality(seen)<>1 OR a->>'bucketId' IS DISTINCT FROM NEW.body->>'bucketId'
          OR (a->>'maxCents')::bigint>CASE WHEN b.kind='free' THEN 200 ELSE (b.body->'terms'->>'monthlyAICreditsCents')::bigint END THEN RAISE EXCEPTION 'attribution_bucket'; END IF;
      ELSE RAISE EXCEPTION 'attribution_source'; END IF;
    END LOOP;
    IF total<>h."reservedCents" OR date_trunc('milliseconds',h."createdAt") IS DISTINCT FROM (NEW.body->>'admittedAt')::timestamp
      OR (NEW.body->>'admittedAt')::timestamptz<(NEW.body->>'windowStart')::timestamptz OR (NEW.body->>'admittedAt')::timestamptz>=(NEW.body->>'windowEnd')::timestamptz THEN RAISE EXCEPTION 'attribution_amount'; END IF;
    RETURN NEW;
  END $$`,
  'CREATE TRIGGER check_test_attribution BEFORE INSERT OR UPDATE OR DELETE ON "NewTestReservationAttribution" FOR EACH ROW EXECUTE FUNCTION check_test_attribution()',
  ...fixtureUsageGuardsDDL,
];
export async function readFixtureEnrollment(tx: Prisma.TransactionClient, scope: AllocationScopeV2, lock = false): Promise<VerifiedEnrollmentV2 | null> {
  const state = await tx.$queryRawUnsafe<Array<{ installed: boolean; partial: boolean }>>(`SELECT (to_regclass('"OrganizationTestAllowanceEnrollment"') IS NOT NULL AND to_regclass('"NewTestAllowanceBasis"') IS NOT NULL AND to_regclass('"NewTestReservationAttribution"') IS NOT NULL) AS installed,(to_regclass('"OrganizationTestAllowanceEnrollment"') IS NOT NULL OR to_regclass('"NewTestAllowanceBasis"') IS NOT NULL OR to_regclass('"NewTestReservationAttribution"') IS NOT NULL) AS partial`);
  if (state[0]?.installed !== true) { if (state[0]?.partial !== false) deny(); return null; }
  const rows = await tx.$queryRawUnsafe<Array<{ body: EnrollmentV2; revision: number; free: AllowanceBasisV2; paid: AllowanceBasisV2 | null }>>(`SELECT e.body,e.revision,f.body AS free,p.body AS paid FROM "OrganizationTestAllowanceEnrollment" e JOIN "NewTestAllowanceBasis" f ON f.digest=e."freeBasisDigest" AND f.org=e.org LEFT JOIN "NewTestAllowanceBasis" p ON p.digest=e."paidBasisDigest" AND p.org=e.org WHERE e.org=$1 ${lock ? "FOR UPDATE OF e" : ""}`, scope.organizationId);
  const row = rows[0]; if (!row) return null;
  const canonical = createEnrollmentV2(scope);
  if (!row.body || row.body.digest !== canonical.digest || createEnrollmentV2(row.body).digest !== canonical.digest || row.body.version !== 2 || row.body.policy !== ANNIVERSARY_POLICY_V2 || !Number.isSafeInteger(row.revision) || row.revision < 1) deny();
  const verify = (basis: AllowanceBasisV2, kind: "free" | "paid") => { if (!basis || basis.kind !== kind || basis.enrollmentDigest !== canonical.digest || basis.runtimeId !== scope.runtimeId || basis.accountId !== scope.accountId || basis.organizationId !== scope.organizationId || createAllowanceBasisV2(basis).digest !== basis.digest) deny(); };
  verify(row.free, "free"); if (row.paid) verify(row.paid, "paid");
  if (row.revision !== (row.paid ? 2 : 1)) deny();
  return { enrollment: canonical, revision: row.revision, freeBasis: row.free as AllowanceBasisV2 & FreeBasisInputV2, paidBasis: row.paid as (AllowanceBasisV2 & PaidBasisInputV2) | null };
}
export async function insertFixtureBasis(tx: Prisma.TransactionClient, basis: AllowanceBasisV2) {
  if (createAllowanceBasisV2(basis).digest !== basis.digest) deny();
  await tx.$executeRawUnsafe('INSERT INTO "NewTestAllowanceBasis" (digest,org,runtime,account,kind,body) VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(digest) DO NOTHING', basis.digest, basis.organizationId, basis.runtimeId, basis.accountId, basis.kind, JSON.stringify(basis));
}
/** Called only by owned setup BEFORE any ledger history; no automatic enrollment. */
export async function enrollFixtureAllowanceV2(tx: Prisma.TransactionClient, scope: AllocationScopeV2) {
  const marker = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "IsolatedTestRuntime" WHERE id=$1 AND account=$2 FOR SHARE', scope.runtimeId, scope.accountId);
  if (marker.length !== 1) deny();
  if (await readFixtureEnrollment(tx, scope, true)) deny();
  const history = await tx.$queryRawUnsafe<Array<{ present: boolean }>>(`SELECT EXISTS(SELECT 1 FROM "UsageEvent" WHERE "organizationId"=$1 UNION ALL SELECT 1 FROM "AIUsageReservation" WHERE "organizationId"=$1 UNION ALL SELECT 1 FROM "RecurringSubscriptionIntent" WHERE org=$1 UNION ALL SELECT 1 FROM "OrganizationTestSubscriptionContract" WHERE org=$1 UNION ALL SELECT 1 FROM "TenantBillingPlan" WHERE "organizationId"=$1 AND ("stripeCustomerId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL)) AS present`, scope.organizationId);
  if (history[0]?.present !== false) deny();
  const enrollment = createEnrollmentV2(scope), basis = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest, kind: "free" });
  await insertFixtureBasis(tx, basis);
  await tx.$executeRawUnsafe('INSERT INTO "OrganizationTestAllowanceEnrollment" (org,runtime,account,"freeBasisDigest",revision,body) VALUES ($1,$2,$3,$4,1,$5::jsonb)', scope.organizationId, scope.runtimeId, scope.accountId, basis.digest, JSON.stringify(enrollment));
  return enrollment;
}
export async function activateFixturePaidBasis(tx: Prisma.TransactionClient, contract: Contract, intent: Intent, observation: CoverageObservation) {
  if (!intent.allowanceV2) { if (observation.collection.kind === "collected" && observation.collection.evidence.version !== 1) deny(); return; }
  const state = await readFixtureEnrollment(tx, contract, true); if (!state || state.enrollment.digest !== intent.allowanceV2.enrollmentDigest) deny();
  if (state.paidBasis) { if (state.paidBasis.origin.intentId !== intent.id || state.paidBasis.origin.createProofDigest !== originalCreateProofDigest(intent)) deny(); return; }
  if (observation.collection.kind !== "collected") deny();
  const nowRows = await tx.$queryRawUnsafe<Array<{ now: Date }>>('SELECT clock_timestamp() AS now');
  const now = nowRows[0]?.now; if (!(now instanceof Date)) deny();
  const freeWindow = resolveAllowanceWindowV2(state.freeBasis, null, now);
  if (freeWindow.kind !== "available") deny();
  resolveAllocationV2(state.freeBasis, freeWindow.window, await readAllocationFactsV2(tx, state), now);
  const basis = paidBasisForOriginalCollection(state.enrollment, intent, observation.collection.evidence);
  await insertFixtureBasis(tx, basis);
  const n = await tx.$executeRawUnsafe('UPDATE "OrganizationTestAllowanceEnrollment" SET "paidBasisDigest"=$1,revision=revision+1 WHERE org=$2 AND revision=$3 AND "paidBasisDigest" IS NULL', basis.digest, contract.organizationId, state.revision);
  if (n !== 1) deny();
}

export async function readAllocationFactsV2(tx: Prisma.TransactionClient, state: VerifiedEnrollmentV2): Promise<AllocationFactsV2> {
  const org = state.enrollment.organizationId;
  const [usage, holds, purchases] = await Promise.all([
    tx.usageEvent.findMany({ where: { organizationId: org, eventKind: "ai_invocation" }, take: 4097 }),
    tx.$queryRawUnsafe<Array<Omit<HoldV2, "attribution"> & { attribution: ReservationAttributionV2 | null }>>('SELECT h.*,a.body AS attribution FROM "AIUsageReservation" h LEFT JOIN "NewTestReservationAttribution" a ON a."reservationId"=h.id AND a.org=h."organizationId" WHERE h."organizationId"=$1 ORDER BY h.id LIMIT 4097', org),
    tx.addOnPurchase.findMany({ where: { organizationId: org }, take: 101 }),
  ]);
  if (usage.length > 4096 || holds.length > 4096 || purchases.length > 100) deny();
  return { bases: [state.freeBasis, ...(state.paidBasis ? [state.paidBasis] : [])], usage: usage as UsageV2[], holds, purchases: purchases as PurchaseV2[] };
}

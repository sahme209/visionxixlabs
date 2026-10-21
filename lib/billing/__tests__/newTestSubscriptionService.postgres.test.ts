import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { hash } from "bcryptjs";
import { deriveWorkspaceIdFromEmail } from "../../auth/workspaceId";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { createNewTestSubscriptionService, type ProviderBoundary } from "../newTestSubscription/service";
import { reserveAICredits, settleAICreditReservation } from "../aiCreditReservation";
import { applyMargin } from "../aiBillingMargin";
import { postgresFixtureStore } from "../newTestSubscription/postgresFixtureStore";
import Stripe from "stripe";
import { fixtureCoverageDDL } from "../newTestSubscription/fixtureCoverage";
import { collectedEvidence, type CoverageObservation } from "../newTestSubscription/paidCoverage";
import { paidFixture } from "./fixtures/newTestPaidFixture";
import { newTestChildEnvironment, newTestPrismaEnvironment } from "./fixtures/newTestChildEnvironment";
import { createStripeTestProvider } from "../newTestSubscription/stripeTestProvider";

import { fixtureAllocationDDL } from "../newTestSubscription/fixtureAllocation";
import { registerAnniversaryAcceptance } from "./fixtures/newTestAnniversaryAcceptance";
import { registerLegacyAgentAdmissionAcceptance } from "./fixtures/legacyAgentAdmissionAcceptance";
import { prepareAnniversaryHttp, exerciseAnniversaryHttp } from "./fixtures/newTestAnniversaryHttp";
import { ownedCheckoutLaunchPolicy } from "./fixtures/ownedCheckoutLaunchPolicy";
import { reverseAICreditRefund } from "../aiCreditFulfillment";

// File-isolated Vitest binding. The production refund writer is unchanged; its
// actual transaction/queries execute only on this explicitly owned client.
// No ambient lib/db import or fallback is possible, even when this suite skips.
const refundBinding = vi.hoisted(() => ({ client: null as PrismaClient | null, url: "", observer: null as ((pid: number) => void) | null }));
vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get(_target, key) {
  const client = refundBinding.client;
  if (!client) throw new Error("owned_refund_client_unbound");
  newTestPrismaEnvironment({}, [], refundBinding.url);
  if (key === "$transaction") return async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, options?: Parameters<PrismaClient["$transaction"]>[1]) => client.$transaction(async tx => {
    const [{ pid }] = await tx.$queryRawUnsafe<Array<{ pid: number }>>('SELECT pg_backend_pid() AS pid');
    refundBinding.observer?.(pid); return operation(tx);
  }, options);
  const value: unknown = Reflect.get(client, key); return typeof value === "function" ? value.bind(client) : value;
} }) }));

const enabled = process.env.AXIOM_RUN_OWNED_COMMERCIAL_FIXTURE === "1";
const suite = enabled ? describe : describe.skip;
suite("owned PG17 new TEST subscription service, synthetic provider only", () => {
  const name = `axiom-commercial-test-${randomBytes(6).toString("hex")}`;
  const password = randomBytes(20).toString("hex");
  let db: PrismaClient; let url = ""; let started = false;
  const stores: ReturnType<typeof postgresFixtureStore>[] = [];
  const runtime = "synthetic-runtime-1";
  const scope = { organizationId: "synthetic-org", userId: "owner" };
  const now = Date.UTC(2026, 9, 16);
  let creates = 0; let loseResponse = false; let eventId = "evt-1"; let seats = 3; let status = "active"; let priceAmount = 2900; let currentIntent = ""; let currentKey = ""; let currentDigest = ""; let currentOrg = scope.organizationId; let providerAccount = "acct-test";
  const price = () => ({ id: "price-test", livemode: false, active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount: priceAmount, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } });
  const provider: ProviderBoundary = {
    mode: () => ({ livemode: false, accountId: providerAccount }), price: async () => price(),
    create: async (request, key) => { creates++; currentKey = key; currentDigest = createHash("sha256").update(request).digest("hex"); const parsed = JSON.parse(request); currentIntent = parsed.metadata.intentId; currentOrg = parsed.metadata.organizationId; if (loseResponse) throw new Error("response lost after provider commit"); return { id: "cs-test", url: "https://checkout.stripe.com/test", accountId: providerAccount, livemode: false, originalCreateProof: { runtimeId: runtime, accountId: providerAccount, sessionId: "cs-test", outboundRequestKey: key, outboundRequestDigest: currentDigest, requestId: "req-generic-synthetic", statusCode: 200 } }; },
    verifyAndRetrieve: async (_, signature) => { if (signature !== "synthetic-verified-signature") throw new Error("invalid_signature"); return { providerRequestKey: currentKey, providerRequestDigest: currentDigest, eventId, accountId: providerAccount, livemode: false, organizationId: currentOrg, intentId: currentIntent, catalogVersion: "axiom_public_test_v1", sessionId: "cs-test", sessionStatus: "complete", paymentStatus: "paid", customerId: "cus-test", subscriptionId: "sub-test", status, seatQuantity: seats, price: price(), currentPeriodEndsAt: "2026-11-01T00:00:00.000Z", cancelAtPeriodEnd: false, coverage: syntheticCoverage(currentOrg, currentIntent, eventId) }; },
  };
  const syntheticCoverage = (org: string, intent: string, token: string, session = "cs-test", customer = "cus-test", subscription = "sub-test"): CoverageObservation => {
    const evidence = collectedEvidence({ runtimeId: runtime, accountId: "acct-test", organizationId: org, originatingIntentId: intent, sessionId: session, customerId: customer, subscriptionId: subscription, planId: "pro", interval: "monthly", seatQuantity: 3, priceId: "price-test", unitAmountCents: 2900, invoiceId: `in-${org}`, lineId: `il-${org}`, subscriptionItemId: `si-${org}`, paymentId: `inpay-${org}`, paymentIntentId: `pi-${org}`, chargeId: `ch-${org}`, paymentMethodType: "card", currency: "usd", amountCents: 8700, collectedAt: "2026-10-01T00:00:00.000Z", serviceStart: "2026-10-01T00:00:00.000Z", serviceEnd: "2026-11-01T00:00:00.000Z" });
    return { eventToken: token, latestInvoiceId: evidence.invoiceId, currentPeriodStart: evidence.serviceStart, currentPeriodEnd: evidence.serviceEnd, collection: { kind: "collected", evidence } };
  };
  const request = { clientIntentKey: "intent_key_12345678", planId: "pro" as const, interval: "monthly" as const, seatQuantity: 3, email: "synthetic@example.invalid", successUrl: "https://isolated.invalid/success", cancelUrl: "https://isolated.invalid/cancel" };
  const core = (boundary = provider) => { const store = postgresFixtureStore(url, runtime, "acct-test"); stores.push(store); return createNewTestSubscriptionService({ store, provider: boundary, configuredPrices: { "pro:monthly": "price-test" }, now: () => now, id: () => randomBytes(12).toString("hex"), digest: text => createHash("sha256").update(text).digest("hex") }); };
  beforeAll(async () => {
    execFileSync("docker", ["run", "--pull=never", "-d", "--name", name, "-e", `POSTGRES_PASSWORD=${password}`, "-e", "POSTGRES_DB=axiom_new_test_contract_rehearsal", "-p", "127.0.0.1::5432", "postgres:17-alpine"], { stdio: "pipe" }); started = true;
    const port = execFileSync("docker", ["port", name, "5432/tcp"], { encoding: "utf8" }).trim().split(":").pop();
    url = `postgresql://postgres:${password}@127.0.0.1:${port}/axiom_new_test_contract_rehearsal`;
    newTestPrismaEnvironment(process.env, process.execArgv, url);
    db = new PrismaClient({ datasources: { db: { url } } });
    refundBinding.client = db; refundBinding.url = url;
    for (let attempt = 0; ; attempt++) { try { await db.$queryRawUnsafe("SELECT 1"); break; } catch { if (attempt > 40) throw new Error("owned_fixture_not_ready"); await new Promise(resolve => setTimeout(resolve, 100)); } }
    const tables = await db.$queryRawUnsafe<Array<{ count: number }>>("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'"); expect(tables[0].count).toBe(0);
    for (const envName of [".env", ".env.local", ".env.production", "prisma/.env"]) if (existsSync(resolve(envName))) throw new Error("fixture_refuses_env_files");
    const schemaEnvironment = process.env.AXIOM_RUN_OWNED_CHECKOUT_HTTP === "1" || process.env.AXIOM_RUN_OWNED_COMMERCIAL_HTTP === "1"
      ? (await import("./fixtures/ownedCheckoutLaunchPolicy")).ownedCheckoutPrismaEnvironment(process.env, process.execArgv, url)
      : newTestPrismaEnvironment(process.env, process.execArgv, url);
    execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", resolve("prisma/schema.prisma")], { cwd: process.cwd(), env: schemaEnvironment, stdio: "pipe" });
    const sql = [
      'CREATE TABLE "IsolatedTestRuntime" (id text PRIMARY KEY,account text NOT NULL)',
      'CREATE TABLE "RecurringSubscriptionIntent" (id text PRIMARY KEY,org text NOT NULL,body jsonb NOT NULL,UNIQUE(id,org))',
      'CREATE TABLE "RecurringSubscriptionPurchaseFence" (org text PRIMARY KEY,intent text UNIQUE NOT NULL,FOREIGN KEY(intent,org) REFERENCES "RecurringSubscriptionIntent"(id,org))',
      'CREATE TABLE "OrganizationTestSubscriptionContract" (org text PRIMARY KEY,intent text UNIQUE NOT NULL,customer text UNIQUE NOT NULL,subscription text UNIQUE NOT NULL,body jsonb NOT NULL,FOREIGN KEY(intent,org) REFERENCES "RecurringSubscriptionIntent"(id,org))',
    ];
    // Expression uniqueness is created as a separate index in PostgreSQL.
    for (const [stage, statements] of [["base", sql], ["coverage", fixtureCoverageDDL], ["allocation", fixtureAllocationDDL]] as const) {
      for (let index = 0; index < statements.length; index++) {
        try { await db.$executeRawUnsafe(statements[index]); }
        catch { throw new Error(`owned_fixture_ddl_failed_${stage}_${index}`); } // Fixed stage/index only; no raw SQL, URL or error dump.
      }
    }
    await db.$executeRawUnsafe('CREATE UNIQUE INDEX intent_client_key ON "RecurringSubscriptionIntent" (org,(body->>\'clientIntentKey\'))');
    await db.$executeRawUnsafe(`CREATE FUNCTION freeze_test_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF OLD.id IS DISTINCT FROM NEW.id OR OLD.org IS DISTINCT FROM NEW.org THEN RAISE EXCEPTION 'immutable_intent_identity'; END IF;
      IF (OLD.body - ARRAY['state','sessionId','customerId','subscriptionId','revision','originalCreateProof']) IS DISTINCT FROM (NEW.body - ARRAY['state','sessionId','customerId','subscriptionId','revision','originalCreateProof']) THEN RAISE EXCEPTION 'immutable_intent'; END IF;
      IF OLD.body ? 'originalCreateProof' THEN
        IF OLD.body->'originalCreateProof' IS DISTINCT FROM NEW.body->'originalCreateProof' THEN RAISE EXCEPTION 'original_proof_immutable'; END IF;
      ELSIF NEW.body ? 'originalCreateProof' THEN
        IF OLD.body->>'state' <> 'attempted' OR NEW.body->>'state' <> 'session_confirmed' OR OLD.body->>'sessionId' IS NOT NULL
          OR jsonb_typeof(NEW.body->'originalCreateProof') <> 'object'
          OR NEW.body->>'sessionId' IS NULL OR NEW.body->'originalCreateProof'->>'sessionId' IS DISTINCT FROM NEW.body->>'sessionId'
          OR NEW.body->'originalCreateProof'->>'runtimeId' IS DISTINCT FROM OLD.body->>'runtimeId'
          OR NEW.body->'originalCreateProof'->>'accountId' IS DISTINCT FROM OLD.body->>'accountId'
          OR NEW.body->'originalCreateProof'->>'outboundRequestKey' IS DISTINCT FROM OLD.body->>'providerIdempotencyKey'
          OR NEW.body->'originalCreateProof'->>'outboundRequestDigest' IS DISTINCT FROM OLD.body->>'requestDigest'
          OR jsonb_typeof(NEW.body->'originalCreateProof'->'requestId') IS DISTINCT FROM 'string'
          OR COALESCE(NEW.body->'originalCreateProof'->>'requestId','') = ''
          OR (NEW.body->'originalCreateProof' ? 'observedIdempotencyKey' AND NEW.body->'originalCreateProof'->>'observedIdempotencyKey' IS DISTINCT FROM OLD.body->>'providerIdempotencyKey')
          OR (NEW.body->'originalCreateProof' ? 'observedAccountId' AND NEW.body->'originalCreateProof'->>'observedAccountId' IS DISTINCT FROM OLD.body->>'accountId')
          OR COALESCE((NEW.body->'originalCreateProof'->>'statusCode')::int,0) NOT BETWEEN 200 AND 299
          THEN RAISE EXCEPTION 'original_proof_capture_invalid'; END IF;
      END IF;
      IF ((OLD.body->>'revision')::int + 1) <> (NEW.body->>'revision')::int THEN RAISE EXCEPTION 'revision_changed'; END IF;
      IF OLD.body->>'sessionId' IS NOT NULL AND OLD.body->>'sessionId' IS DISTINCT FROM NEW.body->>'sessionId' THEN RAISE EXCEPTION 'session_changed'; END IF;
      IF OLD.body->>'subscriptionId' IS NOT NULL AND OLD.body->>'subscriptionId' IS DISTINCT FROM NEW.body->>'subscriptionId' THEN RAISE EXCEPTION 'subscription_changed'; END IF;
      IF OLD.body->>'customerId' IS NOT NULL AND OLD.body->>'customerId' IS DISTINCT FROM NEW.body->>'customerId' THEN RAISE EXCEPTION 'customer_changed'; END IF;
      RETURN NEW; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER freeze_test_intent BEFORE UPDATE ON "RecurringSubscriptionIntent" FOR EACH ROW EXECUTE FUNCTION freeze_test_intent()');
    await db.$executeRawUnsafe(`CREATE FUNCTION freeze_test_contract() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF OLD.org IS DISTINCT FROM NEW.org OR OLD.intent IS DISTINCT FROM NEW.intent OR OLD.customer IS DISTINCT FROM NEW.customer OR OLD.subscription IS DISTINCT FROM NEW.subscription OR OLD.body IS DISTINCT FROM NEW.body THEN RAISE EXCEPTION 'immutable_contract'; END IF;

      RETURN NEW; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER freeze_test_contract BEFORE UPDATE ON "OrganizationTestSubscriptionContract" FOR EACH ROW EXECUTE FUNCTION freeze_test_contract()');
    await db.$executeRawUnsafe('INSERT INTO "IsolatedTestRuntime" VALUES ($1,$2)', runtime, "acct-test");
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_observation_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."lastStripeEventId"='evt-injected-rollback' THEN RAISE EXCEPTION 'fixture_write_failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER fail_observation_fixture AFTER UPDATE ON "TenantBillingPlan" FOR EACH ROW EXECUTE FUNCTION fail_observation_fixture()');
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_coverage_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.body->>'eventToken'='evt-coverage-rollback' THEN RAISE EXCEPTION 'fixture_coverage_failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER fail_coverage_fixture AFTER INSERT OR UPDATE ON "OrganizationTestCoverageObservation" FOR EACH ROW EXECUTE FUNCTION fail_coverage_fixture()');
    for (const userId of ["owner", "member-2", "member-3"]) await db.orgMembership.create({ data: { userId, organizationId: scope.organizationId, role: userId === "owner" ? "owner" : "read_only", acceptedAt: new Date(now) } });
    await db.usageEvent.create({ data: { organizationId: scope.organizationId, eventKind: "ai_invocation", billedCents: 100, createdAt: new Date(now) } });
    await db.aIUsageReservation.create({ data: { organizationId: scope.organizationId, idempotencyKey: "synthetic_pending_hold", reservedCents: 250, status: "pending_settlement", expiresAt: new Date(now - 1000) } });
    await db.addOnPurchase.create({ data: { organizationId: scope.organizationId, sku: "ai_credits_small", pricePaidCents: 500, deliveredAICreditsCents: 500, validFor: "current_month", periodMonth: "2026-10", status: "paid", idempotencyKey: "synthetic_topup", purchasedBy: "owner", correlationId: "fixture" } });

  }, 30000);
  afterAll(async () => {
    refundBinding.client = null; refundBinding.url = ""; refundBinding.observer = null;
    const outcomes = await Promise.allSettled(stores.map(store => store.disconnect()));
    if (db) outcomes.push(...await Promise.allSettled([db.$disconnect()]));
    if (started) { try { execFileSync("docker", ["rm", "-f", name], { stdio: "pipe" }); } catch (error) { outcomes.push({ status: "rejected", reason: error }); } }
    const failed = outcomes.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed.length) throw new AggregateError(failed.map(result => result.reason), "owned_fixture_cleanup_failed");
  });
  it("binds captured original collection once, protects financial/tenant state and models monthly remaining pool", async () => {
    expect(applyMargin(2)).toBe(3); // reuse established actual-cost ledger arithmetic; no new pricing formula
    const service = core();
    const intent = await service.prepare(scope, request); expect(intent.terms.monthlyAICreditsCents).toBe(3000);
    expect((await service.prepare(scope, request)).id).toBe(intent.id);
    await expect(service.prepare(scope, { ...request, clientIntentKey: "different_key_123456" })).rejects.toThrow("unresolved_purchase_exists");
    providerAccount = "acct-other";
    await expect(service.attempt(scope, intent.id)).rejects.toThrow("intent_unavailable"); expect(creates).toBe(0);
    providerAccount = "acct-test";
    loseResponse = false;
    expect(await service.attempt(scope, intent.id)).toMatchObject({ kind: "checkout_ready" });
    expect(creates).toBe(1);
    await expect(service.attempt(scope, intent.id)).rejects.toThrow("observe_existing"); expect(creates).toBe(1);
    await expect(service.reconcile("synthetic", "bad", scope.organizationId)).rejects.toThrow("invalid_signature");
    const originalKey = currentKey; currentKey = "unrelated_attempt";
    await expect(service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).rejects.toThrow("attempt_provenance_unavailable");
    currentKey = originalKey;
    expect(await service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).toBe("applied");
    expect(await service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).toBe("replay");
    expect(await service.previewRemaining(scope)).toMatchObject({ remainingCents: 3150, operationalPermit: false, invoiceSubmissionEnabled: false, month: "2026-10" });
    const hold = await stores[0].reserveCredits(scope, { idempotencyKey: "actual_app_hold_123456", reservedCents: 3000 }, new Date(now));
    expect(hold.ok).toBe(true);
    expect(await stores[0].reserveCredits(scope, { idempotencyKey: "actual_app_over_cap_123", reservedCents: 151 }, new Date(now))).toMatchObject({ ok: false, error: "ai_credit_pool_exhausted" });
    const settled = await db.usageEvent.create({ data: { organizationId: scope.organizationId, eventKind: "ai_invocation", costCents: 2, billedCents: applyMargin(2), createdAt: new Date(now) } });
    if (!hold.ok) throw new Error("fixture_hold_missing");
    expect(await settleAICreditReservation(db, scope.organizationId, hold.reservation.id, settled.billedCents, settled.id, new Date(now))).toBe(true);
    providerAccount = "acct-other";
    await expect(service.previewRemaining(scope)).rejects.toThrow("new_test_contract_unavailable");
    providerAccount = "acct-test";
    eventId = "evt-2"; seats = 1;
    await expect(service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).rejects.toThrow();
    seats = 3;
    expect(await service.previewRemaining(scope)).toMatchObject({ remainingCents: 3147 });
    eventId = "evt-1"; seats = 3;
    expect(await service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).toBe("replay");
    expect(await service.previewRemaining(scope)).toMatchObject({ remainingCents: 3147 });
    eventId = "evt-invalid"; priceAmount = 1;
    await expect(service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).rejects.toThrow("signed_terms_mismatch");
    expect(await db.$queryRawUnsafe('SELECT id FROM "StripeBillingEvent" WHERE id=$1', eventId)).toEqual([]);
    priceAmount = 2900; eventId = "evt-injected-rollback";
    await expect(service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).rejects.toThrow();
    expect(await db.$queryRawUnsafe('SELECT id FROM "StripeBillingEvent" WHERE id=$1', eventId)).toEqual([]);
    expect(await service.previewRemaining(scope)).toMatchObject({ remainingCents: 3147 });
    await expect(db.$executeRawUnsafe(`UPDATE "RecurringSubscriptionIntent" SET body=jsonb_set(body,'{terms,seatQuantity}','999') WHERE id=$1`, intent.id)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE "OrganizationTestSubscriptionContract" SET customer='different' WHERE org=$1`, scope.organizationId)).rejects.toThrow();
    priceAmount = 2900; status = "past_due"; eventId = "evt-3";
    await service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId);
    expect(await service.previewRemaining(scope)).toMatchObject({ remainingCents: 347 });
    await db.orgMembership.updateMany({ where: { organizationId: scope.organizationId }, data: { role: "read_only" } });
    await expect(service.previewRemaining(scope)).rejects.toThrow("test_manager_required");
    expect(await stores[0].reserveCredits(scope, { idempotencyKey: "actual_app_hold_123456", reservedCents: 3000 }, new Date(now))).toMatchObject({ ok: false, error: "ai_credit_reservation_unavailable" });
    expect(creates).toBe(1);
  });
  it("fences concurrent provider snapshots with opaque local token equality, not event ordering", async () => {
    status = "active"; priceAmount = 2900; seats = 3;
    let arrived = 0; let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const boundary = (id: string): ProviderBoundary => ({ ...provider, verifyAndRetrieve: async (raw, signature) => {
      const snapshot = await provider.verifyAndRetrieve(raw, signature); if (snapshot.kind === "unsupported_bound_terms") throw new Error("unexpected_fixture_verdict"); arrived++; if (arrived === 2) release();
      await barrier; return { ...snapshot, eventId: id, coverage: { ...snapshot.coverage, eventToken: id } };
    } });
    const outcomes = await Promise.allSettled([core(boundary("evt-race-a")).reconcile("synthetic", "synthetic-verified-signature", scope.organizationId), core(boundary("evt-race-b")).reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await db.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "StripeBillingEvent" WHERE id IN ('evt-race-a','evt-race-b')`)).toEqual([{ count: 1 }]);
  });
  it("actual separate-client Serializable purchase race retains only one unresolved organization intent", async () => {
    const racing = { organizationId: "synthetic-race", userId: "owner" };
    for (const userId of ["owner", "member-2", "member-3"]) await db.orgMembership.create({ data: { userId, organizationId: racing.organizationId, role: userId === "owner" ? "owner" : "read_only", acceptedAt: new Date(now) } });
    const results = await Promise.allSettled([core().prepare(racing, { ...request, clientIntentKey: "race_key_111111111" }), core().prepare(racing, { ...request, clientIntentKey: "race_key_222222222" })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "RecurringSubscriptionPurchaseFence" WHERE org=$1', racing.organizationId)).toEqual([{ count: 1 }]);
    expect(await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "RecurringSubscriptionIntent" WHERE org=$1', racing.organizationId)).toEqual([{ count: 1 }]);
  });
  it("original response proof captures once in real intent CAS and cannot be rewritten", async () => {
    const actor = { userId: "owner", organizationId: "original-proof-org" };
    for (const userId of ["owner", "proof-member-2", "proof-member-3"]) await db.orgMembership.create({ data: { userId, organizationId: actor.organizationId, role: userId === "owner" ? "owner" : "read_only", acceptedAt: new Date(now) } });
    loseResponse = false; providerAccount = "acct-test";
    const boundary: ProviderBoundary = { ...provider, create: async (body, key) => ({ ...await provider.create(body, key), originalCreateProof: {
      runtimeId: runtime, accountId: "acct-test", sessionId: "cs-test", outboundRequestKey: key, outboundRequestDigest: createHash("sha256").update(body).digest("hex"), requestId: "req-synthetic-original", statusCode: 200,
    } }) };
    const service = core(boundary); const i = await service.prepare(actor, { ...request, clientIntentKey: "original_proof_key_123" });
    expect(await service.attempt(actor, i.id)).toMatchObject({ kind: "checkout_ready" });
    const rows = await db.$queryRawUnsafe<Array<{ body: import("../newTestSubscription/service").Intent }>>('SELECT body FROM "RecurringSubscriptionIntent" WHERE id=$1', i.id);
    expect(rows[0].body).toMatchObject({ state: "session_confirmed", originalCreateProof: { requestId: "req-synthetic-original", outboundRequestDigest: i.requestDigest } });
    const rewritten = { ...rows[0].body, revision: rows[0].body.revision + 1, originalCreateProof: { ...rows[0].body.originalCreateProof!, requestId: "req-rewrite" } };
    await expect(db.$executeRawUnsafe('UPDATE "RecurringSubscriptionIntent" SET body=$1::jsonb WHERE id=$2', JSON.stringify(rewritten), i.id)).rejects.toThrow();
    const after = await db.$queryRawUnsafe<Array<{ body: typeof i }>>('SELECT body FROM "RecurringSubscriptionIntent" WHERE id=$1', i.id);
    expect(after[0].body).toEqual(rows[0].body);
  });
  it("inactive SDK lifecycle preserves immutable origin and financial evidence through actual durable PG consumer", async () => {
    const actor = { userId: "owner", organizationId: "sdk-lifecycle-org" };
    for (const userId of ["owner", "lifecycle-member-2", "lifecycle-member-3"]) await db.orgMembership.create({ data: { userId, organizationId: actor.organizationId, role: userId === "owner" ? "owner" : "read_only", acceptedAt: new Date(now) } });
    const sdk = new Stripe("sk_test_synthetic");
    const canonicalPrice = { ...price(), product: { id: "prod-test", livemode: false, active: true } };
    let metadata: Record<string, string> = {}; let quantity = 3; let lifecycleStatus = "active"; let cancel = false; const period = Date.UTC(2026, 10, 1) / 1000; let created = 0;
    const paid = paidFixture({ runtimeId: runtime, accountId: "acct-test", organizationId: actor.organizationId, sessionId: "cs-sdk-lifecycle", customerId: "cus-sdk-lifecycle", subscriptionId: "sub-sdk-lifecycle", priceId: "price-test" }); paid.line.pricing.price_details.product = "prod-test";
    const session = () => ({ invoice: paid.invoice.id, id: "cs-sdk-lifecycle", livemode: false, mode: "subscription", status: "complete", payment_status: "paid", customer: "cus-sdk-lifecycle", subscription: "sub-sdk-lifecycle", metadata, line_items: { has_more: false, data: [{ quantity: 3, price: canonicalPrice }] } });
    const subscription = () => ({ latest_invoice: paid.invoice.id, id: "sub-sdk-lifecycle", livemode: false, customer: "cus-sdk-lifecycle", metadata, status: lifecycleStatus, cancel_at_period_end: cancel, items: { has_more: false, data: [{ id: "si_test", quantity, price: canonicalPrice, current_period_start: paid.line.period.start, current_period_end: period }] } });
    const client = { ...paid.client, accounts: { retrieve: async () => ({ id: "acct-test" }) }, prices: { retrieve: async () => canonicalPrice },
      checkout: { sessions: { create: async (input: Stripe.Checkout.SessionCreateParams) => { created++; metadata = input.subscription_data!.metadata as Record<string, string>; return { ...session(), url: "https://checkout.stripe.com/test", lastResponse: { requestId: "req-sdk-original", statusCode: 200 } }; }, retrieve: async () => session() } },
      subscriptions: { retrieve: async () => subscription() }, webhooks: sdk.webhooks };
    const store = postgresFixtureStore(url, runtime, "acct-test"); stores.push(store);
    const adapter = createStripeTestProvider({ secretKey: "sk_test_synthetic", webhookSecret: "whsec_synthetic", expectedAccountId: "acct-test", store, configuredPrices: { "pro:monthly": "price-test" }, sdkFactory: () => client as unknown as Stripe });
    const service = core(adapter); const origin = await service.prepare(actor, { ...request, clientIntentKey: "sdk_lifecycle_key_123" });
    expect(await service.attempt(actor, origin.id)).toMatchObject({ kind: "checkout_ready" });
    const deliver = async (id: string, type = "customer.subscription.updated", hint?: unknown) => {
      const object = hint ?? (type === "checkout.session.completed" ? session() : type.startsWith("invoice.") ? paid.invoice : type === "charge.refunded" ? paid.charge : { ...subscription(), status: "canceled" });
      const raw = JSON.stringify({ id, type, livemode: false, data: { object } });
      return service.reconcile(raw, sdk.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_synthetic" }), actor.organizationId);
    };
    expect(await deliver("evt-sdk-bound", "checkout.session.completed")).toBe("applied");
    await db.usageEvent.create({ data: { organizationId: actor.organizationId, eventKind: "ai_invocation", billedCents: 700, createdAt: new Date(now) } });
    await db.aIUsageReservation.create({ data: { organizationId: actor.organizationId, idempotencyKey: "lifecycle_unresolved_hold", reservedCents: 250, status: "pending_settlement", expiresAt: new Date(0) } });
    await db.addOnPurchase.create({ data: { organizationId: actor.organizationId, sku: "ai_credits_small", pricePaidCents: 500, deliveredAICreditsCents: 500, validFor: "current_month", periodMonth: "2026-10", status: "paid", idempotencyKey: "lifecycle_existing_topup", purchasedBy: "owner", correlationId: "fixture" } });
    const financial = async () => ({ usage: await db.usageEvent.findMany({ where: { organizationId: actor.organizationId } }), holds: await db.aIUsageReservation.findMany({ where: { organizationId: actor.organizationId } }), credits: await db.addOnPurchase.findMany({ where: { organizationId: actor.organizationId } }) });
    const before = await financial();
    cancel = true;
    expect(await deliver("evt-sdk-scheduled")).toBe("applied");
    expect(await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } })).toMatchObject({ status: "active", seatQuantity: 3, cancelAtPeriodEnd: true, currentPeriodEndsAt: new Date(period * 1000) });
    expect(await db.stripeBillingEvent.findUnique({ where: { id: "evt-sdk-scheduled" } })).toMatchObject({ type: "customer.subscription.updated" });
    expect(await service.previewRemaining(actor)).toMatchObject({ remainingCents: 2550 });
    const planBeforeReplay = await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } });
    const intentBeforeReplay = await store.transaction(tx => tx.intent(origin.id));
    const revisionBeforeReplay = (await store.transaction(tx => tx.coverage(actor.organizationId)))!.revision;
    paid.invoice.status = "open";
    expect(await deliver("evt-sdk-scheduled")).toBe("replay");
    await expect(service.previewRemaining(actor)).rejects.toThrow("paid_coverage_unavailable");
    expect(await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } })).toEqual(planBeforeReplay);
    expect(await store.transaction(tx => tx.intent(origin.id))).toEqual(intentBeforeReplay);
    expect((await store.transaction(tx => tx.coverage(actor.organizationId)))!.revision).toBe(revisionBeforeReplay + 1);
    paid.invoice.status = "paid";
    expect(await deliver("evt-sdk-scheduled")).toBe("replay");
    await expect(service.previewRemaining(actor)).rejects.toThrow("paid_coverage_unavailable");
    expect(await deliver("evt-sdk-fresh-collected-after-replay")).toBe("applied");
    expect(await service.previewRemaining(actor)).toMatchObject({ remainingCents: 2550 });
    expect(await financial()).toEqual(before);
    const originalCollection = await store.transaction(tx => tx.coverage(actor.organizationId));
    const originalInvoice = structuredClone(paid.invoice);
    paid.invoice.id = "in_next_open"; paid.invoice.status = "open";
    expect(await deliver("evt-sdk-open-renewal", "invoice.payment_failed")).toBe("applied");
    await expect(service.previewRemaining(actor)).rejects.toThrow("paid_coverage_unavailable");
    expect(await store.reserveCredits(actor, { idempotencyKey: "open_renewal_no_hold", reservedCents: 1 }, new Date(now))).toMatchObject({ ok: false, error: "ai_credit_reservation_unavailable" });
    expect(await deliver("evt-sdk-old-paid", "invoice.paid", originalInvoice)).toBe("applied");
    await expect(service.previewRemaining(actor)).rejects.toThrow("paid_coverage_unavailable");
    paid.invoice.status = "uncollectible";
    expect(await deliver("evt-sdk-uncollectible", "invoice.marked_uncollectible")).toBe("applied");
    await expect(service.previewRemaining(actor)).rejects.toThrow("paid_coverage_unavailable");
    Object.assign(paid.invoice, originalInvoice); paid.invoice.lines.data = [paid.line]; paid.charge.amount_refunded = 1;
    expect(await deliver("evt-sdk-refunded", "charge.refunded")).toBe("applied");
    await expect(service.previewRemaining(actor)).rejects.toThrow("paid_coverage_unavailable");
    expect((await store.transaction(tx => tx.coverage(actor.organizationId)))?.originalEvidence).toEqual(originalCollection?.originalEvidence);
    // A separate full cash invoice, not a reversed refund or active status,
    // restores eligibility in this synthetic provider fixture.
    paid.invoice.id = "in_recovery"; paid.line.id = "il_recovery";
    paid.payment.id = "inpay_recovery"; paid.payment.invoice = paid.invoice.id; paid.payment.payment.payment_intent = "pi_recovery";
    paid.paymentIntent.id = "pi_recovery"; paid.paymentIntent.latest_charge = "ch_recovery";
    paid.charge.id = "ch_recovery"; paid.charge.payment_intent = "pi_recovery"; paid.charge.amount_refunded = 0;
    const beforeCoverageRollback = await store.transaction(tx => tx.coverage(actor.organizationId));
    const planBeforeCoverageRollback = await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } });
    await expect(deliver("evt-coverage-rollback", "invoice.paid")).rejects.toThrow();
    expect(await db.stripeBillingEvent.findUnique({ where: { id: "evt-coverage-rollback" } })).toBeNull();
    expect(await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } })).toEqual(planBeforeCoverageRollback);
    expect(await store.transaction(tx => tx.coverage(actor.organizationId))).toEqual(beforeCoverageRollback);
    expect(await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "NewTestPaidInvoiceEvidence" WHERE org=$1', actor.organizationId)).toEqual([{ count: 1 }]);
    expect(await deliver("evt-sdk-cash-recovery", "invoice.paid")).toBe("applied");
    expect(await service.previewRemaining(actor)).toMatchObject({ remainingCents: 2550 });
    expect(await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "NewTestPaidInvoiceEvidence" WHERE org=$1', actor.organizationId)).toEqual([{ count: 2 }]);
    expect(await financial()).toEqual(before);
    await expect(db.$executeRawUnsafe('UPDATE "NewTestPaidInvoiceEvidence" SET body=body WHERE org=$1', actor.organizationId)).rejects.toThrow("paid_evidence_immutable");
    for (const changed of [4, 2]) {
      quantity = changed;
      const planBeforeChange = await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } });
      expect(await deliver(`evt-sdk-seat-change-${changed}`)).toBe("unavailable");
      expect(await db.stripeBillingEvent.findUnique({ where: { id: `evt-sdk-seat-change-${changed}` } })).toBeNull();
      expect(await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } })).toEqual(planBeforeChange);
      expect(await financial()).toEqual(before); await expect(service.previewRemaining(actor)).rejects.toThrow("paid_coverage_unavailable");
      quantity = 3; expect(await deliver(`evt-sdk-restored-original-${changed}`)).toBe("applied");
      expect(await service.previewRemaining(actor)).toMatchObject({ remainingCents: 2550 });
    }
    quantity = 3;
    lifecycleStatus = "unpaid"; cancel = false;
    expect(await deliver("evt-sdk-failed")).toBe("applied"); expect(await service.previewRemaining(actor)).toMatchObject({ remainingCents: 0 });
    expect(await store.reserveCredits(actor, { idempotencyKey: "lifecycle_fail_no_hold", reservedCents: 1 }, new Date(now))).toMatchObject({ ok: false, error: "ai_credit_pool_exhausted" });
    lifecycleStatus = "active"; // Recovery requires the same current paid invoice coverage, never status alone.
    expect(await deliver("evt-sdk-recovered-collected", "customer.subscription.created")).toBe("applied");
    expect(await service.previewRemaining(actor)).toMatchObject({ remainingCents: 2550 });
    expect(await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } })).toMatchObject({ currentPeriodEndsAt: new Date(period * 1000), cancelAtPeriodEnd: false, seatQuantity: 3 });
    expect(await deliver("evt-sdk-distinct-delayed")).toBe("applied"); expect(await service.previewRemaining(actor)).toMatchObject({ remainingCents: 2550 });
    expect(await deliver("evt-sdk-failed")).toBe("replay"); expect(await service.previewRemaining(actor)).toMatchObject({ remainingCents: 2550 });
    lifecycleStatus = "past_due";
    await expect(deliver("evt-injected-rollback")).rejects.toThrow();
    expect(await db.stripeBillingEvent.findUnique({ where: { id: "evt-injected-rollback" } })).toBeNull();
    expect(await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } })).toMatchObject({ status: "active", lastStripeEventId: "evt-sdk-distinct-delayed" });
    lifecycleStatus = "canceled";
    expect(await deliver("evt-sdk-deleted", "customer.subscription.deleted")).toBe("applied"); expect(await service.previewRemaining(actor)).toMatchObject({ remainingCents: 0 });
    expect(await db.stripeBillingEvent.findUnique({ where: { id: "evt-sdk-deleted" } })).toMatchObject({ type: "customer.subscription.deleted" });
    expect(await financial()).toEqual(before);
    const persisted = await store.transaction(tx => tx.intent(origin.id)); expect(persisted?.terms).toEqual(origin.terms); expect(persisted?.originalCreateProof?.requestId).toBe("req-sdk-original"); expect(created).toBe(1);
  });
  it("response loss retains unknown intent and cannot bind even a synthetic paid observation", async () => {
    const actor = { organizationId: "lost-original-proof-org", userId: "owner" };
    for (const userId of ["owner", "lost-member-2", "lost-member-3"]) await db.orgMembership.create({ data: { userId, organizationId: actor.organizationId, role: userId === "owner" ? "owner" : "read_only", acceptedAt: new Date() } });
    const service = core(); const intent = await service.prepare(actor, { ...request, clientIntentKey: "lost_response_key_123" });
    loseResponse = true; eventId = "evt-lost-original-proof";
    try {
      expect(await service.attempt(actor, intent.id)).toEqual({ kind: "reconciliation_required" });
      await expect(service.reconcile("synthetic", "synthetic-verified-signature", actor.organizationId)).rejects.toThrow("attempt_provenance_unavailable");
      expect(await db.stripeBillingEvent.findUnique({ where: { id: eventId } })).toBeNull();
      expect(await db.tenantBillingPlan.findUnique({ where: { organizationId: actor.organizationId } })).toBeNull();
      expect(await db.$queryRawUnsafe('SELECT org FROM "OrganizationTestCoverageObservation" WHERE org=$1', actor.organizationId)).toEqual([]);
    } finally { loseResponse = false; }
  });
  it("missing new provenance fails closed only for explicit lane; legacy reservation remains independent", async () => {
    await db.orgMembership.updateMany({ where: { organizationId: scope.organizationId, userId: scope.userId }, data: { role: "owner" } });
    await db.$executeRawUnsafe('ALTER TABLE "OrganizationTestSubscriptionContract" RENAME TO "HiddenFixtureContract"');
    try {
      expect(await stores[0].reserveCredits(scope, { idempotencyKey: "new_lane_missing_contract", reservedCents: 1 }, new Date(now))).toMatchObject({ ok: false });
      const legacy = await reserveAICredits(db, { organizationId: "unchanged_legacy", idempotencyKey: "legacy_unchanged_123456", reservedCents: 1 }, new Date(now));
      expect(legacy.ok).toBe(true);
    } finally { await db.$executeRawUnsafe('ALTER TABLE "HiddenFixtureContract" RENAME TO "OrganizationTestSubscriptionContract"'); }
  });

  it.runIf(process.env.AXIOM_RUN_OWNED_COMMERCIAL_HTTP === "1")("actual local Next HTTP authenticates, reads versioned allowance, denies unsupported operations and releases provider-disabled hold", async () => {
    const email = "bridge-synthetic@example.invalid", password = randomBytes(20).toString("hex");
    const user = await db.user.create({ data: { email, passwordHash: await hash(password, 4), emailVerifiedAt: new Date(), plan: null } });
    const org = String(deriveWorkspaceIdFromEmail(email));
    const actor = { organizationId: org, userId: user.id };
    for (const userId of [user.id, "bridge-member-2", "bridge-member-3"]) await db.orgMembership.create({ data: { userId, organizationId: org, role: userId === user.id ? "owner" : "read_only", acceptedAt: new Date() } });
    loseResponse = false; status = "active"; seats = 3; priceAmount = 2900;
    let httpEvent = "evt-http"; let httpStatus = "active"; let httpSeats = 3; let httpCancel = false;
    let httpCollection: "collected" | "unsupported" | "expired" = "collected";
    const httpCoverage = () => {
      const o = syntheticCoverage(org, currentIntent, httpEvent, "cs-http", "cus-http", "sub-http");
      if (httpCollection === "unsupported") o.collection = { kind: "unavailable", reason: "not_collected" };
      if (httpCollection === "expired" && o.collection.kind === "collected") {
        const e = collectedEvidence({ ...o.collection.evidence, invoiceId: "in-http-expired", serviceStart: "2026-09-01T00:00:00.000Z", serviceEnd: "2026-10-01T00:00:00.000Z", collectedAt: "2026-09-01T00:00:00.000Z" });
        o.latestInvoiceId = e.invoiceId; o.currentPeriodStart = e.serviceStart; o.currentPeriodEnd = e.serviceEnd; o.collection = { kind: "collected", evidence: e };
      }
      return o;
    };
    let httpType: "checkout.session.completed" | "customer.subscription.updated" | "customer.subscription.deleted" = "checkout.session.completed";
    const httpProvider: ProviderBoundary = { ...provider,
      create: async (request, key) => ({ ...await provider.create(request, key), id: "cs-http", originalCreateProof: { runtimeId: runtime, accountId: "acct-test", sessionId: "cs-http", outboundRequestKey: key, outboundRequestDigest: createHash("sha256").update(request).digest("hex"), requestId: "req-synthetic-http-original", statusCode: 200 } }),
      verifyAndRetrieve: async (raw, signature) => ({ ...await provider.verifyAndRetrieve(raw, signature), eventId: httpEvent, organizationId: org, sessionId: "cs-http", customerId: "cus-http", subscriptionId: "sub-http", status: httpStatus, seatQuantity: httpSeats,
        eventType: httpType, currentPeriodEndsAt: httpCoverage().currentPeriodEnd, cancelAtPeriodEnd: httpCancel, coverage: httpCoverage() }),
    };
    const setup = core(httpProvider); const httpStore = stores[stores.length - 1]; const intent = await setup.prepare(actor, { ...request, email }); await setup.attempt(actor, intent.id);
    await setup.reconcile("synthetic-provider-evidence", "synthetic-verified-signature", org);
    await db.organizationAIProviderPolicy.create({ data: { organizationId: org, enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "openai/gpt-4o-mini" }, fallbackOrder: ["vercel_gateway"], updatedBy: user.id } });
    await db.aIUsageReservation.create({ data: { organizationId: org, idempotencyKey: "http_pending_hold_123", reservedCents: 250, status: "pending_settlement", expiresAt: new Date(0) } });
    const anniversaryHttp = await prepareAnniversaryHttp({ db, url, runtime, stores });
    const listener = createServer(); await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
    const address = listener.address(); if (!address || typeof address === "string") throw new Error("fixture_port_unavailable"); const port = address.port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    const base = `http://127.0.0.1:${port}`, temporary = mkdtempSync(resolve(tmpdir(), "axiom-http-font-"));
    const fonts = resolve(temporary, "fonts.cjs");
    const fontCss = "@font-face { font-family: Isolated; src: url(https://synthetic.invalid/font.woff2); }";
    writeFileSync(fonts, `module.exports = new Proxy({}, { get: () => ${JSON.stringify(fontCss)} });`);

    let childEnv: NodeJS.ProcessEnv;
    try {
      const launch = ownedCheckoutLaunchPolicy(process.env, process.execArgv);
      childEnv = { ...launch.env, ...newTestChildEnvironment(process.env, process.execArgv, { databaseUrl: url, appOrigin: base, fontResponses: fonts,
        runtimeId: runtime, accountId: "acct-test", organizationId: `${org},${anniversaryHttp.fixture.actor.organizationId}`, authSecret: randomBytes(32).toString("hex") }) };
      launch.revalidate(process.env); launch.revalidate(childEnv, "child");
    }
    catch (error) { rmSync(temporary, { recursive: true, force: true }); throw error; }
    const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), detached: true, stdio: "pipe", env: childEnv });
    let output = ""; child.stdout?.on("data", chunk => { output += chunk; }); child.stderr?.on("data", chunk => { output += chunk; });
    const jar = new Map<string, string>();
    const http = async (path: string, init: RequestInit = {}) => { const response = await fetch(base + path, { ...init, redirect: "manual", headers: { ...Object.fromEntries(new Headers(init.headers)), cookie: [...jar.values()].join("; ") } }); for (const item of response.headers.getSetCookie()) { const pair = item.split(";")[0]; jar.set(pair.slice(0, pair.indexOf("=")), pair); } return response; };
    try {
      for (let i = 0; ; i++) { try { const response = await http("/api/auth/csrf"); if (response.ok) break; } catch { /* local startup */ } if (i >= 120 || child.exitCode !== null) throw new Error("isolated_next_start_failed"); await new Promise(resolve => setTimeout(resolve, 250)); }
      const csrf = await (await http("/api/auth/csrf")).json();
      await db.$executeRawUnsafe('UPDATE "IsolatedTestRuntime" SET account=$1 WHERE id=$2', "blocked-before-auth", runtime);
      await http("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: base }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/control/usage-billing`, json: "true" }) });
      const deniedSession = await (await http("/api/auth/session")).json(); expect(deniedSession.user).toBeUndefined();
      await db.$executeRawUnsafe('UPDATE "IsolatedTestRuntime" SET account=$1 WHERE id=$2', "acct-test", runtime);
      const signIn = await http("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: base }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/control/usage-billing`, json: "true" }) });
      expect(signIn.status).toBe(200);
      const session = await (await http("/api/auth/session")).json(); expect(session.user.email).toBe(email);
      const page = await http("/control/usage-billing"); expect(page.status).toBe(200); const html = await page.text(); expect(html).toContain("$27.50"); expect(html).toContain("$30.00"); expect(html).not.toContain("$200.00"); expect(html).toContain("Deployment allowance is unsupported in this isolated TEST lane.");
      expect((await http("/api/cron/settle-ai-usage", { method: "POST" })).status).toBe(503);
      expect((await http("/api/axiom/chat", { method: "POST" })).status).toBe(503);
      expect((await http("/api/billing/checkout-session", { method: "POST" })).status).toBe(503);
      await db.aIUsageReservation.updateMany({ where: { organizationId: org, status: "pending_settlement" }, data: { reservedCents: 2950 } });
      const capped = await http("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "http_cap_denied_123456", origin: base }, body: JSON.stringify({ prompt: "Must not exceed public test pool" }) });
      expect(capped.status).toBeGreaterThanOrEqual(400);
      expect(await db.aIUsageReservation.count({ where: { organizationId: org, idempotencyKey: "http_cap_denied_123456" } })).toBe(0);
      await db.aIUsageReservation.updateMany({ where: { organizationId: org, status: "pending_settlement" }, data: { reservedCents: 250 } });
      const generation = await http("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "http_actual_hold_123456", origin: base }, body: JSON.stringify({ prompt: "Synthetic local admission only" }) });
      expect(generation.status).toBeGreaterThanOrEqual(400);
      const hold = await db.aIUsageReservation.findUnique({ where: { organizationId_idempotencyKey: { organizationId: org, idempotencyKey: "http_actual_hold_123456" } } });
      expect(hold?.status).toBe("released"); expect(await db.usageEvent.count({ where: { organizationId: org } })).toBe(0);
      const originalIntent = await httpStore.transaction(tx => tx.intent(intent.id));
      const financialBeforeLifecycle = { usage: await db.usageEvent.findMany({ where: { organizationId: org } }), holds: await db.aIUsageReservation.findMany({ where: { organizationId: org } }), purchases: await db.addOnPurchase.findMany({ where: { organizationId: org } }) };
      for (const phase of [
        { event: "evt-http-scheduled", status: "active", collection: "collected" as const, unavailable: false, seats: 3, cancel: true, pool: "$30.00", remaining: "$27.50", exhausted: false },
        { event: "evt-http-open-invoice", status: "active", collection: "unsupported" as const, unavailable: true, seats: 3, cancel: false, pool: "", remaining: "", exhausted: true },
        { event: "evt-http-expired", status: "active", collection: "expired" as const, unavailable: true, seats: 3, cancel: false, pool: "", remaining: "", exhausted: true },
        { event: "evt-http-past-due", status: "past_due", collection: "unsupported" as const, unavailable: false, seats: 3, cancel: false, pool: "$2.00", remaining: "$0.00", exhausted: true },
        { event: "evt-http-recovered", status: "active", collection: "collected" as const, unavailable: false, seats: 3, cancel: false, pool: "$30.00", remaining: "$27.50", exhausted: false },
        { event: "evt-http-canceled", status: "canceled", collection: "unsupported" as const, unavailable: false, seats: 3, cancel: false, pool: "$2.00", remaining: "$0.00", exhausted: true },
      ]) {
        httpEvent = phase.event; httpCollection = phase.collection; httpStatus = phase.status; httpSeats = phase.seats; httpCancel = phase.cancel;
        httpType = phase.status === "canceled" ? "customer.subscription.deleted" : "customer.subscription.updated";
        // Trusted synthetic lifecycle IO remains outside the provider-disabled app.
        expect(await setup.reconcile("synthetic-current-subscription", "synthetic-verified-signature", org)).toBe("applied");
        const observation = await db.tenantBillingPlan.findUnique({ where: { organizationId: org } }); expect(observation).toMatchObject({ status: phase.status, seatQuantity: phase.seats, cancelAtPeriodEnd: phase.cancel });
        const currentPage = await http("/control/usage-billing"); expect(currentPage.status).toBe(200); const currentHtml = await currentPage.text();
        if (phase.unavailable) { expect(currentHtml).toContain("Unavailable"); expect(currentHtml).toContain("Plan unavailable"); }
        else { expect(currentHtml.replace(/<!--[\s\S]*?-->/g, "")).toContain(`${phase.pool} current account allowance`); expect(currentHtml).toContain(phase.remaining); }
        expect(currentHtml).not.toContain("$200.00");
        if (phase.exhausted) {
          const key = `${phase.event}-no-new-hold`;
          const denied = await http("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, origin: base }, body: JSON.stringify({ prompt: "Inactive pool is exhausted by unresolved hold" }) });
          expect(denied.status).toBeGreaterThanOrEqual(400); expect(await db.aIUsageReservation.count({ where: { organizationId: org, idempotencyKey: key } })).toBe(0);
        } else if (!phase.cancel) {
          const key = `${phase.event}-provider-disabled`;
          expect((await http("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, origin: base }, body: JSON.stringify({ prompt: "Recovered active terms reach admission but provider stays disabled" }) })).status).toBeGreaterThanOrEqual(400);
          expect(await db.aIUsageReservation.findUnique({ where: { organizationId_idempotencyKey: { organizationId: org, idempotencyKey: key } } })).toMatchObject({ status: "released", reservedCents: 100 });
        }
      }
      expect(await db.usageEvent.findMany({ where: { organizationId: org } })).toEqual(financialBeforeLifecycle.usage); expect(await db.addOnPurchase.findMany({ where: { organizationId: org } })).toEqual(financialBeforeLifecycle.purchases);
      expect(await db.aIUsageReservation.findMany({ where: { id: { in: financialBeforeLifecycle.holds.map(row => row.id) } } })).toEqual(financialBeforeLifecycle.holds);
      const currentIntent = await httpStore.transaction(tx => tx.intent(intent.id)); expect(currentIntent?.terms).toEqual(originalIntent?.terms); expect(currentIntent?.originalCreateProof).toEqual(originalIntent?.originalCreateProof);
      await db.orgMembership.update({ where: { userId_organizationId: { userId: user.id, organizationId: org } }, data: { role: "read_only" } });
      expect((await http("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "http_denied_role_12345" }, body: JSON.stringify({ prompt: "Denied" }) })).status).toBeGreaterThanOrEqual(400);
      expect(await db.aIUsageReservation.count({ where: { organizationId: org, idempotencyKey: "http_denied_role_12345" } })).toBe(0);
      await db.$executeRawUnsafe('ALTER TABLE "OrganizationTestSubscriptionContract" RENAME TO "UnavailableHttpContract"');
      try {
        const unavailablePage = await http("/control/usage-billing"); expect(unavailablePage.status).toBe(200); const unavailableHtml = await unavailablePage.text();
        expect(unavailableHtml).toContain("Unavailable"); expect(unavailableHtml).toContain("Plan unavailable"); expect(unavailableHtml).not.toContain("$200.00");
      } finally { await db.$executeRawUnsafe('ALTER TABLE "UnavailableHttpContract" RENAME TO "OrganizationTestSubscriptionContract"'); }

      await exerciseAnniversaryHttp(anniversaryHttp, base);
    } finally {
      if (child.pid) {
        const exited = new Promise<void>(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once("exit", () => resolve()); });
        try { process.kill(-child.pid, "SIGTERM"); } catch { /* already exited */ }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try { await Promise.race([exited, new Promise<void>(resolve => { timer = setTimeout(resolve, 3000); })]); } finally { clearTimeout(timer); }
        try { process.kill(-child.pid, "SIGKILL"); } catch { /* only owned process group */ }
        await exited;
      }
      try { writeFileSync("/tmp/axiom-isolated-next-http.log", output); } finally { rmSync(temporary, { recursive: true, force: true }); }
    }
  }, 180000);

  registerLegacyAgentAdmissionAcceptance({ context: () => ({ db, url, runtime, stores }) });
  registerAnniversaryAcceptance({ context: () => ({ db, url, runtime, stores }), refund: reverseAICreditRefund,
    observeRefund(listener) { if (refundBinding.observer) throw new Error("owned_refund_observer_busy"); refundBinding.observer = listener; return () => { refundBinding.observer = null; }; } });

  it.runIf(process.env.AXIOM_RUN_OWNED_CHECKOUT_HTTP === "1")("actual owned pricing HTTP checkout and signed webhook compose existing TEST service in a separate synthetic worker", async () => {
    const { exerciseOwnedCheckoutHttp, ownedCheckoutEvidenceLine } = await import("./fixtures/ownedCheckoutHttpAcceptance");
    const receipt = await exerciseOwnedCheckoutHttp({ db, url, runtime });
    expect(receipt.syntheticProviderOnly).toBe(true); expect(receipt.actualHostedPayment).toBe(false);
    console.info(ownedCheckoutEvidenceLine(receipt));
  }, 180000);

});

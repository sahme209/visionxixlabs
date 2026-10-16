import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { hash } from "bcryptjs";
import { deriveWorkspaceIdFromEmail } from "../../auth/workspaceId";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createNewTestSubscriptionService, type ProviderBoundary } from "../newTestSubscription/service";
import { reserveAICredits, settleAICreditReservation } from "../aiCreditReservation";
import { applyMargin } from "../aiBillingMargin";
import { postgresFixtureStore } from "../newTestSubscription/postgresFixtureStore";

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
  let creates = 0; let loseResponse = false; let eventId = "evt-1"; let seats = 3; let status = "active"; let priceAmount = 2900; let currentIntent = ""; let currentKey = ""; let currentDigest = ""; let providerAccount = "acct-test";
  const price = () => ({ id: "price-test", livemode: false, active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount: priceAmount, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } });
  const provider: ProviderBoundary = {
    mode: () => ({ livemode: false, accountId: providerAccount }), price: async () => price(),
    create: async (request, key) => { creates++; currentKey = key; currentDigest = createHash("sha256").update(request).digest("hex"); const parsed = JSON.parse(request); currentIntent = parsed.metadata.intentId; if (loseResponse) throw new Error("response lost after provider commit"); return { id: "cs-test", url: "https://checkout.stripe.com/test", accountId: providerAccount, livemode: false }; },
    verifyAndRetrieve: async (_, signature) => { if (signature !== "synthetic-verified-signature") throw new Error("invalid_signature"); return { providerRequestKey: currentKey, providerRequestDigest: currentDigest, eventId, accountId: providerAccount, livemode: false, organizationId: scope.organizationId, intentId: currentIntent, catalogVersion: "axiom_public_test_v1", sessionId: "cs-test", sessionStatus: "complete", paymentStatus: "paid", customerId: "cus-test", subscriptionId: "sub-test", status, seatQuantity: seats, price: price() }; },
  };
  const request = { clientIntentKey: "intent_key_12345678", planId: "pro" as const, interval: "monthly" as const, seatQuantity: 3, email: "synthetic@example.invalid", successUrl: "https://isolated.invalid/success", cancelUrl: "https://isolated.invalid/cancel" };
  const core = (boundary = provider) => { const store = postgresFixtureStore(url, runtime, "acct-test"); stores.push(store); return createNewTestSubscriptionService({ store, provider: boundary, configuredPrices: { "pro:monthly": "price-test" }, now: () => now, id: () => randomBytes(12).toString("hex"), digest: text => createHash("sha256").update(text).digest("hex") }); };
  beforeAll(async () => {
    execFileSync("docker", ["run", "--pull=never", "-d", "--name", name, "-e", `POSTGRES_PASSWORD=${password}`, "-e", "POSTGRES_DB=axiom_new_test_contract_rehearsal", "-p", "127.0.0.1::5432", "postgres:17-alpine"], { stdio: "pipe" }); started = true;
    const port = execFileSync("docker", ["port", name, "5432/tcp"], { encoding: "utf8" }).trim().split(":").pop();
    url = `postgresql://postgres:${password}@127.0.0.1:${port}/axiom_new_test_contract_rehearsal`;
    db = new PrismaClient({ datasources: { db: { url } } });
    for (let attempt = 0; ; attempt++) { try { await db.$queryRawUnsafe("SELECT 1"); break; } catch { if (attempt > 40) throw new Error("owned_fixture_not_ready"); await new Promise(resolve => setTimeout(resolve, 100)); } }
    const tables = await db.$queryRawUnsafe<Array<{ count: number }>>("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'"); expect(tables[0].count).toBe(0);
    for (const envName of [".env", ".env.local", ".env.production", "prisma/.env"]) if (existsSync(resolve(envName))) throw new Error("fixture_refuses_env_files");
    execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", resolve("prisma/schema.prisma")], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, SHADOW_DATABASE_URL: url }, stdio: "pipe" });
    const sql = [
      'CREATE TABLE "IsolatedTestRuntime" (id text PRIMARY KEY,account text NOT NULL)',
      'CREATE TABLE "RecurringSubscriptionIntent" (id text PRIMARY KEY,org text NOT NULL,body jsonb NOT NULL,UNIQUE(id,org))',
      'CREATE TABLE "RecurringSubscriptionPurchaseFence" (org text PRIMARY KEY,intent text UNIQUE NOT NULL,FOREIGN KEY(intent,org) REFERENCES "RecurringSubscriptionIntent"(id,org))',
      'CREATE TABLE "OrganizationTestSubscriptionContract" (org text PRIMARY KEY,intent text UNIQUE NOT NULL,customer text UNIQUE NOT NULL,subscription text UNIQUE NOT NULL,body jsonb NOT NULL,FOREIGN KEY(intent,org) REFERENCES "RecurringSubscriptionIntent"(id,org))',
    ];
    // Expression uniqueness is created as a separate index in PostgreSQL.
    for (const statement of sql) await db.$executeRawUnsafe(statement);
    await db.$executeRawUnsafe('CREATE UNIQUE INDEX intent_client_key ON "RecurringSubscriptionIntent" (org,(body->>\'clientIntentKey\'))');
    await db.$executeRawUnsafe(`CREATE FUNCTION freeze_test_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF (OLD.body - ARRAY['state','sessionId','customerId','subscriptionId','revision']) IS DISTINCT FROM (NEW.body - ARRAY['state','sessionId','customerId','subscriptionId','revision']) THEN RAISE EXCEPTION 'immutable_intent'; END IF;
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
    for (const userId of ["owner", "member-2", "member-3"]) await db.orgMembership.create({ data: { userId, organizationId: scope.organizationId, role: userId === "owner" ? "owner" : "read_only", acceptedAt: new Date(now) } });
    await db.usageEvent.create({ data: { organizationId: scope.organizationId, eventKind: "ai_invocation", billedCents: 100, createdAt: new Date(now) } });
    await db.aIUsageReservation.create({ data: { organizationId: scope.organizationId, idempotencyKey: "synthetic_pending_hold", reservedCents: 250, status: "pending_settlement", expiresAt: new Date(now - 1000) } });
    await db.addOnPurchase.create({ data: { organizationId: scope.organizationId, sku: "ai_credits_small", pricePaidCents: 500, deliveredAICreditsCents: 500, validFor: "current_month", periodMonth: "2026-10", status: "paid", idempotencyKey: "synthetic_topup", purchasedBy: "owner", correlationId: "fixture" } });

  }, 30000);
  afterAll(async () => { await Promise.all(stores.map(store => store.disconnect())); if (db) await db.$disconnect(); if (started) execFileSync("docker", ["rm", "-f", name], { stdio: "pipe" }); });
  it("retains unknown outcome, late-binds once, protects financial/tenant state and models monthly remaining pool", async () => {
    expect(applyMargin(2)).toBe(3); // reuse established actual-cost ledger arithmetic; no new pricing formula
    const service = core();
    const intent = await service.prepare(scope, request); expect(intent.terms.monthlyAICreditsCents).toBe(3000);
    expect((await service.prepare(scope, request)).id).toBe(intent.id);
    await expect(service.prepare(scope, { ...request, clientIntentKey: "different_key_123456" })).rejects.toThrow("unresolved_purchase_exists");
    providerAccount = "acct-other";
    await expect(service.attempt(scope, intent.id)).rejects.toThrow("intent_unavailable"); expect(creates).toBe(0);
    providerAccount = "acct-test";
    loseResponse = true;
    expect(await service.attempt(scope, intent.id)).toEqual({ kind: "reconciliation_required" });
    expect(creates).toBe(1);
    await expect(service.attempt(scope, intent.id)).rejects.toThrow("reconciliation_required"); expect(creates).toBe(1);
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
    expect(await service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).toBe("applied");
    expect(await service.previewRemaining(scope)).toMatchObject({ remainingCents: 1147 });
    eventId = "evt-1"; seats = 3;
    expect(await service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).toBe("replay");
    expect(await service.previewRemaining(scope)).toMatchObject({ remainingCents: 1147 });
    eventId = "evt-invalid"; priceAmount = 1;
    await expect(service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).rejects.toThrow("signed_terms_mismatch");
    expect(await db.$queryRawUnsafe('SELECT id FROM "StripeBillingEvent" WHERE id=$1', eventId)).toEqual([]);
    priceAmount = 2900; eventId = "evt-injected-rollback";
    await expect(service.reconcile("synthetic", "synthetic-verified-signature", scope.organizationId)).rejects.toThrow();
    expect(await db.$queryRawUnsafe('SELECT id FROM "StripeBillingEvent" WHERE id=$1', eventId)).toEqual([]);
    expect(await service.previewRemaining(scope)).toMatchObject({ remainingCents: 1147 });
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
      const snapshot = await provider.verifyAndRetrieve(raw, signature); arrived++; if (arrived === 2) release();
      await barrier; return { ...snapshot, eventId: id };
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
    const httpProvider: ProviderBoundary = { ...provider,
      create: async (request, key) => ({ ...await provider.create(request, key), id: "cs-http" }),
      verifyAndRetrieve: async (raw, signature) => ({ ...await provider.verifyAndRetrieve(raw, signature), eventId: "evt-http", organizationId: org, sessionId: "cs-http", customerId: "cus-http", subscriptionId: "sub-http", status: "active" }),
    };
    const setup = core(httpProvider); const intent = await setup.prepare(actor, { ...request, email }); await setup.attempt(actor, intent.id);
    await setup.reconcile("synthetic-provider-evidence", "synthetic-verified-signature", org);
    await db.organizationAIProviderPolicy.create({ data: { organizationId: org, enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "openai/gpt-4o-mini" }, fallbackOrder: ["vercel_gateway"], updatedBy: user.id } });
    await db.aIUsageReservation.create({ data: { organizationId: org, idempotencyKey: "http_pending_hold_123", reservedCents: 250, status: "pending_settlement", expiresAt: new Date(0) } });
    const listener = createServer(); await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
    const address = listener.address(); if (!address || typeof address === "string") throw new Error("fixture_port_unavailable"); const port = address.port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    const base = `http://127.0.0.1:${port}`, temporary = mkdtempSync(resolve(tmpdir(), "axiom-http-font-"));
    const fonts = resolve(temporary, "fonts.cjs");
    const fontCss = "@font-face { font-family: Isolated; src: url(https://synthetic.invalid/font.woff2); }";
    writeFileSync(fonts, `module.exports = new Proxy({}, { get: () => ${JSON.stringify(fontCss)} });`);

    const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), detached: true, stdio: "pipe", env: {
      PATH: process.env.PATH, NODE_ENV: "development", NODE_OPTIONS: "--max-old-space-size=3072", NEXT_TELEMETRY_DISABLED: "1", NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fonts,
      DATABASE_URL: url, DIRECT_URL: url, NEXTAUTH_URL: base, NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
      AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true", AXIOM_ISOLATED_TEST_RUNTIME_ID: runtime, AXIOM_ISOLATED_TEST_ACCOUNT_ID: "acct-test", AXIOM_ISOLATED_TEST_ORGANIZATIONS: org,
      // Inert synthetic marker only to exercise existing configured-policy/hold path.
      // Not a usable provider credential; all SDK/provider IO is independently denied.
      AI_GATEWAY_API_KEY: "synthetic-inert-not-a-provider-credential", AI_GATEWAY_MODEL: "openai/gpt-4o-mini", AXIOM_AI_MAX_REQUEST_CREDITS_CENTS: "100",
      AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_EC2_METADATA_DISABLED: "true",
    } });
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
      await db.orgMembership.update({ where: { userId_organizationId: { userId: user.id, organizationId: org } }, data: { role: "read_only" } });
      expect((await http("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "http_denied_role_12345" }, body: JSON.stringify({ prompt: "Denied" }) })).status).toBeGreaterThanOrEqual(400);
      expect(await db.aIUsageReservation.count({ where: { organizationId: org, idempotencyKey: "http_denied_role_12345" } })).toBe(0);
      await db.$executeRawUnsafe('ALTER TABLE "OrganizationTestSubscriptionContract" RENAME TO "UnavailableHttpContract"');
      try {
        const unavailablePage = await http("/control/usage-billing"); expect(unavailablePage.status).toBe(200); const unavailableHtml = await unavailablePage.text();
        expect(unavailableHtml).toContain("Unavailable"); expect(unavailableHtml).toContain("Plan unavailable"); expect(unavailableHtml).not.toContain("$200.00");
      } finally { await db.$executeRawUnsafe('ALTER TABLE "UnavailableHttpContract" RENAME TO "OrganizationTestSubscriptionContract"'); }

    } finally {
      if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already exited */ } await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 3000))]); try { process.kill(-child.pid, "SIGKILL"); } catch { /* only owned process group */ } }
      writeFileSync("/tmp/axiom-isolated-next-http.log", output); rmSync(temporary, { recursive: true, force: true });
    }
  }, 180000);

});

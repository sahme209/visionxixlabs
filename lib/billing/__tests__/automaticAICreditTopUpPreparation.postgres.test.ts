import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { Pool } from "pg";
import { NextRequest } from "next/server";
import type Stripe from "stripe";
import type { CorrelationId } from "@/lib/domain/ids";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSql, PublicSqlRepository } from "../publicBillingStore";

const mocks = vi.hoisted(() => ({
  allowance: vi.fn(), context: vi.fn(), runtime: vi.fn(), transaction: vi.fn(), publicRuntime: vi.fn(),
}));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.context }));
vi.mock("@/lib/billing/automaticAICreditTopUpSetupRuntime", () => ({ automaticTopUpSetupRuntime: mocks.runtime }));
vi.mock("@/lib/billing/publicBillingRuntime", () => ({ publicBillingRuntime: mocks.publicRuntime }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: mocks.transaction } }));
import { GET as readHttp, POST as mutateHttp } from "@/app/api/billing/automatic-top-up/route";
import { POST as receiveBillingWebhook } from "@/app/api/billing/stripe-webhook/route";
vi.mock("../publicCreditAuthority", async importOriginal => ({
  ...await importOriginal<typeof import("../publicCreditAuthority")>(),
  readPublicCreditAllowance: mocks.allowance,
}));

vi.mock("@/lib/audit/requiredAudit", () => ({
  recordRequiredAudit: async (event: { detail: object }, tx: PublicSql) => {
    await tx.$executeRawUnsafe('INSERT INTO "FixtureAudit" VALUES ($1::jsonb)', JSON.stringify(event.detail));
  },
}));

import { automaticTopUpConsentDigest, type AutomaticTopUpSetupBinding } from "../automaticAICreditTopUpConsent";
import { saveVerifiedAutomaticTopUpConsent, disableAutomaticTopUpConsent, registerAutomaticTopUpSetup } from "../automaticAICreditTopUpConsentStore";
import { makeAutomaticTopUpSetupProvider } from "../automaticAICreditTopUpSetupProvider";
import { makeAutomaticTopUpSetupService } from "../automaticAICreditTopUpSetupService";
import { PUBLIC_STRIPE_API_VERSION } from "../publicBillingConfig";
import { makeAutomaticTopUpTestDispatcher, makeAutomaticTopUpTestPaymentNotification, makeAutomaticTopUpTestReconciler, makeAutomaticTopUpTestRecovery, makeAutomaticTopUpTestSettlement } from "../automaticAICreditTopUpDispatchService";
import { reconcilePublicWebhook } from "../publicWebhookDispatch";
import { recordAutomaticTopUpTestRefund, type AutomaticTopUpRefundCharge } from "../automaticAICreditTopUpRefund";
import { recordAutomaticTopUpTestDispute } from "../automaticAICreditTopUpDispute";
import { claimAutomaticTopUpDispatch, readAutomaticTopUpDispatchBinding } from "../automaticAICreditTopUpDispatch";
import { prepareAutomaticAICreditTopUp } from "../automaticAICreditTopUpPreparation";

const enabled = process.env.AXIOM_RUN_OWNED_TOP_UP_FIXTURE === "1";
describe.runIf(enabled)("automatic credit top-up preparation with owned PostgreSQL", () => {
  let pool: Pool;
  const workspace = "fixture-workspace";
  const identity = { accountId: "acct_fixture", livemode: false };
  const repo: PublicSqlRepository = {
    async $transaction<T>(run: (tx: PublicSql) => Promise<T>, options: { isolationLevel: "Serializable" | "RepeatableRead" }) {
      const client = await pool.connect();
      try {
        if (options.isolationLevel !== "Serializable") throw new Error("serializable transaction required");
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        const result = await run({
          async $queryRawUnsafe<T>(sql: string, ...args: unknown[]) {
            return (await client.query(sql, args)).rows as T;
          },
          async $executeRawUnsafe(sql, ...args) {
            return (await client.query(sql, args)).rowCount ?? 0;
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  };
  const prepare = () => prepareAutomaticAICreditTopUp(repo, workspace, identity);
  const consent = async () => {
    await pool.query(`
    INSERT INTO "AutomaticAICreditTopUpConsent" VALUES
    ($1,2,true,'fixture-owner','seti_fixture','acct_fixture',false,300,'ai_credits_small',1000,2000)
    `, [workspace]);
    await pool.query(`INSERT INTO "AutomaticAICreditSetupReceipt" VALUES
      ('seti_fixture',$1,2,'cus_fixture','pm_fixture','fixture',now())`, [workspace]);
  };

  const binding: AutomaticTopUpSetupBinding = {
    identity, attemptId: "stored-attempt", setupIntentId: "seti_consent", organizationId: workspace,
    actorUserId: "fixture-owner", customerId: "cus_fixture", expectedRevision: null,
    thresholdCents: 300, sku: "ai_credits_small", amountCents: 1000, monthlyCeilingCents: 2000,
  };
  const correlationId = "fixture" as CorrelationId;
  function observation(terms = binding) {
    const setup: Stripe.SetupIntent = {
      object: "setup_intent", id: terms.setupIntentId, livemode: false, status: "succeeded",
      usage: "off_session", customer: terms.customerId, client_secret: "fixture-sensitive-value",
      created: 0, application: null, automatic_payment_methods: null, cancellation_reason: null,
      description: null, excluded_payment_method_types: null, flow_directions: null,
      last_setup_error: null, latest_attempt: null, mandate: null, next_action: null, on_behalf_of: null,
      payment_method_configuration_details: null, payment_method_options: null,
      payment_method_types: ["card"], single_use_mandate: null,
      payment_method: {
        object: "payment_method", id: "pm_fixture", type: "card", livemode: false, customer: terms.customerId,
        created: 0, customer_account: null, metadata: null,
        billing_details: { address: null, email: null, name: null, phone: null, tax_id: null },
      },
      metadata: { purpose: "axiom_auto_ai_credit_setup_v1", consent_digest: automaticTopUpConsentDigest(terms) },
    };
    return { accountId: identity.accountId, setup };
  }
  type ConsentTx = Parameters<typeof saveVerifiedAutomaticTopUpConsent>[0];
  const save = (terms = binding, observed = observation(terms)) => repo.$transaction(
    tx => saveVerifiedAutomaticTopUpConsent(tx as ConsentTx, terms, observed, correlationId), { isolationLevel: "Serializable" },
  );
  const disable = (expectedRevision: number | null) => repo.$transaction(
    tx => disableAutomaticTopUpConsent(tx as ConsentTx, {
      organizationId: workspace, userId: binding.actorUserId, expectedRevision, correlationId,
    }), { isolationLevel: "Serializable" },
  );

  const actor = { organizationId: workspace, userId: binding.actorUserId };
  const termsInput = { accepted: true, expectedRevision: null, thresholdCents: 300, sku: "ai_credits_small", monthlyCeilingCents: 2000 };
  const start = (input = termsInput) => repo.$transaction(
    tx => registerAutomaticTopUpSetup(tx as ConsentTx, actor, identity, input), { isolationLevel: "Serializable" },
  );
  const seedBoundAttempt = () => pool.query(`
    INSERT INTO "AutomaticAICreditSetupAttempt"
      (id,"organizationId","actorUserId",terms,"consentDigest","setupIntentId","createClaimed",state,"createdAt")
    VALUES ($1,$2,$3,$4::jsonb,$5,$6,true,'pending',now())
  `, [binding.attemptId, workspace, actor.userId, JSON.stringify(binding), automaticTopUpConsentDigest(binding), binding.setupIntentId]);
  function transport(terms: Omit<AutomaticTopUpSetupBinding, "setupIntentId">) {
    const setup = {
      ...observation({ ...terms, setupIntentId: "seti_service" }).setup,
      client_secret: "seti_service_secret_fixture",
      lastResponse: { apiVersion: PUBLIC_STRIPE_API_VERSION, statusCode: 200, requestId: "fixture" },
    };
    const create = vi.fn(async (_params: unknown, _opts: unknown) => setup);
    const retrieve = vi.fn(async (_id: string, _params: unknown, _opts: unknown) => setup);
    const account = vi.fn(async () => ({ id: identity.accountId, lastResponse: setup.lastResponse }));
    const client = { accounts: { retrieve: account }, setupIntents: { create, retrieve } };
    const provider = makeAutomaticTopUpSetupProvider(client as unknown as Parameters<typeof makeAutomaticTopUpSetupProvider>[0], identity);
    const repository = { $transaction: <T>(run: (tx: ConsentTx) => Promise<T>) => repo.$transaction(tx => run(tx as ConsentTx), { isolationLevel: "Serializable" }) };
    return { service: makeAutomaticTopUpSetupService(repository, provider), create, retrieve, account, setup };
  }

  beforeAll(async () => {
    const url = new URL(process.env.AXIOM_OWNED_TOP_UP_PG_URL ?? "");
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/v19_auto_top_up_fixture") throw new Error("owned fixture required");
    pool = new Pool({ connectionString: url.toString() });
    const observation = await pool.query("SHOW data_directory");
    if (observation.rows[0].data_directory !== process.env.AXIOM_OWNED_TOP_UP_PG_DATA) throw new Error("owned fixture identity mismatch");
    await pool.query('CREATE TABLE "OrgMembership" ("organizationId" text, "userId" text, "acceptedAt" timestamp, role text)');
    await pool.query(`
      CREATE TABLE "TenantBillingPlan" ("organizationId" text, "stripeCustomerId" text);
      CREATE TABLE "PublicBillingEnrollment" ("organizationId" text,id text,"accountId" text,livemode boolean,policy text,"legacyFreeMonth" text,"legacyFreeUsedCents" int);
      CREATE TABLE "FixtureAudit" (detail jsonb);
    `);
    for (const migration of ["20261124120000_add_automatic_ai_credit_top_up_preparation", "20261124130000_add_automatic_ai_credit_setup_receipts", "20261124140000_add_automatic_ai_credit_setup_attempts", "20261124150000_add_automatic_ai_credit_dispatch_claim", "20261124160000_add_automatic_ai_credit_payment_observation", "20261124170000_record_automatic_ai_credit_refunds"]) {
      await pool.query(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    }
    for (const migration of ["20260522180000_add_addon_packages", "20261014190000_verified_ai_credit_fulfillment"]) {
      await pool.query(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    }
    await pool.query(readFileSync("prisma/migrations/20261124180000_record_automatic_ai_credit_disputes/migration.sql", "utf8"));
    await pool.query(readFileSync("prisma/migrations/20261124190000_claim_automatic_ai_credit_on_session_retry/migration.sql", "utf8"));
  });
  beforeEach(async () => {
    vi.resetAllMocks();
    mocks.allowance.mockResolvedValue({ available: true, includedRemainingCents: 300 });
    mocks.context.mockResolvedValue({ isAuthenticated: true, ...actor });
    mocks.transaction.mockImplementation((run, options) => repo.$transaction(run, options));
    mocks.runtime.mockReturnValue({ identity, providerConfigured: true, service: () => { throw Error("fixture service unavailable"); } });
    await pool.query('TRUNCATE "AutomaticAICreditTopUpConsent", "AutomaticAICreditTopUpIntent", "AutomaticAICreditDispatchClaim", "AutomaticAICreditDispute", "AutomaticAICreditSetupReceipt", "AutomaticAICreditSetupAttempt", "OrgMembership", "TenantBillingPlan", "PublicBillingEnrollment", "FixtureAudit", "AddOnPurchase"');
    await pool.query('TRUNCATE "StripeBillingEvent"');
    await pool.query('INSERT INTO "OrgMembership" VALUES ($1,\'fixture-owner\',now(),\'owner\')', [workspace]);
    await pool.query(`INSERT INTO "PublicBillingEnrollment" VALUES ($1,'enroll_fixture','acct_fixture',false,'axiom_public_anniversary_v1','2026-11',0)`, [workspace]);
    await pool.query(`INSERT INTO "TenantBillingPlan" VALUES ($1,'cus_fixture')`, [workspace]);
  });
  afterAll(async () => { await pool?.end(); });
  afterEach(() => vi.unstubAllEnvs());

  it("starts off, declines missing evidence, and prepares at the exact threshold", async () => {
    expect(await prepare()).toEqual({ kind: "off" });
    await consent();
    mocks.allowance.mockResolvedValueOnce({ available: false }).mockResolvedValueOnce({ available: true, includedRemainingCents: 301 });
    expect(await prepare()).toEqual({ kind: "unavailable" });
    expect(await prepare()).toEqual({ kind: "balance_sufficient" });
    expect(await prepare()).toMatchObject({ kind: "prepared", amountCents: 1000 });
    expect((await pool.query('SELECT state,"consentRevision" FROM "AutomaticAICreditTopUpIntent"')).rows)
      .toEqual([{ state: "prepared", consentRevision: 2 }]);
  });

  it("rejects live mode, revoked consent authority, and changed pack price", async () => {
    await consent();
    expect(await prepareAutomaticAICreditTopUp(repo, workspace, { ...identity, livemode: true })).toEqual({ kind: "unavailable" });
    await pool.query('UPDATE "OrgMembership" SET role=\'operator\'');
    expect(await prepare()).toEqual({ kind: "consent_invalid" });
    await pool.query('UPDATE "OrgMembership" SET role=\'admin\'');
    await pool.query('UPDATE "AutomaticAICreditTopUpConsent" SET "amountCents"=1001');
    expect(await prepare()).toEqual({ kind: "consent_invalid" });
    expect(mocks.allowance).not.toHaveBeenCalled();
  });

  it("commits at most one intent under contention and blocks unresolved purchases across months", async () => {
    await consent();
    const results = await Promise.all([prepare(), prepare(), prepare()]);
    expect(results.filter(result => result.kind === "prepared")).toHaveLength(1);
    await pool.query('UPDATE "AutomaticAICreditTopUpIntent" SET state=\'dispatch_unknown\',"periodMonth"=\'2000-01\'');
    expect(await prepare()).toEqual({ kind: "payment_pending" });
    await pool.query('UPDATE "AutomaticAICreditTopUpIntent" SET state=\'authentication_required\'');
    expect(await prepare()).toEqual({ kind: "payment_pending" });
    await pool.query('UPDATE "AutomaticAICreditTopUpIntent" SET state=\'payment_failed\'');
    expect(await prepare()).toEqual({ kind: "payment_pending" });
  });

  it("counts gross paid purchases in the UTC month and permits at most the remaining fixed pack", async () => {
    await consent();
    expect(await prepare()).toMatchObject({ kind: "prepared" });
    await pool.query('UPDATE "AutomaticAICreditTopUpIntent" SET state=\'paid\'');
    expect(await prepare()).toMatchObject({ kind: "prepared" });
    await pool.query('UPDATE "AutomaticAICreditTopUpIntent" SET state=\'paid\'');
    expect(await prepare()).toEqual({ kind: "monthly_ceiling" });
    await pool.query('UPDATE "AutomaticAICreditTopUpConsent" SET enabled=false');
    expect(await prepare()).toEqual({ kind: "off" });
  });

  it("accepts exact off-session evidence once, audits without payment secrets, and revokes without a repeat setup", async () => {
    await seedBoundAttempt();
    expect(await save()).toEqual({ kind: "saved", revision: 1 });
    expect(await prepare()).toMatchObject({ kind: "prepared" });
    expect(await disable(0)).toEqual({ kind: "conflict" });
    expect(await disable(1)).toEqual({ kind: "off", revision: 2 });
    expect(await prepare()).toEqual({ kind: "off" });
    expect(await save()).toEqual({ kind: "conflict" });
    expect(await save({ ...binding, expectedRevision: 2 })).toEqual({ kind: "setup_inactive" });
    const audit = (await pool.query('SELECT detail FROM "FixtureAudit"')).rows;
    expect(JSON.stringify(audit)).not.toMatch(/pm_fixture|cus_fixture|fixture-sensitive-value/);
    expect(audit).toHaveLength(2);
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "prepared" }]);
  });

  it("rejects mismatched terms, account, mode, customer, attachment and revoked role", async () => {
    const observed = observation();
    expect(await save({ ...binding, monthlyCeilingCents: 4000 }, observed)).toEqual({ kind: "invalid_setup" });
    expect(await save(binding, { ...observed, accountId: "acct_other" })).toEqual({ kind: "invalid_setup" });
    for (const fields of [{ livemode: true }, { usage: "on_session" }, { status: "requires_action" }, { payment_method: "pm_fixture" }, { customer: "cus_other" }]) {
      expect(await save(binding, { ...observed, setup: { ...observed.setup, ...fields } as Stripe.SetupIntent })).toEqual({ kind: "invalid_setup" });
    }
    await pool.query(`INSERT INTO "TenantBillingPlan" VALUES ('other-workspace','cus_fixture')`);
    expect(await save()).toEqual({ kind: "invalid_customer" });
    await pool.query(`UPDATE "OrgMembership" SET "acceptedAt"=NULL`);
    expect(await save()).toEqual({ kind: "forbidden" });
    expect((await pool.query('SELECT * FROM "AutomaticAICreditSetupReceipt"')).rows).toEqual([]);
  });

  it("rolls back both the receipt and consent when mandatory audit fails", async () => {
    await seedBoundAttempt();
    await pool.query(`ALTER TABLE "FixtureAudit" ADD CONSTRAINT reject_fixture_audit CHECK (false)`);
    try {
      await expect(save()).rejects.toThrow();
      expect((await pool.query('SELECT * FROM "AutomaticAICreditSetupReceipt"')).rows).toEqual([]);
      expect(await prepare()).toEqual({ kind: "off" });
    } finally {
      await pool.query(`ALTER TABLE "FixtureAudit" DROP CONSTRAINT reject_fixture_audit`);
    }
  });

  it("requires a matching receipt even when a consent row is enabled", async () => {
    await consent();
    await pool.query(`UPDATE "TenantBillingPlan" SET "stripeCustomerId"='cus_replaced'`);
    expect(await prepare()).toEqual({ kind: "consent_invalid" });
    await pool.query(`UPDATE "TenantBillingPlan" SET "stripeCustomerId"='cus_fixture'`);
    await pool.query('DELETE FROM "AutomaticAICreditSetupReceipt"');
    expect(await prepare()).toEqual({ kind: "consent_invalid" });
  });

  it("registers explicit terms, creates one matching SetupIntent and retrieves it before enabling", async () => {
    expect(await start({ ...termsInput, accepted: false })).toEqual({ kind: "invalid_terms" });
    const registered = await start();
    if (registered.kind !== "registered") throw Error("setup registration missing");
    const { terms } = registered;
    const fixture = transport(terms);
    expect(await start()).toEqual({ kind: "setup_pending", attemptId: terms.attemptId });
    expect(await fixture.service.create(actor, terms.attemptId)).toEqual({ kind: "ready", clientSecret: "seti_service_secret_fixture" });
    expect(await fixture.service.create(actor, terms.attemptId)).toEqual({ kind: "setup_inactive" });
    expect(fixture.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      customer: terms.customerId, usage: "off_session", payment_method_types: ["card"],
    }), { idempotencyKey: `axiom_top_up_setup_${terms.attemptId}`, maxNetworkRetries: 0 });
    expect(await fixture.service.finish(actor, terms.attemptId, correlationId)).toEqual({ kind: "saved", revision: 1 });
    expect(fixture.retrieve).toHaveBeenCalledExactlyOnceWith("seti_service", { expand: ["payment_method"] }, { maxNetworkRetries: 0 });
    expect(await fixture.service.finish(actor, terms.attemptId, correlationId)).toEqual({ kind: "setup_inactive" });
    expect(JSON.stringify((await pool.query('SELECT * FROM "AutomaticAICreditSetupAttempt"')).rows)).not.toContain("_secret_");
  });

  it("cancels before any consent exists and withholds a late create response", async () => {
    const registered = await start();
    if (registered.kind !== "registered") throw Error("setup registration missing");
    const { terms } = registered;
    const fixture = transport(terms);
    fixture.create.mockImplementationOnce(async () => {
      expect(await disable(null)).toEqual({ kind: "off", revision: null });
      return fixture.setup;
    });
    expect(await fixture.service.create(actor, terms.attemptId)).toEqual({ kind: "setup_inactive" });
    expect(await fixture.service.finish(actor, terms.attemptId, correlationId)).toEqual({ kind: "setup_inactive" });
    expect(fixture.retrieve).not.toHaveBeenCalled();
    expect(await prepare()).toEqual({ kind: "off" });
    expect((await pool.query('SELECT state FROM "AutomaticAICreditSetupAttempt"')).rows).toEqual([{ state: "canceled" }]);
  });

  it("does not replay an unconfirmed provider create and rejects a wrong account", async () => {
    const registered = await start();
    if (registered.kind !== "registered") throw Error("setup registration missing");
    const { terms } = registered;
    const fixture = transport(terms);
    fixture.account.mockResolvedValueOnce({ id: "acct_other", lastResponse: fixture.setup.lastResponse });
    expect(await fixture.service.create(actor, terms.attemptId)).toEqual({ kind: "setup_unavailable" });
    expect(fixture.create).not.toHaveBeenCalled();
    expect(await disable(null)).toEqual({ kind: "off", revision: null });
    const retry = await start();
    if (retry.kind !== "registered") throw Error("setup registration missing");
    const pending = transport(retry.terms);
    pending.create.mockRejectedValueOnce(new Error("lost result"));
    expect(await pending.service.create(actor, retry.terms.attemptId)).toEqual({ kind: "setup_unavailable" });
    expect(await pending.service.create(actor, retry.terms.attemptId)).toEqual({ kind: "setup_inactive" });
    expect(pending.create).toHaveBeenCalledTimes(1);
    expect(await prepare()).toEqual({ kind: "off" });
  });

  it("checks current authority after a late successful retrieval", async () => {
    const registered = await start();
    if (registered.kind !== "registered") throw Error("setup registration missing");
    const { terms } = registered;
    const fixture = transport(terms);
    expect(await fixture.service.create({ ...actor, userId: "other-user" }, terms.attemptId)).toEqual({ kind: "setup_inactive" });
    expect(fixture.create).not.toHaveBeenCalled();
    expect(await fixture.service.create(actor, terms.attemptId)).toMatchObject({ kind: "ready" });
    fixture.retrieve.mockImplementationOnce(async () => {
      expect(await disable(null)).toEqual({ kind: "off", revision: null });
      return fixture.setup;
    });
    expect(await fixture.service.finish(actor, terms.attemptId, correlationId)).toEqual({ kind: "setup_inactive" });
    expect(await prepare()).toEqual({ kind: "off" });
    expect((await pool.query('SELECT * FROM "AutomaticAICreditSetupReceipt"')).rows).toEqual([]);
  });

  function request(command?: object, origin = "https://fixture.invalid") {
    return new NextRequest("https://fixture.invalid/api/billing/automatic-top-up", command
      ? { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(command) }
      : { method: "GET" });
  }

  it("composes the authenticated HTTP handlers through the database and simulated Stripe", async () => {
    const empty = await readHttp(request());
    expect(await empty.json()).toEqual({ ok: true, data: { organizationId: workspace, consent: null, pending: null, payment: null } });
    const registered = await mutateHttp(request({ ...termsInput, organizationId: workspace, action: "register" }));
    const { data: { attemptId } } = await registered.json();
    expect(registered.status).toBe(200);
    const terms = (await pool.query('SELECT terms FROM "AutomaticAICreditSetupAttempt"')).rows[0].terms;
    const fixture = transport(terms);
    mocks.runtime.mockReturnValue({ identity, providerConfigured: true, service: () => fixture.service });
    const created = await mutateHttp(request({ organizationId: workspace, action: "create", attemptId }));
    expect(created.headers.get("cache-control")).toBe("private, no-store");
    expect(await created.json()).toEqual({ ok: true, data: {
      organizationId: workspace, state: "ready", clientSecret: "seti_service_secret_fixture",
    } });
    const observed = await readHttp(request());
    expect(await observed.json()).toMatchObject({ data: { pending: { attemptId, state: "payment_setup_pending" } } });
    const finished = await mutateHttp(request({ organizationId: workspace, action: "finish", attemptId }));
    expect(await finished.json()).toMatchObject({ data: { state: "saved", revision: 1 } });
    const view = await readHttp(request());
    const body = await view.json();
    expect(body.data).toMatchObject({ consent: { enabled: true, revision: 1 }, pending: null });
    expect(JSON.stringify(body)).not.toMatch(/seti_service|cus_fixture|pm_fixture|fixture-owner/);
    mocks.runtime.mockReturnValue({ identity, providerConfigured: false, service: () => { throw Error("fixture provider not configured"); } });
    expect(await (await mutateHttp(request({ organizationId: workspace, action: "disable", expectedRevision: 1 }))).json())
      .toMatchObject({ data: { state: "off", revision: 2 } });
  });

  it("requires same-origin, signed-in and exact-workspace mutations with strict payloads", async () => {
    const command = { ...termsInput, organizationId: workspace, action: "register" };
    expect((await mutateHttp(request(command, "https://foreign.invalid"))).status).toBe(403);
    expect((await mutateHttp(request({ ...command, organizationId: "other-workspace" }))).status).toBe(409);
    expect((await mutateHttp(request({ ...command, actorUserId: "body-actor" }))).status).toBe(400);
    expect((await mutateHttp(request({ ...command, accepted: false }))).status).toBe(400);
    mocks.context.mockResolvedValueOnce({ isAuthenticated: false });
    expect((await mutateHttp(request(command))).status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.runtime.mockReturnValueOnce(null);
    expect((await readHttp(request())).status).toBe(503);
    await pool.query(`UPDATE "OrgMembership" SET role='operator'`);
    expect((await readHttp(request())).status).toBe(403);
    expect((await mutateHttp(request(command))).status).toBe(403);
    expect((await pool.query('SELECT * FROM "AutomaticAICreditSetupAttempt"')).rows).toEqual([]);
  });

  async function preparedDispatch() {
    await seedBoundAttempt();
    expect(await save()).toEqual({ kind: "saved", revision: 1 });
    const intent = await prepare();
    if (intent.kind !== "prepared") throw Error("dispatch fixture not prepared");
    return { organizationId: workspace, intentId: intent.intentId, identity };
  }

  it("claims one exact test payment and persists unknown payment state atomically", async () => {
    const scope = await preparedDispatch();
    expect(await readAutomaticTopUpDispatchBinding(repo, scope)).toEqual(binding);
    expect(await readAutomaticTopUpDispatchBinding(repo, { ...scope, organizationId: "other-workspace" })).toBeNull();
    const concurrent = await Promise.all([1, 2, 3].map(() => claimAutomaticTopUpDispatch(repo, scope, observation())));
    const claims = concurrent.filter(result => result.kind === "claimed");
    expect(claims).toHaveLength(1);
    const claim = claims[0];
    expect(JSON.parse(claim.requestJson)).toEqual({
      amount: 1000, currency: "usd", customer: "cus_fixture", payment_method: "pm_fixture",
      payment_method_types: ["card"], off_session: true, confirm: true,
      metadata: { purpose: "axiom_auto_ai_credit_top_up_v1", intentId: scope.intentId, organizationId: workspace, sku: "ai_credits_small" },
    });
    const persisted = await pool.query('SELECT "providerKey","requestDigest","requestJson" FROM "AutomaticAICreditDispatchClaim"');
    expect(persisted.rows).toEqual([{ providerKey: claim.providerKey, requestDigest: claim.requestDigest, requestJson: claim.requestJson }]);
    expect(JSON.stringify(persisted.rows)).not.toContain("fixture-sensitive-value");
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "dispatch_unknown" }]);
    expect(await prepare()).toEqual({ kind: "payment_pending" });
    expect(await claimAutomaticTopUpDispatch(repo, scope, observation())).toEqual({ kind: "inactive" });
  });

  it("rechecks the attached setup method and refuses live or foreign workspace claims", async () => {
    const scope = await preparedDispatch();
    expect(await claimAutomaticTopUpDispatch(repo, { ...scope, identity: { ...scope.identity, livemode: true } }, observation()))
      .toEqual({ kind: "unavailable" });
    expect(await claimAutomaticTopUpDispatch(repo, { ...scope, organizationId: "other-workspace" }, observation()))
      .toEqual({ kind: "inactive" });
    const observed = observation();
    const paymentMethod = observed.setup.payment_method as Stripe.PaymentMethod;
    observed.setup.payment_method = { ...paymentMethod, id: "pm_other" };
    expect(await claimAutomaticTopUpDispatch(repo, scope, observed)).toEqual({ kind: "setup_unverified" });
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "prepared" }]);
    expect((await pool.query('SELECT * FROM "AutomaticAICreditDispatchClaim"')).rows).toEqual([]);
  });

  it.each(["revoked", "rollover", "balance recovered", "ceiling used"])("cancels prepared payment when %s", async reason => {
    const scope = await preparedDispatch();
    if (reason === "revoked") await disable(1);
    if (reason === "rollover") await pool.query(`UPDATE "AutomaticAICreditTopUpIntent" SET "periodMonth"='2000-01'`);
    if (reason === "balance recovered") mocks.allowance.mockResolvedValue({ available: true, includedRemainingCents: 301 });
    if (reason === "ceiling used") await pool.query(`
      INSERT INTO "AutomaticAICreditTopUpIntent" (id,"organizationId","consentRevision","periodMonth",sku,"amountCents",state,"createdAt")
      SELECT 'prior-paid',"organizationId","consentRevision","periodMonth",sku,2000,'paid',now()
      FROM "AutomaticAICreditTopUpIntent" WHERE id=$1
    `, [scope.intentId]);
    expect(await claimAutomaticTopUpDispatch(repo, scope, observation())).toEqual({ kind: "stale" });
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent" WHERE id=$1', [scope.intentId])).rows).toEqual([{ state: "canceled" }]);
    expect((await pool.query('SELECT * FROM "AutomaticAICreditDispatchClaim"')).rows).toEqual([]);
  });

  function dispatchFixture() {
    const lastResponse = { apiVersion: PUBLIC_STRIPE_API_VERSION, statusCode: 200, requestId: "fixture" };
    const account = vi.fn(async () => ({ id: identity.accountId, lastResponse }));
    const retrieve = vi.fn(async () => ({ ...observation().setup, lastResponse }));
    const create = vi.fn(async (params: Stripe.PaymentIntentCreateParams, _options?: Stripe.RequestOptions) => ({
      id: "pi_fixture", object: "payment_intent", status: "succeeded", livemode: false, lastResponse,
      amount: params.amount, currency: params.currency, customer: params.customer, payment_method: params.payment_method, metadata: params.metadata,
    }));
    const retrievePaymentAfterCreate = vi.fn();
    const client = { accounts: { retrieve: account }, setupIntents: { retrieve }, paymentIntents: { create, retrieve: retrievePaymentAfterCreate } };
    const dispatch = makeAutomaticTopUpTestDispatcher(repo, client as unknown as Parameters<typeof makeAutomaticTopUpTestDispatcher>[1], identity);
    return { dispatch, retrieve, account, create, retrievePaymentAfterCreate };
  }

  it("retrieves the current setup, sends the exact committed request once and records a matching PaymentIntent", async () => {
    const scope = await preparedDispatch();
    const fixture = dispatchFixture();
    expect(await fixture.dispatch(scope)).toEqual({ kind: "provider_observed" });
    expect(fixture.retrieve).toHaveBeenCalledExactlyOnceWith(binding.setupIntentId, { expand: ["payment_method"] }, { maxNetworkRetries: 0 });
    const claim = (await pool.query('SELECT * FROM "AutomaticAICreditDispatchClaim"')).rows[0];
    expect(fixture.create).toHaveBeenCalledExactlyOnceWith(JSON.parse(claim.requestJson), {
      idempotencyKey: claim.providerKey, maxNetworkRetries: 0,
    });
    expect(claim).toMatchObject({ paymentIntentId: "pi_fixture", providerStatus: "succeeded" });
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "dispatch_unknown" }]);
    expect(await fixture.dispatch(scope)).toEqual({ kind: "inactive" });
    expect(fixture.create).toHaveBeenCalledTimes(1);
  });

  it("keeps a lost create response unknown and never repeats provider submission", async () => {
    const scope = await preparedDispatch();
    const fixture = dispatchFixture();
    fixture.create.mockRejectedValueOnce(new Error("lost reply"));
    expect(await fixture.dispatch(scope)).toEqual({ kind: "dispatch_unknown" });
    expect(await fixture.dispatch(scope)).toEqual({ kind: "inactive" });
    expect(fixture.create).toHaveBeenCalledTimes(1);
    expect((await pool.query('SELECT "paymentIntentId" FROM "AutomaticAICreditDispatchClaim"')).rows).toEqual([{ paymentIntentId: null }]);
  });

  it("withholds a response for a different charge without authorizing another", async () => {
    const scope = await preparedDispatch();
    const fixture = dispatchFixture();
    const create = fixture.create.getMockImplementation()!;
    fixture.create.mockImplementationOnce(async (params, options) => ({ ...await create(params, options), customer: "cus_other" }));
    expect(await fixture.dispatch(scope)).toEqual({ kind: "dispatch_unknown" });
    expect((await pool.query('SELECT "paymentIntentId","providerStatus" FROM "AutomaticAICreditDispatchClaim"')).rows)
      .toEqual([{ paymentIntentId: null, providerStatus: null }]);
    expect(await fixture.dispatch(scope)).toEqual({ kind: "inactive" });
    expect(fixture.create).toHaveBeenCalledTimes(1);
  });

  async function reconciliationFixture(lost = true) {
    const scope = await preparedDispatch();
    const fixture = dispatchFixture();
    const reply = fixture.create.getMockImplementation()!;
    if (lost) fixture.create.mockRejectedValueOnce(new Error("lost reply"));
    expect(await fixture.dispatch(scope)).toEqual({ kind: lost ? "dispatch_unknown" : "provider_observed" });
    const { requestJson } = (await pool.query('SELECT "requestJson" FROM "AutomaticAICreditDispatchClaim"')).rows[0];
    const params = JSON.parse(requestJson);
    type PaymentReply = Omit<Awaited<ReturnType<typeof reply>>, "payment_method"> & {
      payment_method: string | null | undefined;
      amount_received: number;
      amount_capturable: number;
      latest_charge: string;
      last_payment_error: null | { code: string; payment_method: { id: string } };
    };
    const payment: PaymentReply = {
      ...await reply(params), amount_received: params.amount, amount_capturable: 0, latest_charge: "ch_fixture",
      last_payment_error: null,
    };
    const retrievePayment = vi.fn(async (): Promise<PaymentReply> => payment);
    const client = { accounts: { retrieve: fixture.account }, paymentIntents: { retrieve: retrievePayment } };
    const reconcile = makeAutomaticTopUpTestReconciler(repo, client as unknown as Parameters<typeof makeAutomaticTopUpTestReconciler>[1], identity);
    return { ...fixture, reconcile, retrievePayment, payment, scope };
  }

  it("recovers a lost payment reply by scoped lookup after consent is revoked", async () => {
    const fixture = await reconciliationFixture();
    expect(await fixture.reconcile(fixture.scope)).toEqual({ kind: "dispatch_unknown" });
    expect(fixture.retrievePayment).not.toHaveBeenCalled();
    expect(await disable(1)).toEqual({ kind: "off", revision: 2 });
    expect(await fixture.reconcile(fixture.scope, "pi_fixture")).toEqual({ kind: "provider_observed", status: "succeeded" });
    expect(fixture.retrievePayment).toHaveBeenCalledExactlyOnceWith("pi_fixture", {}, { maxNetworkRetries: 0 });
    expect(await fixture.dispatch(fixture.scope)).toEqual({ kind: "inactive" });
    expect(fixture.create).toHaveBeenCalledTimes(1);
    expect((await pool.query('SELECT "paymentIntentId","providerStatus" FROM "AutomaticAICreditDispatchClaim"')).rows)
      .toEqual([{ paymentIntentId: "pi_fixture", providerStatus: "succeeded" }]);
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "dispatch_unknown" }]);
  });

  it("reads the stored payment ID and refuses a substitute", async () => {
    const fixture = await reconciliationFixture(false);
    expect(await fixture.reconcile(fixture.scope, "pi_other")).toEqual({ kind: "observation_unverified" });
    expect(fixture.retrievePayment).not.toHaveBeenCalled();
    expect(await fixture.reconcile(fixture.scope)).toEqual({ kind: "provider_observed", status: "succeeded" });
    expect(fixture.create).toHaveBeenCalledTimes(1);
  });

  it("refuses mismatched workspace, provider account, currency, and received amount", async () => {
    const fixture = await reconciliationFixture();
    expect(await fixture.reconcile({ ...fixture.scope, organizationId: "org_other" }, "pi_fixture")).toEqual({ kind: "inactive" });
    fixture.account.mockResolvedValueOnce({ id: "acct_other", lastResponse: fixture.payment.lastResponse });
    expect(await fixture.reconcile(fixture.scope, "pi_fixture")).toEqual({ kind: "observation_unverified" });
    expect(fixture.retrievePayment).not.toHaveBeenCalled();
    fixture.retrievePayment.mockResolvedValueOnce({ ...fixture.payment, currency: "eur" });
    expect(await fixture.reconcile(fixture.scope, "pi_fixture")).toEqual({ kind: "observation_unverified" });
    fixture.retrievePayment.mockResolvedValueOnce({ ...fixture.payment, amount_received: 1 });
    expect(await fixture.reconcile(fixture.scope, "pi_fixture")).toEqual({ kind: "observation_unverified" });
    expect((await pool.query('SELECT "paymentIntentId" FROM "AutomaticAICreditDispatchClaim"')).rows).toEqual([{ paymentIntentId: null }]);
  });

  it("keeps a concurrent older observation from overwriting a successful receipt", async () => {
    const fixture = await reconciliationFixture();
    fixture.retrievePayment.mockImplementationOnce(async () => {
      expect(await fixture.reconcile(fixture.scope, "pi_fixture")).toEqual({ kind: "provider_observed", status: "succeeded" });
      return { ...fixture.payment, status: "processing", amount_received: 0 };
    });
    expect(await fixture.reconcile(fixture.scope, "pi_fixture")).toEqual({ kind: "dispatch_unknown" });
    fixture.retrievePayment.mockResolvedValueOnce({ ...fixture.payment, status: "processing", amount_received: 0 });
    expect(await fixture.reconcile(fixture.scope)).toEqual({ kind: "observation_unverified" });
    expect((await pool.query('SELECT "providerStatus" FROM "AutomaticAICreditDispatchClaim"')).rows)
      .toEqual([{ providerStatus: "succeeded" }]);
  });

  it("reconciles a Stripe card error without using the error payload as payment evidence", async () => {
    const scope = await preparedDispatch();
    const fixture = dispatchFixture();
    const reply = fixture.create.getMockImplementation()!;
    fixture.create.mockImplementationOnce(async params => {
      fixture.retrievePaymentAfterCreate.mockResolvedValueOnce({
        ...await reply(params), payment_method: null, status: "requires_payment_method",
        last_payment_error: { code: "authentication_required", payment_method: { id: "pm_fixture" } },
        amount_received: 0,
      });
      throw Object.assign(new Error("Stripe card response"), {
        type: "StripeCardError", statusCode: 402, payment_intent: { id: "pi_fixture", status: "succeeded" },
      });
    });
    expect(await fixture.dispatch(scope)).toEqual({ kind: "provider_observed", status: "requires_payment_method" });
    expect(fixture.retrievePaymentAfterCreate).toHaveBeenCalledExactlyOnceWith("pi_fixture", {}, { maxNetworkRetries: 0 });
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "authentication_required" }]);
    const view = await readHttp(new NextRequest("https://visionxixlabs.com/api/billing/automatic-top-up"));
    expect((await view.json()).data.payment).toEqual({ state: "authentication_required", amountCents: 1000,
      intentId: scope.intentId, authenticationAvailable: true, cancellationAvailable: true });
    expect(await prepare()).toEqual({ kind: "payment_pending" });
    expect(await fixture.dispatch(scope)).toEqual({ kind: "inactive" });
    expect(fixture.create).toHaveBeenCalledTimes(1);
  });

  it("keeps a decline held until the same payment is canonically canceled without captured funds", async () => {
    const f = await reconciliationFixture();
    const failed = { ...f.payment, status: "requires_payment_method", amount_received: 0,
      payment_method: null, last_payment_error: { code: "card_declined", payment_method: { id: "pm_fixture" } } };
    f.retrievePayment.mockResolvedValueOnce({ ...failed, last_payment_error: { code: "card_declined", payment_method: { id: "pm_other" } } });
    expect(await f.reconcile(f.scope, "pi_fixture")).toEqual({ kind: "observation_unverified" });
    f.retrievePayment.mockResolvedValueOnce(failed);
    expect(await f.reconcile(f.scope, "pi_fixture")).toEqual({ kind: "provider_observed", status: "requires_payment_method" });
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "payment_failed" }]);
    expect(await prepare()).toEqual({ kind: "payment_pending" });
    const canceled = { ...f.payment, status: "canceled", payment_method: null, amount_received: 0 };
    f.retrievePayment.mockResolvedValueOnce({ ...canceled, amount_capturable: 1 });
    expect(await f.reconcile(f.scope)).toEqual({ kind: "observation_unverified" });
    f.retrievePayment.mockResolvedValueOnce(canceled);
    expect(await f.reconcile(f.scope)).toEqual({ kind: "provider_observed", status: "canceled" });
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "canceled" }]);
    expect(await prepare()).toMatchObject({ kind: "prepared" });
  });

  function paymentClients(fixture: Awaited<ReturnType<typeof reconciliationFixture>>) {
    const charge = {
      id: "ch_fixture", object: "charge", livemode: false, status: "succeeded",
      payment_intent: "pi_fixture", customer: "cus_fixture", payment_method: "pm_fixture",
      amount: 1000, amount_captured: 1000, currency: "usd",
      paid: true, captured: true, refunded: false, amount_refunded: 0, disputed: false,
      lastResponse: fixture.payment.lastResponse,
    };
    const retrieveCharge = vi.fn(async () => charge);
    const confirm = vi.fn();
    const cancel = vi.fn();
    const client = { accounts: { retrieve: fixture.account }, paymentIntents: { retrieve: fixture.retrievePayment, confirm, cancel }, charges: { retrieve: retrieveCharge } };
    const settle = makeAutomaticTopUpTestSettlement(repo, client as unknown as Parameters<typeof makeAutomaticTopUpTestSettlement>[1], identity);
    const recovery = makeAutomaticTopUpTestRecovery(repo, client as unknown as Parameters<typeof makeAutomaticTopUpTestRecovery>[1], identity);
    const reconcilePayment = makeAutomaticTopUpTestPaymentNotification(
      repo, client as unknown as Parameters<typeof makeAutomaticTopUpTestPaymentNotification>[1], identity,
    );
    return { ...fixture, settle, recovery, charge, retrieveCharge, confirm, cancel, reconcilePayment };
  }

  async function settlementFixture(throughAuthentication = false) {
    const fixture = await reconciliationFixture();
    if (throughAuthentication) {
      fixture.retrievePayment.mockResolvedValueOnce({ ...fixture.payment, status: "requires_action", amount_received: 0 });
      expect(await fixture.reconcile(fixture.scope, "pi_fixture")).toEqual({ kind: "provider_observed", status: "requires_action" });
      expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "authentication_required" }]);
    }
    expect(await fixture.reconcile(fixture.scope, "pi_fixture")).toEqual({ kind: "provider_observed", status: "succeeded" });
    return paymentClients(fixture);
  }

  async function authenticationFixture(fromDecline = false) {
    const f = paymentClients(await reconciliationFixture());
    const challenge = { ...f.payment, status: "requires_action", amount_received: 0,
      confirmation_method: "automatic", next_action: { type: "use_stripe_sdk" }, client_secret: "pi_fixture_secret_example" };
    const declined = { ...challenge, status: "requires_payment_method", payment_method: null, next_action: null, client_secret: null,
      last_payment_error: { code: "authentication_required", payment_method: { id: "pm_fixture" } } };
    f.retrievePayment.mockImplementation(async () => fromDecline ? declined : challenge);
    expect(await f.reconcile(f.scope, "pi_fixture")).toEqual({ kind: "provider_observed", status: fromDecline ? declined.status : challenge.status });
    mocks.runtime.mockReturnValue({ identity, providerConfigured: true, recovery: () => f.recovery });
    return { ...f, challenge };
  }

  it("presents an exact test challenge to the consenting manager and verifies only after settlement", async () => {
    const f = await authenticationFixture();
    const { organizationId, intentId } = f.scope;
    const authenticate = { action: "authenticate_payment", organizationId, intentId };
    const verify = { action: "verify_payment", organizationId, intentId };
    await pool.query('INSERT INTO "OrgMembership" VALUES ($1,\'other-owner\',now(),\'owner\')', [workspace]);
    mocks.context.mockResolvedValueOnce({ isAuthenticated: true, organizationId: workspace, userId: "other-owner" });
    expect((await mutateHttp(request(authenticate))).status).toBe(409);
    expect((await mutateHttp(request(authenticate, "https://foreign.invalid"))).status).toBe(403);
    const ready = await mutateHttp(request(authenticate));
    expect(ready.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await ready.json()).toMatchObject({ data: { state: "authentication_ready", clientSecret: f.challenge.client_secret } });
    expect(await (await mutateHttp(request(verify))).json()).toMatchObject({ data: { state: "pending" } });
    expect((await pool.query('SELECT id FROM "AddOnPurchase"')).rows).toEqual([]);
    f.retrievePayment.mockResolvedValue(f.payment);
    expect(await (await mutateHttp(request(verify))).json()).toMatchObject({ data: { state: "verified" } });
    expect(await (await mutateHttp(request(verify))).json()).toMatchObject({ data: { state: "verified" } });
    expect((await pool.query('SELECT id FROM "AddOnPurchase"')).rows).toHaveLength(1);
    expect(f.create).toHaveBeenCalledTimes(1);
  });

  it("claims only one on-session confirmation of the same card and payment after an authentication decline", async () => {
    const f = await authenticationFixture(true);
    const command = () => request({ action: "authenticate_payment", organizationId: workspace, intentId: f.scope.intentId });
    f.confirm.mockImplementation(async () => {
      f.retrievePayment.mockImplementation(async () => f.challenge);
      throw Error("provider confirmation response lost");
    });
    const results = await Promise.all([mutateHttp(command()), mutateHttp(command())]);
    expect(results.some(r => r.status === 200)).toBe(true);
    expect(f.confirm).toHaveBeenCalledExactlyOnceWith("pi_fixture", {
      payment_method: "pm_fixture", use_stripe_sdk: true, off_session: false,
    }, { idempotencyKey: `axiom_auto_top_up_on_session_${f.scope.intentId}`, maxNetworkRetries: 0 });
    expect(f.create).toHaveBeenCalledTimes(1);
    expect((await pool.query('SELECT "onSessionRetryClaimed" FROM "AutomaticAICreditDispatchClaim"')).rows)
      .toEqual([{ onSessionRetryClaimed: true }]);
    expect((await pool.query('SELECT id FROM "AddOnPurchase"')).rows).toEqual([]);
  });

  it("holds a lost cancellation until an independent read verifies no payment was collected", async () => {
    const f = await authenticationFixture();
    const command = (action: string) => request({ action, organizationId: workspace, intentId: f.scope.intentId });
    f.cancel.mockRejectedValueOnce(new Error("lost response"));
    expect(await (await mutateHttp(command("cancel_payment"))).json()).toMatchObject({ data: { state: "pending" } });
    expect(f.cancel).toHaveBeenCalledExactlyOnceWith("pi_fixture", { cancellation_reason: "requested_by_customer" },
      { idempotencyKey: `axiom_auto_top_up_cancel_${f.scope.intentId}`, maxNetworkRetries: 0 });
    expect(await prepare()).toEqual({ kind: "payment_pending" });
    f.retrievePayment.mockResolvedValue({ ...f.payment, status: "canceled", payment_method: null, amount_received: 0 });
    expect(await (await mutateHttp(command("verify_payment"))).json()).toMatchObject({ data: { state: "canceled" } });
    expect(await (await mutateHttp(command("cancel_payment"))).json()).toMatchObject({ data: { state: "canceled" } });
    expect(f.cancel).toHaveBeenCalledTimes(1);
    expect((await pool.query('SELECT id FROM "AddOnPurchase"')).rows).toEqual([]);
  });

  it("withholds a new on-session confirmation after the original UTC purchase month", async () => {
    const f = await authenticationFixture(true);
    await pool.query(`UPDATE "AutomaticAICreditTopUpIntent" SET "periodMonth"='2000-01'`);
    expect((await mutateHttp(request({ action: "authenticate_payment", organizationId: workspace, intentId: f.scope.intentId }))).status)
      .toBe(409);
    expect(f.confirm).not.toHaveBeenCalled();
    expect(await prepare()).toEqual({ kind: "payment_pending" });
  });

  it("verifies settlement instead of canceling when the payment has already succeeded", async () => {
    const f = await authenticationFixture();
    f.retrievePayment.mockResolvedValue(f.payment);
    const result = await mutateHttp(request({ action: "cancel_payment", organizationId: workspace, intentId: f.scope.intentId }));
    expect(await result.json()).toMatchObject({ data: { state: "verified" } });
    expect(f.cancel).not.toHaveBeenCalled();
    expect((await pool.query('SELECT id FROM "AddOnPurchase"')).rows).toHaveLength(1);
  });

  function paymentNotification(f: ReturnType<typeof paymentClients>, type: string, id: string) {
    return {
      id, type, account: identity.accountId, api_version: PUBLIC_STRIPE_API_VERSION, livemode: false,
      data: { object: { id: "pi_fixture", object: "payment_intent", metadata: f.payment.metadata } },
    };
  }

  function processPaymentNotification(f: ReturnType<typeof paymentClients>, notification: unknown) {
    return reconcilePublicWebhook(notification, identity, {
      get: async () => { throw Error("unexpected subscription lookup"); },
    }, async () => { throw Error("unexpected subscription reconcile"); }, { reconcilePayment: f.reconcilePayment });
  }

  const notifyPayment = (f: ReturnType<typeof paymentClients>, type: string, id: string) =>
    processPaymentNotification(f, paymentNotification(f, type, id));

  it("settles from a verified provider notification after the create reply is lost and the manager leaves", async () => {
    const f = paymentClients(await reconciliationFixture());
    expect(await disable(1)).toEqual({ kind: "off", revision: 2 });
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
    vi.stubEnv("AXIOM_STRIPE_WEBHOOK_API_VERSION", PUBLIC_STRIPE_API_VERSION);
    const signingFixture = "automatic-top-up-test-signature-fixture";
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", signingFixture);
    mocks.publicRuntime.mockResolvedValue({ webhook: (event: unknown) => processPaymentNotification(f, event) });
    const body = JSON.stringify(paymentNotification(f, "payment_intent.succeeded", "evt_success"));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", signingFixture).update(`${timestamp}.${body}`).digest("hex");
    const notify = (digest: string) => receiveBillingWebhook(new NextRequest("https://fixture.invalid/api/billing/stripe-webhook", {
      method: "POST", body, headers: { "stripe-signature": `t=${timestamp},v1=${digest}` },
    }));
    expect((await notify("0".repeat(64))).status).toBe(401);
    expect(mocks.publicRuntime).not.toHaveBeenCalled();
    expect(await (await notify(signature)).json()).toEqual({ ok: true, outcome: "settled" });
    expect(await notifyPayment(f, "payment_intent.succeeded", "evt_success")).toEqual({ handled: true, outcome: "inactive" });
    expect(await notifyPayment(f, "payment_intent.payment_failed", "evt_delayed_decline")).toEqual({ handled: true, outcome: "inactive" });
    expect((await pool.query('SELECT "stripePaymentIntentId",status FROM "AddOnPurchase"')).rows)
      .toEqual([{ stripePaymentIntentId: "pi_fixture", status: "paid" }]);
    expect(f.create).toHaveBeenCalledTimes(1);
  });

  it("retries a success notification while canonical payment or captured charge evidence is missing", async () => {
    const f = paymentClients(await reconciliationFixture());
    f.retrievePayment.mockResolvedValueOnce({ ...f.payment, status: "processing", amount_received: 0 });
    await expect(notifyPayment(f, "payment_intent.succeeded", "evt_success")).rejects.toThrow("automatic_top_up_payment_unverified");
    expect(f.retrieveCharge).not.toHaveBeenCalled();
    f.retrieveCharge.mockResolvedValueOnce({ ...f.charge, amount_captured: 0 });
    await expect(notifyPayment(f, "payment_intent.succeeded", "evt_success")).rejects.toThrow("automatic_top_up_payment_unverified");
    expect((await pool.query('SELECT id FROM "AddOnPurchase"')).rows).toEqual([]);
    expect(await notifyPayment(f, "payment_intent.succeeded", "evt_success")).toEqual({ handled: true, outcome: "settled" });
  });

  it("does not disclose challenge credentials after consent is revoked during provider lookup", async () => {
    const f = await authenticationFixture();
    const { organizationId, intentId } = f.scope;
    f.retrievePayment.mockImplementationOnce(async () => {
      expect(await disable(1)).toEqual({ kind: "off", revision: 2 });
      return f.challenge;
    });
    const response = await mutateHttp(request({ action: "authenticate_payment", organizationId, intentId }));
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain(f.challenge.client_secret);
    f.retrievePayment.mockResolvedValue(f.payment);
    expect(await (await mutateHttp(request({ action: "verify_payment", organizationId, intentId }))).json()).toMatchObject({ data: { state: "verified" } });
  });

  it("credits the existing ledger once after recovering a fully captured test payment", async () => {
    const f = await settlementFixture(true);
    expect(await disable(1)).toEqual({ kind: "off", revision: 2 });
    const result = await Promise.all([f.settle(f.scope), f.settle(f.scope)]);
    expect(result.filter(item => item.kind === "settled")).toHaveLength(1);
    expect(await f.settle(f.scope)).toEqual({ kind: "already_settled" });
    expect(f.create).toHaveBeenCalledTimes(1);
    expect((await pool.query('SELECT "organizationId",sku,"pricePaidCents","deliveredAICreditsCents","validFor",status,"stripePaymentIntentId","purchasedBy" FROM "AddOnPurchase"')).rows)
      .toEqual([{ organizationId: workspace, sku: "ai_credits_small", pricePaidCents: 1000, deliveredAICreditsCents: 1000,
        validFor: "permanent", status: "paid", stripePaymentIntentId: "pi_fixture", purchasedBy: "fixture-owner" }]);
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "paid" }]);
  });

  it.each([{ amount_refunded: 1001 }, { disputed: true }, { amount_captured: 999 }, { payment_intent: "pi_other" }, { livemode: true }])(
    "withholds prepaid credit when the canonical charge has %j",
    async override => {
      const f = await settlementFixture();
      f.retrieveCharge.mockResolvedValueOnce({ ...f.charge, ...override });
      expect(await f.settle(f.scope)).toEqual({ kind: "payment_unverified" });
      expect(f.retrieveCharge).toHaveBeenCalledExactlyOnceWith("ch_fixture", {}, { maxNetworkRetries: 0 });
      expect((await pool.query('SELECT id FROM "AddOnPurchase"')).rows).toEqual([]);
      expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "dispatch_unknown" }]);
    },
  );

  function signedRefund(f: Awaited<ReturnType<typeof settlementFixture>>, refunded: number, eventId: string) {
    const charge: AutomaticTopUpRefundCharge = {
      ...f.charge, object: "charge", status: "succeeded", refunded: refunded === 1000, amount_refunded: refunded,
      metadata: { purpose: "axiom_auto_ai_credit_top_up_v1", organizationId: workspace, intentId: f.scope.intentId, sku: "ai_credits_small" },
    };
    return recordAutomaticTopUpTestRefund(repo, identity, eventId, charge);
  }

  const ledgerRefunds = () => pool.query('SELECT status,"refundedAmountCents","reversedAICreditsCents" FROM "AddOnPurchase"');

  function disputeEvent(f: Awaited<ReturnType<typeof settlementFixture>>, status: string, eventId: string, id = "du_fixture") {
    return recordAutomaticTopUpTestDispute(repo, identity, { id: eventId, type: "charge.dispute.closed" }, {
      id, object: "dispute", status, livemode: false, amount: 300, currency: "usd",
      charge: "ch_fixture", payment_intent: "pi_fixture",
    }, {
      ...f.charge, object: "charge", status: "succeeded",
      metadata: { purpose: "axiom_auto_ai_credit_top_up_v1", organizationId: workspace, intentId: f.scope.intentId, sku: "ai_credits_small" },
    });
  }

  it("holds a disputed pack even if settlement read charge evidence before the dispute committed", async () => {
    const f = await settlementFixture();
    f.retrieveCharge.mockImplementationOnce(async () => {
      expect(await disputeEvent(f, "needs_response", "evt_open")).toBe("recorded");
      return f.charge;
    });
    expect(await f.settle(f.scope)).toEqual({ kind: "settled" });
    expect((await ledgerRefunds()).rows).toEqual([{ status: "paid", refundedAmountCents: 0, reversedAICreditsCents: 1000 }]);
    expect(await signedRefund(f, 250, "evt_refund")).toBe("recorded");
    expect(await disputeEvent(f, "won", "evt_won")).toBe("recorded");
    expect(await disputeEvent(f, "won", "evt_won")).toBe("replay");
    expect(await disputeEvent(f, "under_review", "evt_late")).toBe("stale");
    expect((await ledgerRefunds()).rows).toEqual([{ status: "partially_refunded", refundedAmountCents: 250, reversedAICreditsCents: 250 }]);
  });

  it("aggregates independently bound disputes and later refunds without reopening gross charge capacity", async () => {
    const f = await settlementFixture();
    expect(await f.settle(f.scope)).toEqual({ kind: "settled" });
    expect(await disputeEvent(f, "needs_response", "evt_open")).toBe("recorded");
    expect(await disputeEvent(f, "under_review", "evt_open_second", "du_second")).toBe("recorded");
    expect(await disputeEvent(f, "lost", "evt_lost")).toBe("recorded");
    expect((await ledgerRefunds()).rows[0].reversedAICreditsCents).toBe(1000);
    expect(await disputeEvent(f, "won", "evt_won", "du_second")).toBe("recorded");
    expect(await signedRefund(f, 250, "evt_refund")).toBe("recorded");
    expect((await ledgerRefunds()).rows).toEqual([{ status: "partially_refunded", refundedAmountCents: 250, reversedAICreditsCents: 550 }]);
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "paid" }]);
  });

  it("does not let an older inquiry closure release an escalated dispute", async () => {
    const f = await settlementFixture();
    expect(await f.settle(f.scope)).toEqual({ kind: "settled" });
    expect(await disputeEvent(f, "warning_needs_response", "evt_inquiry")).toBe("recorded");
    expect(await disputeEvent(f, "needs_response", "evt_escalated")).toBe("recorded");
    expect(await disputeEvent(f, "warning_closed", "evt_stale_inquiry")).toBe("stale");
    expect((await ledgerRefunds()).rows[0].reversedAICreditsCents).toBe(1000);
  });

  it("applies a signed refund received during an otherwise stale canonical charge read", async () => {
    const f = await settlementFixture();
    f.retrieveCharge.mockImplementationOnce(async () => {
      expect(await signedRefund(f, 250, "evt_first")).toBe("recorded");
      return f.charge;
    });
    expect(await f.settle(f.scope)).toEqual({ kind: "settled" });
    expect((await ledgerRefunds()).rows).toEqual([{ status: "partially_refunded", refundedAmountCents: 250, reversedAICreditsCents: 250 }]);
    expect(await signedRefund(f, 250, "evt_first")).toBe("replay");
    expect(await signedRefund(f, 1000, "evt_complete")).toBe("recorded");
    expect(await signedRefund(f, 125, "evt_late")).toBe("recorded");
    expect((await ledgerRefunds()).rows).toEqual([{ status: "refunded", refundedAmountCents: 1000, reversedAICreditsCents: 1000 }]);
  });

  it("settles a canonically refunded payment with no spendable credits", async () => {
    const f = await settlementFixture();
    f.retrieveCharge.mockResolvedValueOnce({ ...f.charge, refunded: true, amount_refunded: 1000 });
    expect(await f.settle(f.scope)).toEqual({ kind: "settled" });
    expect((await ledgerRefunds()).rows).toEqual([{ status: "refunded", refundedAmountCents: 1000, reversedAICreditsCents: 1000 }]);
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "paid" }]);
  });

  it("leaves an event retryable until the lost payment is independently bound", async () => {
    const f = await settlementFixture();
    await pool.query('UPDATE "AutomaticAICreditDispatchClaim" SET "paymentIntentId"=NULL,"providerStatus"=NULL,"observedAt"=NULL');
    expect(await signedRefund(f, 1000, "evt_unbound")).toBe("payment_unbound");
    expect((await pool.query('SELECT id FROM "StripeBillingEvent"')).rows).toEqual([]);
    expect(await f.reconcile(f.scope, "pi_fixture")).toEqual({ kind: "provider_observed", status: "succeeded" });
    expect(await signedRefund(f, 1000, "evt_unbound")).toBe("recorded");
    expect(await f.settle(f.scope)).toEqual({ kind: "settled" });
    expect((await ledgerRefunds()).rows).toEqual([{ status: "refunded", refundedAmountCents: 1000, reversedAICreditsCents: 1000 }]);
  });

  it("rolls back the paid state when the payment is bound in the ledger already", async () => {
    const f = await settlementFixture();
    await pool.query(`
      INSERT INTO "AddOnPurchase" (id,"organizationId",sku,"pricePaidCents","validFor","periodMonth",
        "stripePaymentIntentId","idempotencyKey","purchasedBy","correlationId","updatedAt")
      VALUES ('other','other','ai_credits_small',1000,'permanent','2026-11','pi_fixture','other','other','other',now())
    `);
    expect(await f.settle(f.scope)).toEqual({ kind: "unavailable" });
    expect((await pool.query('SELECT id FROM "AddOnPurchase"')).rows).toEqual([{ id: "other" }]);
    expect((await pool.query('SELECT state FROM "AutomaticAICreditTopUpIntent"')).rows).toEqual([{ state: "dispatch_unknown" }]);
  });

  it("rechecks consent after setup retrieve and makes no payment call on revocation", async () => {
    const scope = await preparedDispatch();
    const fixture = dispatchFixture();
    const retrieve = fixture.retrieve.getMockImplementation()!;
    fixture.retrieve.mockImplementationOnce(async () => {
      expect(await disable(1)).toEqual({ kind: "off", revision: 2 });
      return retrieve();
    });
    expect(await fixture.dispatch(scope)).toEqual({ kind: "stale" });
    expect(fixture.create).not.toHaveBeenCalled();
  });
});

/** Registered only inside the existing opt-in owned PG suite. This declaration
 * installs nothing. The default suite skips all database/server work. */
import { beforeAll, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { claimNewTestBillableDispatch, settleAttributedUsageV2, type AttributedGatewayCostV2 } from "../../newTestSubscription/usageAllocationIO";
import { reserveAllocationV2, newTestAllocationPricingPlan } from "../../newTestSubscription/allocationPlan";
import { readFixtureEnrollment } from "../../newTestSubscription/fixtureAllocation";
import { releaseAICreditReservation } from "../../aiCreditReservation";
import type { reverseAICreditRefund } from "../../aiCreditFulfillment";
import { anniversaryFixture, assertBlockedBy, databaseClock, fixtureId, gatedTransaction, queryGate, waitForDatabaseTime, type AnniversaryFixture, type OwnedAnniversaryContext } from "./newTestAnniversaryFixture";
export type AnniversaryAcceptanceHarness = { context(): OwnedAnniversaryContext; refund: typeof reverseAICreditRefund; observeRefund(listener: (pid: number) => void): () => void };
const purchaseLock = (sql: string) => sql.startsWith('SELECT * FROM "AddOnPurchase"');
const memberLock = (sql: string) => sql.startsWith('SELECT "userId","organizationId",role,"acceptedAt" FROM "OrgMembership"');
async function captured<T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> { try { return { ok: true, value: await promise }; } catch (error) { return { ok: false, error }; } }
export function registerAnniversaryAcceptance(harness: AnniversaryAcceptanceHarness) {
  let ttl: { f: AnniversaryFixture; id: string; expiresAt: Date; admittedAt: Date };
  beforeAll(async () => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx); await f.exhaustFree(); await f.purchase();
    const h = await f.reserve(100); expect(await f.claim(h.id)).toBe(true);
    const stored = await ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: h.id } });
    ttl = { f, id: h.id, expiresAt: stored.expiresAt, admittedAt: stored.createdAt };
  }, 30000);

  it.each(["monthly", "annual"] as const)("V2 real SQL parses read/reserve/claim with empty and purchase selections (%s)", async interval => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx, { interval });
    expect(await f.service.previewRemaining(f.actor)).toMatchObject({ remainingCents: 200 });
    const free = await f.reserve(100); expect(await f.claim(free.id)).toBe(true); await f.direct(free.id, 80);
    expect(await f.activate()).toBe("applied");
    const paid = await f.reserve(3000); expect(await f.claim(paid.id)).toBe(true); await f.direct(paid.id, 3000);
    await f.purchase(); const topup = await f.reserve(100); expect(await f.claim(topup.id)).toBe(true);
    const pending = await f.pending(topup.id); expect(pending.usageEventId).toBeTruthy(); await f.settle(pending.usageEventId!, topup.id);
    expect(await f.service.previewRemaining(f.actor)).toMatchObject({ remainingCents: 420 });
    const body = await ctx.db.$queryRawUnsafe<Array<{ body: { allocation: Array<{ source: string; purchaseId?: string }> } }>>('SELECT body FROM "NewTestReservationAttribution" WHERE "reservationId"=$1', topup.id);
    expect(body[0].body.allocation).toEqual([expect.objectContaining({ source: "purchase", maxCents: 100 })]);
    const sealed = await f.financial();
    // The unchanged composer signals historical replay to its outer loop with
    // this closed error. It is not a second successful settlement or a debit.
    await expect(f.settle(pending.usageEventId!, topup.id)).rejects.toThrow("gateway_usage_already_settled");
    expect(await f.financial()).toEqual(sealed);
    const originalCost: AttributedGatewayCostV2 = { eventId: pending.usageEventId!, externalUsageId: `gen-${topup.id}`, providerCostCents: 53, billedCents: 80, model: "synthetic_gateway", inputTokens: 10, outputTokens: 20, cachedReadTokens: 0 };
    const sealedReplay = (cost: AttributedGatewayCostV2) => ctx.db.$transaction(tx => settleAttributedUsageV2(tx, cost), { isolationLevel: "Serializable" });
    expect(await sealedReplay(originalCost)).toBe("already_settled");
    expect(await f.financial()).toEqual(sealed);
    for (const changed of [{ ...originalCost, model: "changed" }, { ...originalCost, inputTokens: 11 }, { ...originalCost, outputTokens: 21 }, { ...originalCost, cachedReadTokens: 1 }, { ...originalCost, providerCostCents: 54, billedCents: 81 }]) {
      await expect(sealedReplay(changed)).rejects.toThrow("attributed_usage_unavailable");
      expect(await f.financial()).toEqual(sealed);
    }
    expect(await f.service.previewRemaining(f.actor)).toMatchObject({ remainingCents: 420 });
    expect(f.created()).toBe(1);
  }, 30000);

  it("V2 original Free preflight loses the real paid consumer revision and leaves no partial hold", async () => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx), gate = queryGate(sql => sql.startsWith('SELECT e.body,e.revision') && sql.endsWith("FOR UPDATE OF e"), "before");
    const key = `free_paid_race_${fixtureId()}`;
    const reserving = captured(gatedTransaction(ctx.db, gate, async tx => {
      const state = await readFixtureEnrollment(tx, { runtimeId: ctx.runtime, accountId: "acct-test", organizationId: f.actor.organizationId }); if (!state) throw new Error("owned_enrollment_missing");
      return reserveAllocationV2(tx, await newTestAllocationPricingPlan(tx, state.enrollment, null, state), { organizationId: f.actor.organizationId, idempotencyKey: key, reservedCents: 100 }, false);
    }));
    try { await gate.reached; expect(await f.activate()).toBe("applied"); }
    finally { gate.release(); await Promise.allSettled([reserving]); }
    const result = await reserving; expect(result.ok && !!result.value).toBe(false);
    expect(await ctx.db.aIUsageReservation.count({ where: { organizationId: f.actor.organizationId, idempotencyKey: key } })).toBe(0);
    expect(await ctx.db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "NewTestReservationAttribution" WHERE org=$1', f.actor.organizationId)).toEqual([{ count: 0 }]);
    expect(await f.service.previewRemaining(f.actor)).toMatchObject({ remainingCents: 3000 });
  }, 30000);

  it.each([false, true])("V2 original Free hold survives paid activation and late80 without regrant (purchase=%s)", async purchased => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx);
    if (purchased) { await f.exhaustFree(); await f.purchase(); }
    const h = await f.reserve(100); expect(await f.claim(h.id)).toBe(true);
    const attribution = await ctx.db.$queryRawUnsafe('SELECT body FROM "NewTestReservationAttribution" WHERE "reservationId"=$1', h.id);
    await f.activate(); await f.direct(h.id, 80);
    expect(await f.service.previewRemaining(f.actor)).toMatchObject({ remainingCents: purchased ? 3420 : 3000 });
    expect(await ctx.db.$queryRawUnsafe('SELECT body FROM "NewTestReservationAttribution" WHERE "reservationId"=$1', h.id)).toEqual(attribution);
    const event = await ctx.db.usageEvent.findUniqueOrThrow({ where: { id: (await ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: h.id } })).usageEventId! } });
    expect(event.metadata).toMatchObject({ axiomTestAllocationV2: { kind: "free", state: "settled", allocation: [purchased ? expect.objectContaining({ source: "purchase", cents: 80 }) : expect.objectContaining({ source: "included", cents: 80 })] } });
    if (purchased) expect(await ctx.db.addOnPurchase.findMany({ where: { organizationId: f.actor.organizationId } })).toEqual([expect.objectContaining({ deliveredAICreditsCents: 500, reversedAICreditsCents: 0 })]);
  }, 30000);

  it("V2 commit constraints reject orphan/cross-scope/rewritten attribution and sealed usage", async () => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx), other = await anniversaryFixture(ctx);
    const before = await f.financial();
    await expect(ctx.db.aIUsageReservation.create({ data: { organizationId: f.actor.organizationId, idempotencyKey: `orphan_${fixtureId()}`, reservedCents: 1, status: "reserved", expiresAt: new Date((await databaseClock(ctx.db)).getTime() + 300000) } })).rejects.toThrow();
    expect(await f.financial()).toEqual(before);
    const h = await f.reserve(100), original = await ctx.db.$queryRawUnsafe<Array<{ body: Prisma.JsonValue }>>('SELECT body FROM "NewTestReservationAttribution" WHERE "reservationId"=$1', h.id);
    await expect(ctx.db.$executeRawUnsafe('UPDATE "NewTestReservationAttribution" SET org=$1 WHERE "reservationId"=$2', other.actor.organizationId, h.id)).rejects.toThrow();
    await expect(ctx.db.$executeRawUnsafe('DELETE FROM "NewTestReservationAttribution" WHERE "reservationId"=$1', h.id)).rejects.toThrow();
    expect(await ctx.db.$queryRawUnsafe('SELECT body FROM "NewTestReservationAttribution" WHERE "reservationId"=$1', h.id)).toEqual(original);
    const beforeCrossScope = await f.financial();
    await expect(ctx.db.$transaction(async tx => {
      const cross = await tx.aIUsageReservation.create({ data: { organizationId: f.actor.organizationId, idempotencyKey: `cross_${fixtureId()}`, reservedCents: 100, status: "reserved", expiresAt: new Date((await databaseClock(tx)).getTime() + 300000) } });
      await tx.$executeRawUnsafe('INSERT INTO "NewTestReservationAttribution" ("reservationId",org,"enrollmentDigest",body) VALUES ($1,$2,$3,$4::jsonb)', cross.id, other.actor.organizationId, (original[0].body as { enrollmentDigest: string }).enrollmentDigest, JSON.stringify(original[0].body));
    })).rejects.toThrow();
    expect(await f.financial()).toEqual(beforeCrossScope);
    await expect(ctx.db.$executeRawUnsafe('UPDATE "NewTestAllowanceBasis" SET body=body WHERE org=$1', f.actor.organizationId)).rejects.toThrow();
    await expect(ctx.db.usageEvent.create({ data: { organizationId: f.actor.organizationId, eventKind: "ai_invocation", billedCents: 0, billingStatus: "pending" } })).rejects.toThrow();
    expect(await f.claim(h.id)).toBe(true); await f.direct(h.id, 80);
    const stored = await ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: h.id } });
    await expect(ctx.db.usageEvent.update({ where: { id: stored.usageEventId! }, data: { model: "rewrite" } })).rejects.toThrow();
    await expect(ctx.db.aIUsageReservation.update({ where: { id: h.id }, data: { reservedCents: 999 } })).rejects.toThrow();
    await expect(ctx.db.$executeRawUnsafe(`UPDATE "OrganizationTestAllowanceEnrollment" SET body=jsonb_set(body,'{policy}','"rewrite"'::jsonb) WHERE org=$1`, f.actor.organizationId)).rejects.toThrow();
  }, 30000);

  it("V2 initial consumer and actual usage writes roll back joined evidence/plan/hold on injected failures", async () => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx), org = f.actor.organizationId;
    const functionName = `fail_v2_${fixtureId()}`;
    await ctx.db.$executeRawUnsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.org='${org}' AND NEW."paidBasisDigest" IS NOT NULL THEN RAISE EXCEPTION 'owned_v2_activation_failure'; END IF; RETURN NEW; END $$`);
    await ctx.db.$executeRawUnsafe(`CREATE TRIGGER ${functionName} BEFORE UPDATE ON "OrganizationTestAllowanceEnrollment" FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
    try {
      await expect(f.activate()).rejects.toThrow();
      expect(await ctx.db.tenantBillingPlan.findUnique({ where: { organizationId: org } })).toBeNull();
      for (const table of ["OrganizationTestSubscriptionContract", "NewTestPaidInvoiceEvidence", "OrganizationTestCoverageObservation"]) expect(await ctx.db.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "${table}" WHERE org=$1`, org)).toEqual([{ count: 0 }]);
      expect(await ctx.db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "NewTestAllowanceBasis" WHERE org=$1 AND kind=\'paid\'', org)).toEqual([{ count: 0 }]);
      expect(await ctx.db.$queryRawUnsafe('SELECT revision,"paidBasisDigest" FROM "OrganizationTestAllowanceEnrollment" WHERE org=$1', org)).toEqual([{ revision: 1, paidBasisDigest: null }]);
      const i = f.intent()!; expect((await f.store.transaction(tx => tx.intent(i.id)))?.state).toBe("session_confirmed");
      expect(await ctx.db.stripeBillingEvent.findUnique({ where: { id: f.originEventId } })).toBeNull();
    } finally { await ctx.db.$executeRawUnsafe(`DROP TRIGGER ${functionName} ON "OrganizationTestAllowanceEnrollment"`); await ctx.db.$executeRawUnsafe(`DROP FUNCTION ${functionName}()`); }
    expect(await f.activate()).toBe("applied");
    const h = await f.reserve(100); expect(await f.claim(h.id)).toBe(true); const before = await f.financial();
    const usageFailure = `fail_usage_${fixtureId()}`;
    await ctx.db.$executeRawUnsafe(`CREATE FUNCTION ${usageFailure}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${h.id}' AND NEW.status IN ('settled','pending_settlement') THEN RAISE EXCEPTION 'owned_v2_usage_failure'; END IF; RETURN NEW; END $$`);
    await ctx.db.$executeRawUnsafe(`CREATE TRIGGER ${usageFailure} BEFORE UPDATE ON "AIUsageReservation" FOR EACH ROW EXECUTE FUNCTION ${usageFailure}()`);
    try { await expect(f.direct(h.id, 80)).rejects.toThrow(); expect(await f.financial()).toEqual(before); await expect(f.pending(h.id)).rejects.toThrow(); expect(await f.financial()).toEqual(before); }
    finally { await ctx.db.$executeRawUnsafe(`DROP TRIGGER ${usageFailure} ON "AIUsageReservation"`); await ctx.db.$executeRawUnsafe(`DROP FUNCTION ${usageFailure}()`); }
    const pending = await f.pending(h.id), pendingBefore = await f.financial(), settlementFailure = `fail_settle_${fixtureId()}`;
    await ctx.db.$executeRawUnsafe(`CREATE FUNCTION ${settlementFailure}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${pending.usageEventId}' AND NEW."billingStatus"='settled' THEN RAISE EXCEPTION 'owned_v2_settlement_failure'; END IF; RETURN NEW; END $$`);
    await ctx.db.$executeRawUnsafe(`CREATE TRIGGER ${settlementFailure} BEFORE UPDATE ON "UsageEvent" FOR EACH ROW EXECUTE FUNCTION ${settlementFailure}()`);
    try { await expect(f.settle(pending.usageEventId!, h.id)).rejects.toThrow(); expect(await f.financial()).toEqual(pendingBefore); }
    finally { await ctx.db.$executeRawUnsafe(`DROP TRIGGER ${settlementFailure} ON "UsageEvent"`); await ctx.db.$executeRawUnsafe(`DROP FUNCTION ${settlementFailure}()`); }
    await f.settle(pending.usageEventId!, h.id);
  }, 30000);

  it.each(["demoted", "unaccepted"])("V2 real member %s commits before final lock and cannot dispatch", async kind => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx), h = await f.reserve(100), before = await f.financial(), gate = queryGate(memberLock, "before");
    const claiming = captured(gatedTransaction(ctx.db, gate, tx => claimNewTestBillableDispatch(tx, f.actor, h.id)));
    try {
      await gate.reached;
      await ctx.db.orgMembership.update({ where: { userId_organizationId: f.actor }, data: kind === "demoted" ? { role: "read_only" } : { acceptedAt: null } });
    } finally { gate.release(); await Promise.allSettled([claiming]); }
    const result = await claiming; expect(result.ok && result.value).toBe(false); expect(await f.financial()).toEqual(before);
  }, 30000);

  it("V2 claimed member share lock blocks real demotion until commit, then prevents future dispatch", async () => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx), h = await f.reserve(100), gate = queryGate(memberLock, "after");
    const claiming = captured(gatedTransaction(ctx.db, gate, tx => claimNewTestBillableDispatch(tx, f.actor, h.id)));
    let update: Promise<unknown> | undefined;
    try {
      const claimant = await gate.reached;
      let notify!: (pid: number) => void; const begun = new Promise<number>(resolve => { notify = resolve; });
      update = ctx.db.$transaction(async tx => { notify((await tx.$queryRawUnsafe<Array<{ pid: number }>>('SELECT pg_backend_pid() AS pid'))[0].pid); return tx.orgMembership.update({ where: { userId_organizationId: f.actor }, data: { role: "read_only" } }); }, { timeout: 10000 });
      const waiter = await begun; await assertBlockedBy(ctx.db, waiter, claimant);
    } finally { gate.release(); await Promise.allSettled([claiming, ...(update ? [update] : [])]); }
    expect(await claiming).toEqual({ ok: true, value: true }); await update;
    expect((await ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: h.id } })).status).toBe("dispatch_unknown");
    await expect(f.claim(h.id)).rejects.toThrow(); await f.direct(h.id, 80);
  }, 30000);

  it.each(["reserve", "claim"])("V2 actual refund wins after %s preflight and stale purchase authority refuses", async phase => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx); await f.exhaustFree(); const purchase = await f.purchase();
    const h = phase === "claim" ? await f.reserve(100) : null, gate = queryGate(purchaseLock, "before"), before = await f.financial();
    const operation = captured(gatedTransaction(ctx.db, gate, async tx => {
      if (h) return claimNewTestBillableDispatch(tx, f.actor, h.id);
      const state = await readFixtureEnrollment(tx, { runtimeId: ctx.runtime, accountId: "acct-test", organizationId: f.actor.organizationId }); if (!state) throw new Error("owned_enrollment_missing");
      const plan = await newTestAllocationPricingPlan(tx, state.enrollment, null, state);
      return reserveAllocationV2(tx, plan, { organizationId: f.actor.organizationId, idempotencyKey: `refund_race_${fixtureId()}`, reservedCents: 100 }, false);
    }));
    try { await gate.reached; await harness.refund({ id: `evt-refund-${fixtureId()}`, type: "charge.refunded" }, { payment_intent: purchase.stripePaymentIntentId, amount_refunded: 500, currency: "usd" }); }
    finally { gate.release(); await Promise.allSettled([operation]); }
    const result = await operation; expect(result.ok && !!result.value).toBe(false);
    const after = await f.financial(); expect(after.usage).toEqual(before.usage); expect(after.holds).toEqual(before.holds); expect(after.purchases).toEqual([expect.objectContaining({ reversedAICreditsCents: 500, status: "refunded" })]);
  }, 30000);

  it.each(["reserve", "claim"])("V2 %s purchase row lock blocks the actual unchanged refund writer until commit", async phase => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx); await f.exhaustFree(); const purchase = await f.purchase(), h = phase === "claim" ? await f.reserve(100) : null, gate = queryGate(purchaseLock, "after");
    const operation = captured(gatedTransaction(ctx.db, gate, async tx => {
      if (h) return claimNewTestBillableDispatch(tx, f.actor, h.id);
      const state = await readFixtureEnrollment(tx, { runtimeId: ctx.runtime, accountId: "acct-test", organizationId: f.actor.organizationId }); if (!state) throw new Error("owned_enrollment_missing");
      return reserveAllocationV2(tx, await newTestAllocationPricingPlan(tx, state.enrollment, null, state), { organizationId: f.actor.organizationId, idempotencyKey: `refund_wait_${fixtureId()}`, reservedCents: 100 }, false);
    }));
    let refund: Promise<unknown> | undefined, stop = () => {};
    try {
      const blocker = await gate.reached; let notify!: (pid: number) => void; const begun = new Promise<number>(resolve => { notify = resolve; }); stop = harness.observeRefund(notify);
      refund = harness.refund({ id: `evt-refund-${fixtureId()}`, type: "charge.refunded" }, { payment_intent: purchase.stripePaymentIntentId, amount_refunded: 500, currency: "usd" });
      await assertBlockedBy(ctx.db, await begun, blocker);
    } finally { gate.release(); stop(); await Promise.allSettled([operation, ...(refund ? [refund] : [])]); }
    const result = await operation; expect(result.ok && !!result.value).toBe(true); await refund;
    expect(await ctx.db.addOnPurchase.findUniqueOrThrow({ where: { id: purchase.id } })).toMatchObject({ reversedAICreditsCents: 500, status: "refunded" });
    const before = await f.financial();
    if (h) { expect((await ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: h.id } })).status).toBe("dispatch_unknown"); await f.direct(h.id, 80); }
    else expect((await f.financial()).holds.length).toBe(before.holds.length);
    expect(await f.service.previewRemaining(f.actor)).toMatchObject({ remainingCents: 0 });
  }, 30000);

  it("V2 paid included reserved1000 loses new dispatch on inactiveFree200 but unknown late cost survives", async () => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx); await f.activate();
    const reserved = await f.reserve(1000), unknown = await f.reserve(100); expect(await f.claim(unknown.id)).toBe(true); await f.inactive();
    const before = await f.financial(); expect(await f.claim(reserved.id)).toBe(false); expect(await f.financial()).toEqual(before);
    await f.direct(unknown.id, 80); expect((await ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: reserved.id } })).status).toBe("reserved");
    expect(await f.service.previewRemaining(f.actor)).toMatchObject({ remainingCents: 200 });
  }, 30000);

  it.each(["monthly", "annual"] as const)("V2 canonical synthetic expired full %s period cannot grant current allowance", async interval => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx, { interval });
    // Synthetic historical provider facts; actual service/SDK validators and real
    // admission clock remain untouched. This does not prove a clock-edge race.
    await f.activateExpiredHistory();
    expect(f.period().end!.getTime()).toBeLessThan((await databaseClock(ctx.db)).getTime());
    await expect(f.service.previewRemaining(f.actor)).rejects.toThrow();
    const before = await f.financial();
    expect(await f.store.reserveCredits(f.actor, { idempotencyKey: `expired_${fixtureId()}`, reservedCents: 1 }, new Date())).toMatchObject({ ok: false });
    expect(await f.financial()).toEqual(before);
  }, 30000);

  it("V2 real clock after a real row-lock wait crosses a non-authoritative canary deadline", async () => {
    const ctx = harness.context(), f = await anniversaryFixture(ctx), purchase = await f.purchase();
    let unlock!: () => void, notify!: (pid: number) => void; const release = new Promise<void>(resolve => { unlock = resolve; }), held = new Promise<number>(resolve => { notify = resolve; });
    const locking = ctx.db.$transaction(async tx => { const pid = (await tx.$queryRawUnsafe<Array<{ pid: number }>>('SELECT pg_backend_pid() AS pid'))[0].pid; await tx.$queryRawUnsafe('SELECT id FROM "AddOnPurchase" WHERE id=$1 FOR UPDATE', purchase.id); notify(pid); await release; }, { timeout: 10000 });
    let waiting: Promise<{ after: Date; target: Date }> | undefined;
    try {
      const blocker = await held; let waiterNotify!: (pid: number) => void; const waiterBegun = new Promise<number>(resolve => { waiterNotify = resolve; });
      waiting = ctx.db.$transaction(async tx => { const pid = (await tx.$queryRawUnsafe<Array<{ pid: number }>>('SELECT pg_backend_pid() AS pid'))[0].pid, target = new Date((await databaseClock(tx)).getTime() + 1000); waiterNotify(pid);
        await tx.$queryRawUnsafe('SELECT id FROM "AddOnPurchase" WHERE id=$1 FOR UPDATE', purchase.id); return { after: await databaseClock(tx), target }; }, { timeout: 10000 });
      await assertBlockedBy(ctx.db, await waiterBegun, blocker); await waitForDatabaseTime(ctx.db, new Date((await databaseClock(ctx.db)).getTime() + 1200), 4000);
    } finally { unlock(); await Promise.allSettled([locking, ...(waiting ? [waiting] : [])]); }
    await locking; const result = await waiting!; expect(result.after >= result.target).toBe(true);
    // This is NOT a shortened service period or billing authority injection.
    // Concurrent natural anniversary/UTC-month rollover remains unproved.
  }, 30000);

  it("V2 actual claimed unknown remains held after its genuine five-minute TTL without a usage link", async () => {
    const { db } = harness.context();
    await waitForDatabaseTime(db, new Date(ttl.expiresAt.getTime() + 50), 330000);
    const actual = await db.aIUsageReservation.findUniqueOrThrow({ where: { id: ttl.id } });
    expect(actual).toMatchObject({ status: "dispatch_unknown", usageEventId: null, expiresAt: ttl.expiresAt, createdAt: ttl.admittedAt });
    expect(await releaseAICreditReservation(db, ttl.f.actor.organizationId, ttl.id)).toBe(false); expect(await ttl.f.claim(ttl.id)).toBe(false);
    expect(await ttl.f.service.previewRemaining(ttl.f.actor)).toMatchObject({ remainingCents: 400 });
    const beforeDenied = await ttl.f.financial(), deniedKey = `ttl_no_regrant_${fixtureId()}`;
    expect(await ttl.f.store.reserveCredits(ttl.f.actor, { idempotencyKey: deniedKey, reservedCents: 401 }, new Date())).toEqual({ ok: false, error: "ai_credit_reservation_unavailable" });
    expect(await ttl.f.financial()).toEqual(beforeDenied);
    expect(await db.aIUsageReservation.count({ where: { organizationId: ttl.f.actor.organizationId, idempotencyKey: deniedKey } })).toBe(0);
    // Generic refusal alone does not prove exhaustion. Real current400 preview,
    // unchanged ledger and the other positive reservations supply that context.
    expect((await db.aIUsageReservation.findUniqueOrThrow({ where: { id: ttl.id } })).status).toBe("dispatch_unknown");
    await ttl.f.direct(ttl.id, 80); expect(await ttl.f.service.previewRemaining(ttl.f.actor)).toMatchObject({ remainingCents: 420 });
  }, 360000);

}

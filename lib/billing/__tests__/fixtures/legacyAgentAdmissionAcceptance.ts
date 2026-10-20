/** Extends the EXISTING opt-in owned PG17 suite. Declaring these cases creates
 * no client/container/connection and has no SDK/provider path. */
import { expect, it } from "vitest";
import { claimLegacyAICreditDispatch, releaseAICreditReservation, reserveAICredits } from "../../aiCreditReservation";
import { admitGovernedExtract, consumeGovernedExtractAdmission } from "../../governedExtractAdmission";
import { assertBlockedBy, assertOwnedAnniversaryContext, databaseClock, fixtureId, gatedTransaction, queryGate, waitForDatabaseTime, type OwnedAnniversaryContext } from "./newTestAnniversaryFixture";

type Harness = { context(): OwnedAnniversaryContext };
type Case = { name: string; run(): Promise<void> };
type ClaimOutcome = "claimed" | "refused" | "serialization_conflict" | "unexpected_error";
/** PostgreSQL may reject the losing Serializable UPDATE rather than return
 * zero rows. No arbitrary rejection is counted as a successful race test. */
export function legacyClaimOutcome(result: PromiseSettledResult<boolean>): ClaimOutcome {
  if (result.status === "fulfilled") return result.value === true ? "claimed" : result.value === false ? "refused" : "unexpected_error";
  const error: unknown = result.reason;
  if (!error || typeof error !== "object") return "unexpected_error";
  const own = (object: object, key: string) => Object.getOwnPropertyDescriptor(object, key)?.value as unknown;
  const code = own(error, "code"), meta = own(error, "meta");
  return code === "P2034" || code === "P2010" && !!meta && typeof meta === "object" && own(meta, "code") === "40001" ? "serialization_conflict" : "unexpected_error";
}

async function fixture(harness: Harness) {
  const ctx = harness.context();
  await assertOwnedAnniversaryContext(ctx);
  const suffix = fixtureId(), actor = { organizationId: `legacy-agent-${suffix}`, userId: `legacy-member-${suffix}` };
  // Accepted read_only members could already use this Agent lane. This is not
  // an isolated v2 enrollment or a new owner/admin restriction on legacy users.
  await ctx.db.orgMembership.create({ data: { ...actor, role: "read_only", acceptedAt: await databaseClock(ctx.db) } });
  const reserve = async (reservedCents = 1000) => {
    const result = await reserveAICredits(ctx.db, { organizationId: actor.organizationId, idempotencyKey: `legacy_pg_${fixtureId()}`, reservedCents }, await databaseClock(ctx.db));
    if (!result.ok || result.reused || result.allocationPolicy) throw new Error("owned_legacy_reservation_unavailable");
    return result.reservation;
  };
  const claim = (id: string) => ctx.db.$transaction(tx => claimLegacyAICreditDispatch(tx, actor, id), { isolationLevel: "Serializable", timeout: 30000 });
  return { ctx, actor, reserve, claim };
}

export function legacyAgentAdmissionPostgresCases(harness: Harness): readonly Case[] {
  return [
    { name: "legacy real PG concurrent claim has exactly one winner under Serializable row locking", async run() {
      const f = await fixture(harness), hold = await f.reserve();
      const update = (sql: string) => sql.startsWith('UPDATE "AIUsageReservation" h SET');
      const firstGate = queryGate(update, "after"), secondGate = queryGate(update, "before");
      const first = gatedTransaction(f.ctx.db, firstGate, tx => claimLegacyAICreditDispatch(tx, f.actor, hold.id));
      // Attach rejection handling immediately while gates intentionally hold it.
      const firstResult = Promise.allSettled([first]);
      let secondResult: Promise<PromiseSettledResult<boolean>[]> | undefined;
      try {
        const firstPid = await firstGate.reached;
        const second = gatedTransaction(f.ctx.db, secondGate, tx => claimLegacyAICreditDispatch(tx, f.actor, hold.id));
        secondResult = Promise.allSettled([second]);
        const secondPid = await secondGate.reached;
        expect(secondPid).not.toBe(firstPid);
        secondGate.release();
        await assertBlockedBy(f.ctx.db, secondPid, firstPid);
        firstGate.release();
        const results = [...await firstResult, ...await secondResult].map(legacyClaimOutcome);
        expect(results.filter(value => value === "claimed")).toHaveLength(1);
        expect(results.every(value => ["claimed", "refused", "serialization_conflict"].includes(value))).toBe(true);
        expect(await f.ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({ status: "dispatch_unknown", usageEventId: null });
        expect(await f.claim(hold.id)).toBe(false);
      } finally {
        firstGate.release(); secondGate.release();
        await firstResult; if (secondResult) await secondResult;
      }
    } },
    { name: "legacy real PG expired or unaccepted member holds cannot be claimed", async run() {
      const f = await fixture(harness), expired = await f.reserve(), revoked = await f.reserve();
      await f.ctx.db.$executeRawUnsafe('UPDATE "AIUsageReservation" SET "expiresAt"=(clock_timestamp() AT TIME ZONE \'UTC\')-interval \'1 second\' WHERE id=$1', expired.id);
      expect(await f.claim(expired.id)).toBe(false);
      await f.ctx.db.orgMembership.update({ where: { userId_organizationId: f.actor }, data: { acceptedAt: null } });
      expect(await f.claim(revoked.id)).toBe(false);
      expect(await f.ctx.db.aIUsageReservation.findMany({ where: { id: { in: [expired.id, revoked.id] } } })).toEqual(expect.arrayContaining([expect.objectContaining({ id: expired.id, status: "reserved", usageEventId: null }), expect.objectContaining({ id: revoked.id, status: "reserved", usageEventId: null })]));
    } },
    { name: "legacy real PG revocation committed before the membership lock cannot authorize dispatch", async run() {
      const f = await fixture(harness), hold = await f.reserve();
      const gate = queryGate(sql => sql.startsWith('SELECT "userId","organizationId","acceptedAt" FROM "OrgMembership"'), "before");
      const result = Promise.allSettled([gatedTransaction(f.ctx.db, gate, tx => claimLegacyAICreditDispatch(tx, f.actor, hold.id))]);
      try {
        await gate.reached;
        await f.ctx.db.orgMembership.update({ where: { userId_organizationId: f.actor }, data: { acceptedAt: null } });
        gate.release();
        expect(["refused", "serialization_conflict"]).toContain(legacyClaimOutcome((await result)[0]));
        expect(await f.ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({ status: "reserved", usageEventId: null });
      } finally { gate.release(); await result; }
    } },
    { name: "legacy real PG claimed hold remains capacity and cannot release after database-clock expiry", async run() {
      const f = await fixture(harness), hold = await f.reserve(2500);
      // Shorten ONLY this owned synthetic hold before claim so the actual DB
      // clock crosses its TTL within the existing bounded fixture wait helper.
      const expiresAt = new Date((await databaseClock(f.ctx.db)).getTime() + 3000);
      await f.ctx.db.aIUsageReservation.update({ where: { id: hold.id }, data: { expiresAt } });
      expect(await f.claim(hold.id)).toBe(true);
      await waitForDatabaseTime(f.ctx.db, expiresAt, 5000);
      expect(await releaseAICreditReservation(f.ctx.db, f.actor.organizationId, hold.id)).toBe(false);
      expect(await reserveAICredits(f.ctx.db, { organizationId: f.actor.organizationId, idempotencyKey: `legacy_pg_${fixtureId()}`, reservedCents: 1 }, await databaseClock(f.ctx.db))).toEqual({ ok: false, error: "ai_credit_pool_exhausted" });
      expect(await f.ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({ status: "dispatch_unknown", usageEventId: null, releasedAt: null });
    } },
    { name: "legacy real PG admitted synthetic generation links exactly one fresh pending event", async run() {
      const f = await fixture(harness), correlationId = `legacy-envelope-${fixtureId()}`;
      const admission = await admitGovernedExtract({ ...f.actor, correlationId });
      const authority = consumeGovernedExtractAdmission(admission, { organizationId: f.actor.organizationId, correlationId });
      const generation = `synthetic-legacy-${fixtureId()}`;
      await authority.record({ provider: "vercel_gateway", model: "synthetic/model", gatewayGenerationId: generation, usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 } });
      const events = await f.ctx.db.usageEvent.findMany({ where: { organizationId: f.actor.organizationId } });
      expect(events).toEqual([expect.objectContaining({ externalUsageId: generation, triggeredBy: f.actor.userId, correlationId, provider: "vercel_gateway", model: "synthetic/model", billingStatus: "pending", billedCents: 0 })]);
      expect(await f.ctx.db.aIUsageReservation.findMany({ where: { organizationId: f.actor.organizationId } })).toEqual([expect.objectContaining({ status: "pending_settlement", usageEventId: events[0].id })]);
      await expect(authority.record({ provider: "vercel_gateway", model: "synthetic/model", gatewayGenerationId: generation, usage: { promptTokens: 2, completionTokens: 3 } })).rejects.toThrow();
      expect(await f.ctx.db.usageEvent.count({ where: { externalUsageId: generation } })).toBe(1);
    } },
    { name: "legacy real PG hold-link failure rolls back fresh usage and keeps uncertain dispatch", async run() {
      const f = await fixture(harness), correlationId = `legacy-rollback-${fixtureId()}`;
      const admission = await admitGovernedExtract({ ...f.actor, correlationId });
      const authority = consumeGovernedExtractAdmission(admission, { organizationId: f.actor.organizationId, correlationId });
      const hold = await f.ctx.db.aIUsageReservation.findFirstOrThrow({ where: { organizationId: f.actor.organizationId } });
      const name = `fail_legacy_link_${fixtureId()}`, generation = `synthetic-rollback-${fixtureId()}`;
      if (!/^[a-z0-9]+$/i.test(hold.id)) throw new Error("owned_legacy_hold_id_invalid");
      let functionCreated = false, triggerCreated = false;
      try {
        await f.ctx.db.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=TG_ARGV[0] AND NEW.status='pending_settlement' THEN RAISE EXCEPTION 'owned_legacy_link_failure'; END IF; RETURN NEW; END $$`); functionCreated = true;
        await f.ctx.db.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE UPDATE ON "AIUsageReservation" FOR EACH ROW EXECUTE FUNCTION ${name}('${hold.id}')`); triggerCreated = true;
        await expect(authority.record({ provider: "vercel_gateway", model: "synthetic/model", gatewayGenerationId: generation, usage: { promptTokens: 2, completionTokens: 3 } })).rejects.toThrow();
        expect(await f.ctx.db.usageEvent.count({ where: { externalUsageId: generation } })).toBe(0);
        expect(await f.ctx.db.aIUsageReservation.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({ status: "dispatch_unknown", usageEventId: null });
        expect(await releaseAICreditReservation(f.ctx.db, f.actor.organizationId, hold.id)).toBe(false);
      } finally {
        if (triggerCreated) await f.ctx.db.$executeRawUnsafe(`DROP TRIGGER ${name} ON "AIUsageReservation"`);
        if (functionCreated) await f.ctx.db.$executeRawUnsafe(`DROP FUNCTION ${name}()`);
      }
    } },
  ];
}

export function registerLegacyAgentAdmissionAcceptance(harness: Harness): void {
  for (const test of legacyAgentAdmissionPostgresCases(harness)) it(test.name, test.run, 30000);
}

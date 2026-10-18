/** Actual owned Next HTTP checks. Provider/consumer setup is explicitly parent
 * synthetic IO, never an HTTP webhook, hosted charge or external API call. */
import { hash } from "bcryptjs";
import { expect } from "vitest";
import { deriveWorkspaceIdFromEmail } from "../../../auth/workspaceId";
import { anniversaryFixture, assertOwnedAnniversaryContext, fixtureId, type OwnedAnniversaryContext } from "./newTestAnniversaryFixture";
export async function prepareAnniversaryHttp(ctx: OwnedAnniversaryContext) {
  await assertOwnedAnniversaryContext(ctx);
  const email = `v2-http-${fixtureId()}@example.invalid`, password = fixtureId();
  const user = await ctx.db.user.create({ data: { email, passwordHash: await hash(password, 4), emailVerifiedAt: new Date(), plan: null } });
  const fixture = await anniversaryFixture(ctx, { org: String(deriveWorkspaceIdFromEmail(email)), userId: user.id, email });
  await ctx.db.organizationAIProviderPolicy.create({ data: { organizationId: fixture.actor.organizationId, enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "openai/gpt-4o-mini" }, fallbackOrder: ["vercel_gateway"], updatedBy: user.id } });
  return { ctx, fixture, email, password };
}
export async function exerciseAnniversaryHttp(input: Awaited<ReturnType<typeof prepareAnniversaryHttp>>, base: string) {
  const { ctx: { db }, fixture: f, email, password } = input, org = f.actor.organizationId, jar = new Map<string, string>();
  const http = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(base + path, { ...init, redirect: "manual", headers: { ...Object.fromEntries(new Headers(init.headers)), cookie: [...jar.values()].join("; ") } });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0]; jar.set(pair.slice(0, pair.indexOf("=")), pair); } return response;
  };
  const page = async () => { const response = await http("/control/usage-billing"); expect(response.status).toBe(200); return (await response.text()).replace(/<!--[\s\S]*?-->/g, ""); };
  const deniedGeneration = (key: string) => http("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, origin: base }, body: JSON.stringify({ prompt: "Owned V2 admission; provider must stay disabled" }) });
  const csrf = await (await http("/api/auth/csrf")).json();
  expect((await http("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: base }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/control/usage-billing`, json: "true" }) })).status).toBe(200);
  expect((await (await http("/api/auth/session")).json()).user.email).toBe(email);
  expect(await page()).toContain("$2.00 current account allowance");
  const deniedKey = `v2-provider-denied-${fixtureId()}`;
  expect((await deniedGeneration(deniedKey)).status).toBeGreaterThanOrEqual(400);
  // Denial occurs before durable dispatch. This proves no provider dispatch,
  // not successful AI generation. Existing preclaim release remains valid.
  expect(await db.aIUsageReservation.findUnique({ where: { organizationId_idempotencyKey: { organizationId: org, idempotencyKey: deniedKey } } })).toMatchObject({ status: "released", usageEventId: null, reservedCents: 100 });
  expect(await db.usageEvent.count({ where: { organizationId: org } })).toBe(0);
  await f.exhaustFree(); await f.purchase();
  const old = await f.reserve(100); expect(await f.claim(old.id)).toBe(true);
  const original = await db.$queryRawUnsafe('SELECT body FROM "NewTestReservationAttribution" WHERE "reservationId"=$1', old.id);
  expect(await f.activate()).toBe("applied");
  let html = await page(); expect(html).toContain("$35.00 current account allowance"); expect(html).toContain("$34.00");
  await f.direct(old.id, 80);
  expect(await db.$queryRawUnsafe('SELECT body FROM "NewTestReservationAttribution" WHERE "reservationId"=$1', old.id)).toEqual(original);
  html = await page(); expect(html).toContain("$34.20"); expect(html).toContain("$35.00 current account allowance");
  const before = await f.financial(); await f.unavailable(); expect(await page()).toContain("Unavailable");
  const unavailableKey = `v2-unavailable-${fixtureId()}`; expect((await deniedGeneration(unavailableKey)).status).toBeGreaterThanOrEqual(400);
  expect(await db.aIUsageReservation.count({ where: { organizationId: org, idempotencyKey: unavailableKey } })).toBe(0);
  expect(await f.financial()).toEqual(before);
  await f.recover(); expect(await page()).toContain("$34.20");
  const reserved = await f.reserve(1000); await f.inactive(); const beforeClaim = await f.financial();
  expect(await f.claim(reserved.id)).toBe(false); expect(await f.financial()).toEqual(beforeClaim);
  // Earlier Free200 remains spent; paid hold remains historical, purchase420
  // remains spendable under its original permanent terms, never regranted.
  html = await page(); expect(html).toContain("$4.20");
  expect(await db.addOnPurchase.findMany({ where: { organizationId: org } })).toEqual([expect.objectContaining({ deliveredAICreditsCents: 500, reversedAICreditsCents: 0 })]);
  expect((await http("/api/billing/checkout-session", { method: "POST" })).status).toBe(503);
  expect((await http("/api/billing/stripe-webhook", { method: "POST" })).status).toBe(503);
  expect((await http("/api/cron/settle-ai-usage", { method: "POST" })).status).toBe(503);
}

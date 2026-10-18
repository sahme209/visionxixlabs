/** Future opt-in actual HTTP rehearsal. All remote Stripe replies remain
 * SYNTHETIC in the separate worker; no hosted payment/provider IO is claimed. */
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { hash } from "bcryptjs";
import Stripe from "stripe";
import { expect } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { deriveWorkspaceIdFromEmail } from "../../../auth/workspaceId";
import { enrollFixtureAllowanceV2 } from "../../newTestSubscription/fixtureAllocation";
import type { Intent } from "../../newTestSubscription/service";
import { startOwnedCheckoutWorker, type OwnedWorkerReview } from "./ownedCheckoutWorkerSupervisor";
import { ownedSyntheticWebhookSecret } from "./ownedCheckoutSyntheticProvider";
import { ownedCheckoutLaunchPolicy } from "./ownedCheckoutLaunchPolicy";
import { cleanupOwnedCheckout, ownedCheckoutChild, ownedCheckoutControl } from "./ownedCheckoutProcess";
import { newTestChildEnvironment, newTestPrismaEnvironment } from "./newTestChildEnvironment";
export async function exerciseOwnedCheckoutHttp(input: { db: PrismaClient; url: string; runtime: string }) {
  const policy = ownedCheckoutLaunchPolicy(process.env, process.execArgv);
  newTestPrismaEnvironment(process.env, process.execArgv, input.url);
  const control = ownedCheckoutControl(150000);
  let temporary: string | undefined, worker: Awaited<ReturnType<typeof startOwnedCheckoutWorker>> | undefined, next: ReturnType<typeof ownedCheckoutChild> | undefined, phase = "fixture_setup";
  const observations: Array<{ stage: string; status: number }> = [];
  try { return await control.run(async () => {
  const suffix = randomBytes(10).toString("hex"), email = `owned-checkout-${suffix}@example.invalid`, password = randomBytes(24).toString("hex");
  const passwordHash = await control.run(() => hash(password, 4));
  const user = await control.run(() => input.db.user.create({ data: { email, passwordHash, emailVerifiedAt: new Date(), plan: null } })), organizationId = String(deriveWorkspaceIdFromEmail(email));
  control.check();
  for (const userId of [user.id, `owned-member2-${suffix}`, `owned-member3-${suffix}`]) await control.run(() => input.db.orgMembership.create({ data: { organizationId, userId, role: userId === user.id ? "owner" : "read_only", acceptedAt: new Date() } }));
  control.check();
  await input.db.$transaction(tx => enrollFixtureAllowanceV2(tx, { runtimeId: input.runtime, accountId: "acct-test", organizationId }), { isolationLevel: "Serializable" });
  control.check();
  const reserve = createServer(); try { await control.run(() => new Promise<void>((resolve, reject) => { reserve.once("error", () => reject(new Error("owned_checkout_port_unavailable"))); reserve.listen(0, "127.0.0.1", resolve); })); } catch (error) { reserve.close(); throw error; } const address = reserve.address(); if (!address || typeof address === "string") throw new Error("owned_checkout_port_unavailable"); const port = address.port; await new Promise<void>(resolve => reserve.close(() => resolve()));
  control.check(); const origin = `http://127.0.0.1:${port}`; temporary = mkdtempSync(resolve(tmpdir(), "axiom-checkout-font-")); const fonts = resolve(temporary, "fonts.cjs");
  writeFileSync(fonts, 'module.exports = new Proxy({}, { get: () => "@font-face { font-family: Isolated; src: url(https://synthetic.invalid/font.woff2); }" });');
  phase = "worker_source_binding"; control.check();
    const reviewed = JSON.parse(readFileSync(resolve("docs/mission/owned-checkout-worker-source.json"), "utf8")) as OwnedWorkerReview;
    worker = await startOwnedCheckoutWorker({ db: input.db, databaseUrl: input.url, runtimeId: input.runtime, organizationId, origin, reviewed, control });
    phase = "next_start";
    const env = { ...policy.env, ...newTestChildEnvironment(process.env, process.execArgv, { databaseUrl: input.url, appOrigin: origin, fontResponses: fonts, runtimeId: input.runtime, accountId: "acct-test", organizationId, authSecret: randomBytes(32).toString("hex") }), ...worker.bridgeEnv, ...(policy.env.NODE_PATH === undefined ? {} : { NODE_PATH: policy.env.NODE_PATH }) };
    policy.revalidate(process.env); policy.revalidate(env, "child"); control.check();
    next = ownedCheckoutChild("next", temporary!, () => spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env, detached: true, stdio: "pipe" }), control);
    await control.run(() => next!.ready); const nextChild = next.child; if (!nextChild) throw new Error("owned_checkout_next_unavailable");
    let outputBytes = 0; const discard = (chunk: Buffer) => { outputBytes += chunk.byteLength; if (outputBytes > 4194304) control.cancel(new Error("owned_checkout_next_output_limit")); };
    nextChild.stdout?.on("data", discard); nextChild.stderr?.on("data", discard);
    const jar = new Map<string, string>();
    const http = async (path: string, init: RequestInit = {}) => control.run(async () => { const r = await fetch(origin + path, { ...init, redirect: "manual", signal: AbortSignal.any([control.signal, AbortSignal.timeout(45000)]), headers: { ...Object.fromEntries(new Headers(init.headers)), cookie: [...jar.values()].join("; ") } }); for (const raw of r.headers.getSetCookie()) { const pair = raw.split(";")[0]; jar.set(pair.slice(0, pair.indexOf("=")), pair); } observations.push({ stage: phase, status: r.status }); return r; });
    for (let tries = 0; ; tries++) { try { if ((await http("/api/auth/csrf")).ok) break; } catch { /* bounded owned start only */ } control.check(); if (tries >= 120 || nextChild.exitCode !== null) throw new Error("not_ready"); await control.run(() => new Promise(resolve => setTimeout(resolve, 250))); }
    phase = "authentication"; const csrf = await (await http("/api/auth/csrf")).json();
    expect((await http("/api/auth/callback/credentials", { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, callbackUrl: origin + "/plans?plan=pro&interval=monthly", json: "true" }) })).status).toBe(200);
    phase = "pricing"; const plans = await http("/plans?plan=pro&interval=monthly"); expect(plans.status).toBe(200); const html = await plans.text(); expect(html.includes("Owned TEST checkout rehearsal")).toBe(true); expect(html.includes("Choose Pro")).toBe(true);
    expect(await input.db.$queryRawUnsafe('SELECT id FROM "RecurringSubscriptionIntent" WHERE org=$1', organizationId)).toEqual([]);
    phase = "free_read"; expect((await (await http("/control/usage-billing")).text()).includes("$2.00")).toBe(true);
    const body = { planId: "pro", billingInterval: "monthly", expectedOrganizationId: organizationId, clientIntentKey: `owned_purchase_${suffix}` }, post = (value = body) => http("/api/billing/checkout-session", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value) });
    phase = "stale_workspace"; expect((await post({ ...body, expectedOrganizationId: "foreign" })).status).toBe(400);
    phase = "checkout"; const checkout = await post(); expect(checkout.status).toBe(200); expect((await checkout.json()).data.url).toBe("https://checkout.stripe.com/synthetic-owned-http-only");
    const [saved] = await input.db.$queryRawUnsafe<Array<{ body: Intent }>>('SELECT body FROM "RecurringSubscriptionIntent" WHERE org=$1', organizationId); expect(saved.body.state).toBe("session_confirmed"); expect(saved.body.originalCreateProof?.requestId.startsWith("req_synthetic_owned_")).toBe(true);
    phase = "refreshed_status"; expect((await (await http("/plans?plan=pro&interval=monthly")).text()).includes("An existing checkout requires reconciliation")).toBe(true);
    phase = "confirmed_repeat"; expect((await post()).status).toBe(409); expect((await input.db.$queryRawUnsafe<Array<{ n: number }>>('SELECT count(*)::int AS n FROM "RecurringSubscriptionIntent" WHERE org=$1', organizationId))[0].n).toBe(1);
    phase = "before_collection"; expect((await (await http("/control/usage-billing?billing=success")).text()).includes("$2.00")).toBe(true);
    const raw = JSON.stringify({ id: `evt_owned_http_${suffix}`, type: "checkout.session.completed", livemode: false, data: { object: { id: saved.body.sessionId, metadata: { intentId: saved.body.id } } } });
    const sdk = new Stripe("sk_test_synthetic_parent_signature_only"), signature = sdk.webhooks.generateTestHeaderString({ payload: raw, secret: ownedSyntheticWebhookSecret });
    const deliver = (signed: string) => http("/api/billing/stripe-webhook", { method: "POST", headers: { "stripe-signature": signed }, body: raw });
    phase = "invalid_signature"; expect((await deliver("invalid-synthetic-signature")).status).toBe(401); expect(await input.db.stripeBillingEvent.findUnique({ where: { id: `evt_owned_http_${suffix}` } })).toBeNull();
    phase = "signed_webhook"; expect((await deliver(signature)).status).toBe(200);
    phase = "paid_read"; expect((await (await http("/control/usage-billing")).text()).includes("$30.00")).toBe(true);
    const [before] = await input.db.$queryRawUnsafe<Array<{ body: unknown }>>('SELECT body FROM "RecurringSubscriptionIntent" WHERE org=$1', organizationId);
    phase = "fresh_replay"; expect((await deliver(signature)).status).toBe(200); expect((await input.db.$queryRawUnsafe<Array<{ body: unknown }>>('SELECT body FROM "RecurringSubscriptionIntent" WHERE org=$1', organizationId))[0].body).toEqual(before.body);
    phase = "unsupported_entrypoints"; expect((await http("/api/support/checkout-session", { method: "POST" })).status).toBe(503); expect((await http("/api/cron/settle-ai-usage", { method: "POST" })).status).toBe(503);
    return { observations, workerOutputDigest: worker.outputDigest, workerBuildReceipt: worker.buildReceipt, syntheticProviderOnly: true, actualHostedPayment: false };
  }); } catch { throw new Error(`owned_checkout_http_${phase}_failed`); }
  finally {
    control.cancel(new Error("owned_checkout_rehearsal_complete"));
    try { await cleanupOwnedCheckout([
      async () => { await next?.stop(); if (temporary) rmSync(temporary, { recursive: true, force: true }); },
      async () => { await worker?.stop(); },
    ]); } finally { control.dispose(); }
  }
}
/** Existing owned28 metadata only; emit through the already-private runner log.
 * Root fields are selected explicitly, never request/cookie/error/environment data. */
export function ownedCheckoutEvidenceLine(result: Awaited<ReturnType<typeof exerciseOwnedCheckoutHttp>>): string {
  try {
    const json = JSON.stringify({ observations: result.observations, workerOutputDigest: result.workerOutputDigest, workerBuildReceipt: result.workerBuildReceipt, syntheticProviderOnly: result.syntheticProviderOnly, actualHostedPayment: result.actualHostedPayment });
    if (Buffer.byteLength(json, "utf8") > 262144) throw new Error("limit");
    return "AXIOM_OWNED_CHECKOUT_RECEIPT_V1 " + json;
  } catch { throw new Error("owned_checkout_evidence_unavailable"); }
}

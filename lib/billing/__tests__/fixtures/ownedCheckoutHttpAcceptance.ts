/** Future opt-in actual HTTP rehearsal. All remote Stripe replies remain
 * SYNTHETIC in the separate worker; no hosted payment/provider IO is claimed. */
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
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
import { newTestChildEnvironment, newTestPrismaEnvironment } from "./newTestChildEnvironment";
async function stopNext(child: ChildProcess | undefined) {
  if (!child?.pid) return;
  const exited = new Promise<void>(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once("exit", () => resolve()); });
  try { process.kill(-child.pid, "SIGTERM"); } catch { /* already exited */ }
  const kill = setTimeout(() => { try { process.kill(-child.pid!, "SIGKILL"); } catch { /* exact owned group only */ } }, 3000);
  await exited; clearTimeout(kill);
}
export async function exerciseOwnedCheckoutHttp(input: { db: PrismaClient; url: string; runtime: string }) {
  newTestPrismaEnvironment(process.env, process.execArgv, input.url);
  const suffix = randomBytes(10).toString("hex"), email = `owned-checkout-${suffix}@example.invalid`, password = randomBytes(24).toString("hex");
  const user = await input.db.user.create({ data: { email, passwordHash: await hash(password, 4), emailVerifiedAt: new Date(), plan: null } }), organizationId = String(deriveWorkspaceIdFromEmail(email));
  for (const userId of [user.id, `owned-member2-${suffix}`, `owned-member3-${suffix}`]) await input.db.orgMembership.create({ data: { organizationId, userId, role: userId === user.id ? "owner" : "read_only", acceptedAt: new Date() } });
  await input.db.$transaction(tx => enrollFixtureAllowanceV2(tx, { runtimeId: input.runtime, accountId: "acct-test", organizationId }), { isolationLevel: "Serializable" });
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, "127.0.0.1", resolve)); const address = reserve.address(); if (!address || typeof address === "string") throw new Error("owned_checkout_port_unavailable"); const port = address.port; await new Promise<void>(resolve => reserve.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`, temporary = mkdtempSync(resolve(tmpdir(), "axiom-checkout-font-")), fonts = resolve(temporary, "fonts.cjs");
  writeFileSync(fonts, 'module.exports = new Proxy({}, { get: () => "@font-face { font-family: Isolated; src: url(https://synthetic.invalid/font.woff2); }" });');
  let worker: Awaited<ReturnType<typeof startOwnedCheckoutWorker>> | undefined, next: ChildProcess | undefined, phase = "worker_source_binding";
  const observations: Array<{ stage: string; status: number }> = [];
  try {
    const reviewed = JSON.parse(readFileSync(resolve("docs/mission/owned-checkout-worker-source.json"), "utf8")) as OwnedWorkerReview;
    worker = await startOwnedCheckoutWorker({ db: input.db, databaseUrl: input.url, runtimeId: input.runtime, organizationId, origin, reviewed });
    phase = "next_start";
    const env = { ...newTestChildEnvironment(process.env, process.execArgv, { databaseUrl: input.url, appOrigin: origin, fontResponses: fonts, runtimeId: input.runtime, accountId: "acct-test", organizationId, authSecret: randomBytes(32).toString("hex") }), ...worker.bridgeEnv };
    next = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env, detached: true, stdio: "pipe" });
    let outputBytes = 0; const discard = (chunk: Buffer) => { outputBytes += chunk.byteLength; if (outputBytes > 4194304 && next?.pid) { try { process.kill(-next.pid, "SIGKILL"); } catch { /* exact owned group */ } } };
    next.stdout?.on("data", discard); next.stderr?.on("data", discard);
    const jar = new Map<string, string>();
    const http = async (path: string, init: RequestInit = {}) => { const r = await fetch(origin + path, { ...init, redirect: "manual", signal: AbortSignal.timeout(100000), headers: { ...Object.fromEntries(new Headers(init.headers)), cookie: [...jar.values()].join("; ") } }); for (const raw of r.headers.getSetCookie()) { const pair = raw.split(";")[0]; jar.set(pair.slice(0, pair.indexOf("=")), pair); } observations.push({ stage: phase, status: r.status }); return r; };
    for (let tries = 0; ; tries++) { try { if ((await http("/api/auth/csrf")).ok) break; } catch { /* bounded owned start only */ } if (tries >= 120 || next.exitCode !== null) throw new Error("not_ready"); await new Promise(resolve => setTimeout(resolve, 250)); }
    phase = "authentication"; const csrf = await (await http("/api/auth/csrf")).json();
    expect((await http("/api/auth/callback/credentials", { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, callbackUrl: origin + "/plans?plan=pro&interval=monthly", json: "true" }) })).status).toBe(200);
    phase = "pricing"; const plans = await http("/plans?plan=pro&interval=monthly"); expect(plans.status).toBe(200); const html = await plans.text(); expect(html.includes("Owned TEST checkout rehearsal")).toBe(true); expect(html.includes("Choose Pro")).toBe(true);
    expect(await input.db.$queryRawUnsafe('SELECT id FROM "RecurringSubscriptionIntent" WHERE org=$1', organizationId)).toEqual([]);
    phase = "free_read"; expect((await (await http("/control/usage-billing")).text()).includes("$2.00")).toBe(true);
    const body = { planId: "pro", billingInterval: "monthly", expectedOrganizationId: organizationId, clientIntentKey: `owned_purchase_${suffix}` }, post = (value = body) => http("/api/billing/checkout-session", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value) });
    phase = "stale_workspace"; expect((await post({ ...body, expectedOrganizationId: "foreign" })).status).toBe(400);
    phase = "checkout"; const checkout = await post(); expect(checkout.status).toBe(200); expect((await checkout.json()).data.url).toBe("https://checkout.stripe.com/synthetic-owned-http-only");
    const [saved] = await input.db.$queryRawUnsafe<Array<{ body: Intent }>>('SELECT body FROM "RecurringSubscriptionIntent" WHERE org=$1', organizationId); expect(saved.body.state).toBe("session_confirmed"); expect(saved.body.originalCreateProof?.requestId.startsWith("req_synthetic_owned_")).toBe(true);
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
  } catch { throw new Error(`owned_checkout_http_${phase}_failed`); }
  finally { await stopNext(next); try { await worker?.stop(); } finally { rmSync(temporary, { recursive: true, force: true }); } }
}

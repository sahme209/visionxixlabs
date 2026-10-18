import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isBillingInterval, isPaidPublicPlanId } from "../publicPlanCatalog";
import { withIsolatedWorkspaceScope } from "../isolatedApplication/scope";
import { ownedCheckoutConfiguration } from "./configuration";
import { requestOwnedCheckout } from "./client";
import { checkoutCommand, record } from "./protocol";
const response = (code: string, status: number) => NextResponse.json({ ok: false, error: { code, userMessage: "Owned TEST checkout could not be confirmed." } }, { status });
// NextRequest canonicalizes loopback127 to localhost. Compare only that exact
// framework alias at the configured port; the browser Origin must still equal
// the supervisor's literal127 origin. No caller-selected public host is added.
function target(req: NextRequest, origin: string) { return req.nextUrl.origin === origin || req.nextUrl.protocol === "http:" && req.nextUrl.hostname === "localhost" && req.nextUrl.port === new URL(origin).port; }
function selected() { return process.env.AXIOM_OWNED_CHECKOUT_BRIDGE !== undefined && process.env.AXIOM_OWNED_CHECKOUT_BRIDGE !== "false"; }
async function rawBytes(req: NextRequest, limit: number): Promise<Buffer> {
  if (req.headers.get("content-length") && (!/^\d+$/.test(req.headers.get("content-length")!) || Number(req.headers.get("content-length")) > limit)) throw new Error("owned_checkout_body_invalid");
  const reader = req.body?.getReader(); if (!reader) throw new Error("owned_checkout_body_invalid");
  let bytes = 0, timedOut = false; const collected = Buffer.alloc(limit);
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 5000);
  try {
    while (true) { const next = await reader.read(); if (timedOut) throw new Error("owned_checkout_body_invalid"); if (next.done) break; const end = bytes + next.value.byteLength; if (end > limit) { void reader.cancel().catch(() => {}); throw new Error("owned_checkout_body_invalid"); } collected.set(next.value, bytes); bytes = end; }
    if (!bytes) throw new Error("owned_checkout_body_invalid");
    const body = collected.subarray(0, bytes); new TextDecoder("utf-8", { fatal: true }).decode(body); return body;
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
export async function ownedCheckoutPost(req: NextRequest): Promise<NextResponse | null> {
  if (!selected()) return null;
  try {
    const config = ownedCheckoutConfiguration(); if (!config) return response("owned_checkout_unavailable", 503);
    if (!target(req, config.origin) || req.headers.get("origin") !== config.origin) return response("owned_checkout_forbidden", 403);
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.userId) return response("auth.required", 401);
    if (String(ctx.organizationId ?? "") !== config.organizationId || !ctx.roles.some(role => role === "owner" || role === "admin")) return response("owned_checkout_forbidden", 403);
    if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return response("owned_checkout_request_invalid", 400);
    const body = record(JSON.parse((await rawBytes(req, 16384)).toString("utf8")));
    if (Object.keys(body).sort().join("|") !== ["billingInterval", "clientIntentKey", "expectedOrganizationId", "planId"].sort().join("|") || typeof body.planId !== "string" || !isPaidPublicPlanId(body.planId) || typeof body.billingInterval !== "string" || !isBillingInterval(body.billingInterval) || body.expectedOrganizationId !== config.organizationId) return response("owned_checkout_request_invalid", 400);
    const command = checkoutCommand({ kind: "checkout", userId: String(ctx.userId), organizationId: config.organizationId, clientIntentKey: body.clientIntentKey, planId: body.planId, interval: body.billingInterval }, config);
    const result = await withIsolatedWorkspaceScope(ctx, "admission", () => requestOwnedCheckout(command));
    if (result.kind === "checkout_ready") return NextResponse.json({ ok: true, data: { ok: true, url: result.url } });
    return response(result.kind === "forbidden" ? "owned_checkout_forbidden" : result.kind === "reconciliation_required" ? "owned_checkout_reconciliation_required" : "owned_checkout_unavailable", result.kind === "forbidden" ? 403 : result.kind === "reconciliation_required" ? 409 : 503);
  } catch { return response("owned_checkout_unavailable", 503); }
}
export async function ownedWebhookPost(req: NextRequest): Promise<NextResponse | null> {
  if (!selected()) return null;
  try {
    const config = ownedCheckoutConfiguration(); if (!config || !target(req, config.origin)) return response("owned_checkout_unavailable", 503);
    const signature = req.headers.get("stripe-signature");
    if (!signature || Buffer.byteLength(signature) > 4096) return response("stripe.signature_invalid", 401);
    const body = await rawBytes(req, 262144);
    const result = await requestOwnedCheckout({ kind: "reconcile", body: body.toString("base64"), signature });
    if (result.kind === "reconciled") return NextResponse.json({ ok: true, outcome: result.outcome });
    if (result.kind === "invalid_signature") return response("stripe.signature_invalid", 401);
    return response("owned_checkout_verification_unavailable", 503);
  } catch { return response("owned_checkout_verification_unavailable", 503); }
}
export async function ownedPlansBinding(): Promise<{ organizationId: string } | null> {
  try { const config = ownedCheckoutConfiguration(); return config && (await requestOwnedCheckout({ kind: "hello" })).kind === "ready" ? { organizationId: config.organizationId } : null; } catch { return null; }
}

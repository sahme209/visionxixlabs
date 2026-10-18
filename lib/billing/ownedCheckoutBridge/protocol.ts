import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const OWNED_CHECKOUT_VERSION = "axiom_owned_checkout_v1" as const;
export type Manifest = Readonly<{ version: typeof OWNED_CHECKOUT_VERSION; session: string; runtimeId: string; accountId: string; organizationId: string; origin: string; directory: string; capability: string }>;
export type CheckoutCommand = { kind: "checkout"; userId: string; organizationId: string; clientIntentKey: string; planId: "pro" | "enterprise"; interval: "monthly" | "annual" };
export type WebhookCommand = { kind: "reconcile"; body: string; signature: string };
export type Command = CheckoutCommand | WebhookCommand | { kind: "hello" } | { kind: "status"; userId: string; organizationId: string };
export type Result = { kind: "ready" } | { kind: "checkout_ready"; url: string } | { kind: "reconciled"; outcome: "applied" | "replay" | "unavailable" } | { kind: "intent_state"; state: "none" | "prepared" | "attempted" | "unknown" | "session_confirmed" | "bound" | "terminal_verified" } | { kind: "unavailable" | "busy" | "forbidden" | "invalid_signature" | "invalid_request" | "reconciliation_required" };
const maxFrame = 393216;
function invalid(): never { throw new Error("owned_checkout_channel_invalid"); }
export function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) invalid(); return value as Record<string, unknown>; }
function keys(value: Record<string, unknown>, expected: string[]) { if (Object.keys(value).sort().join("|") !== expected.sort().join("|")) invalid(); }
function identifier(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_:@.-]{1,200}$/.test(value); }
export function checkoutCommand(value: unknown, manifest: Manifest): CheckoutCommand {
  const c = record(value); keys(c, ["kind", "userId", "organizationId", "clientIntentKey", "planId", "interval"]);
  if (c.kind !== "checkout" || !identifier(c.userId) || c.organizationId !== manifest.organizationId || typeof c.clientIntentKey !== "string" || !/^[A-Za-z0-9_-]{16,200}$/.test(c.clientIntentKey) || !["pro", "enterprise"].includes(String(c.planId)) || !["monthly", "annual"].includes(String(c.interval)) || Buffer.byteLength(JSON.stringify(c)) > 16384) invalid();
  return c as CheckoutCommand;
}
export function webhookCommand(value: unknown): WebhookCommand {
  const c = record(value); keys(c, ["kind", "body", "signature"]);
  if (c.kind !== "reconcile" || typeof c.body !== "string" || !c.body.length || c.body.length > 349528 || typeof c.signature !== "string" || !c.signature.length || Buffer.byteLength(c.signature) > 4096) invalid();
  const bytes = Buffer.from(c.body, "base64");
  if (!bytes.length || bytes.length > 262144 || bytes.toString("base64") !== c.body) invalid();
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { invalid(); }
  return c as WebhookCommand;
}
export function bridgeCommand(value: unknown, manifest: Manifest): Command {
  const c = record(value);
  if (c.kind === "checkout") return checkoutCommand(c, manifest);
  if (c.kind === "reconcile") return webhookCommand(c);
  if (c.kind === "hello") { keys(c, ["kind"]); return { kind: "hello" }; }
  if (c.kind === "status") { keys(c, ["kind", "userId", "organizationId"]); if (!identifier(c.userId) || c.organizationId !== manifest.organizationId) invalid(); return c as Extract<Command, {kind:"status"}>; }
  return invalid();
}
export function bridgeResult(value: unknown): Result {
  const r = record(value);
  if (r.kind === "checkout_ready") {
    keys(r, ["kind", "url"]);
    if (typeof r.url !== "string" || r.url.length > 4096) invalid();
    const url = new URL(r.url); if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.port || url.username || url.password || url.hash) invalid();
  } else if (r.kind === "reconciled") { keys(r, ["kind", "outcome"]); if (!["applied", "replay", "unavailable"].includes(String(r.outcome))) invalid(); }
  else if (r.kind === "intent_state") { keys(r, ["kind", "state"]); if (!["none", "prepared", "attempted", "unknown", "session_confirmed", "bound", "terminal_verified"].includes(String(r.state))) invalid(); }
  else { keys(r, ["kind"]); if (!["ready", "unavailable", "busy", "forbidden", "invalid_signature", "invalid_request", "reconciliation_required"].includes(String(r.kind))) invalid(); }
  if (Buffer.byteLength(JSON.stringify(r)) > 8192) invalid();
  return r as Result;
}
function binding(m: Manifest) { return [m.version, m.session, m.runtimeId, m.accountId, m.organizationId, m.origin, m.directory].join("\n"); }
export const commandDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function sealFrame(manifest: Manifest, direction: "request" | "response", sequence: number, id: string, body: unknown): Buffer {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || !/^[a-f0-9]{32}$/.test(id) || !/^[a-f0-9]{64}$/.test(manifest.capability)) invalid();
  const core = { version: manifest.version, session: manifest.session, direction, sequence, id, body };
  const mac = createHmac("sha256", Buffer.from(manifest.capability, "hex")).update(binding(manifest) + "\n" + JSON.stringify(core)).digest("hex");
  const bytes = Buffer.from(JSON.stringify({ ...core, mac })); if (bytes.length > maxFrame) invalid(); return bytes;
}
export function openFrame(manifest: Manifest, direction: "request" | "response", sequence: number, bytes: Buffer): { id: string; body: unknown } {
  if (!bytes.length || bytes.length > maxFrame) invalid();
  let decoded: unknown; try { decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { invalid(); }
  const v = record(decoded); keys(v, ["version", "session", "direction", "sequence", "id", "body", "mac"]);
  if (v.version !== manifest.version || v.session !== manifest.session || v.direction !== direction || v.sequence !== sequence || typeof v.id !== "string" || !/^[a-f0-9]{32}$/.test(v.id) || typeof v.mac !== "string" || !/^[a-f0-9]{64}$/.test(v.mac)) invalid();
  const expected = JSON.parse(sealFrame(manifest, direction, sequence, v.id, v.body).toString("utf8")) as { mac: string };
  if (!timingSafeEqual(Buffer.from(expected.mac, "hex"), Buffer.from(v.mac, "hex"))) invalid();
  return { id: v.id, body: v.body };
}
export function packFrame(bytes: Buffer): Buffer { if (!bytes.length || bytes.length > maxFrame) invalid(); const prefix = Buffer.alloc(4); prefix.writeUInt32BE(bytes.length); return Buffer.concat([prefix, bytes]); }
export function frameReader(deliver: (frame: Buffer) => void) {
  const prefix = Buffer.alloc(4); let prefixBytes = 0, body: Buffer | null = null, bodyBytes = 0, closed = false;
  return {
    push(bytes: Buffer) {
      if (closed) invalid(); let offset = 0;
      while (offset < bytes.length) {
        if (!body) {
          const take = Math.min(4 - prefixBytes, bytes.length - offset); bytes.copy(prefix, prefixBytes, offset, offset + take); prefixBytes += take; offset += take;
          if (prefixBytes < 4) continue;
          const length = prefix.readUInt32BE(); if (!length || length > maxFrame) { closed = true; invalid(); }
          body = Buffer.alloc(length); bodyBytes = 0;
        }
        const take = Math.min(body.length - bodyBytes, bytes.length - offset); bytes.copy(body, bodyBytes, offset, offset + take); bodyBytes += take; offset += take;
        if (bodyBytes === body.length) { const complete = body; body = null; prefixBytes = 0; bodyBytes = 0; try { deliver(complete); } catch (error) { closed = true; throw error; } }
      }
    },
    end() { closed = true; if (prefixBytes || body) invalid(); },
  };
}

/**
 * On-prem agent tokens — Phase 642.
 *
 * HMAC-signed token a customer-hosted on-prem agent uses to push
 * scan findings to /api/agents/inbound. Each token is bound to a
 * specific (organizationId, connectorSlug) pair so a compromised
 * agent can only write into its own connector.
 *
 * Why the customer needs an agent at all:
 *   · Vercel cron runs on the public internet and cannot reach
 *     a customer's on-prem vCenter / OpenShift / VMM behind their
 *     firewall.
 *   · The customer runs a small agent (Python / PowerShell — we
 *     publish the shape) inside their network. The agent uses
 *     their existing vSphere SDK / OpenShift kubectl / VMM
 *     PowerShell cmdlets, then HTTPS-pushes findings out to our
 *     inbound endpoint. Outbound-only — no inbound firewall hole.
 *
 * The HMAC pattern matches Phase 634 shareLinks + Phase 639
 * inviteLinks — same primitives, different purpose. Each token
 * has a TTL (default 365 days) so agents are re-keyed annually.
 *
 * Server-only.
 */

import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export interface AgentTokenPayload {
  organizationId: string;
  connectorSlug: string;
  /** Free-form label so the operator can identify which agent
   *  instance owns a given token at revocation time. */
  agentLabel: string;
  expiresAt: number;
  nonce: string;
}

export type AgentTokenError = "malformed" | "bad_signature" | "expired";

export interface AgentTokenValidation {
  ok: boolean;
  payload: AgentTokenPayload | null;
  error: AgentTokenError | null;
}

const DEFAULT_TTL_DAYS = 365;

function getSecret(): string {
  const secret = process.env.AGENT_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("agent_token_secret_missing_or_too_short");
  }
  return secret;
}

function b64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(payload).digest();
  return b64UrlEncode(mac);
}

export function createAgentToken(
  organizationId: string,
  connectorSlug: string,
  agentLabel: string,
  ttlDays = DEFAULT_TTL_DAYS,
): string {
  const expiresAt = Date.now() + Math.max(1, Math.min(730, ttlDays)) * 24 * 60 * 60 * 1000;
  const nonce = b64UrlEncode(randomBytes(12));
  const payload: AgentTokenPayload = {
    organizationId,
    connectorSlug,
    agentLabel: agentLabel.slice(0, 120),
    expiresAt,
    nonce,
  };
  const payloadB64 = b64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = sign(payloadB64, getSecret());
  return `vxl_agent_${payloadB64}.${signature}`;
}

export function validateAgentToken(token: string): AgentTokenValidation {
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, payload: null, error: "malformed" };
  }
  // Strip the human-readable prefix to find the encoded bits.
  const stripped = token.startsWith("vxl_agent_") ? token.slice("vxl_agent_".length) : token;
  if (!stripped.includes(".")) {
    return { ok: false, payload: null, error: "malformed" };
  }
  const [payloadB64, signature] = stripped.split(".");
  if (!payloadB64 || !signature) {
    return { ok: false, payload: null, error: "malformed" };
  }
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, payload: null, error: "bad_signature" };
  }
  const expected = sign(payloadB64, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, payload: null, error: "bad_signature" };
  }
  let payload: AgentTokenPayload;
  try {
    payload = JSON.parse(b64UrlDecode(payloadB64).toString("utf8")) as AgentTokenPayload;
  } catch {
    return { ok: false, payload: null, error: "malformed" };
  }
  if (
    typeof payload.organizationId !== "string" ||
    typeof payload.connectorSlug !== "string" ||
    typeof payload.expiresAt !== "number"
  ) {
    return { ok: false, payload: null, error: "malformed" };
  }
  if (Date.now() > payload.expiresAt) {
    return { ok: false, payload: null, error: "expired" };
  }
  return { ok: true, payload, error: null };
}

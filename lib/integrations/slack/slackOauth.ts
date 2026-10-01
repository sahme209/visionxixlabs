/**
 * Slack OAuth install flow helpers.
 *
 * Pure URL builder + signed-state validator + redact helpers. The actual
 * OAuth token exchange happens in the route handler; this module
 * provides the inputs.
 *
 * Pure / deterministic.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const SLACK_INSTALL_URL = "https://slack.com/oauth/v2/authorize";

export interface SlackInstallUrlInput {
  clientId: string;
  /** Scopes the platform asks for. Defaults to the minimum we need. */
  scopes?: readonly string[];
  redirectUri: string;
  /** Opaque state token tied to the tenant + a nonce. */
  state: string;
}

const DEFAULT_SCOPES = [
  "chat:write",
  "chat:write.public",
  "commands",
  "channels:read",
  "groups:read",
  "im:read",
];

export function buildSlackInstallUrl(input: SlackInstallUrlInput): string {
  const scopes = (input.scopes ?? DEFAULT_SCOPES).join(",");
  const params = new URLSearchParams({
    client_id: input.clientId,
    scope: scopes,
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  return `${SLACK_INSTALL_URL}?${params.toString()}`;
}

export interface SlackOAuthState {
  tenantId: string;
  nonce: string;
  issuedAtSec: number;
}

const STATE_TTL_SEC = 10 * 60;

/**
 * Creates a short-lived, tenant-bound OAuth state token.
 *
 * State must never be merely encoded: an attacker could otherwise replace the
 * tenant id before the provider redirects back. The signature is deliberately
 * domain-separated so it cannot be confused with a desktop or GitHub token.
 */
export function encodeSlackState(input: {
  tenantId: string;
  nonce: string;
  secret: string;
  nowSec?: number;
}): string {
  if (!input.secret) throw new Error("Slack OAuth state signing secret is required");
  const issuedAt = input.nowSec ?? Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    tenantId: input.tenantId,
    nonce: input.nonce,
    issuedAtSec: issuedAt,
  })).toString("base64url");
  return `${payload}.${signState(payload, input.secret)}`;
}

export interface DecodedSlackState {
  ok: boolean;
  state?: SlackOAuthState;
  reason?: "malformed" | "tampered" | "expired";
}

export function decodeSlackState(input: { state: string; secret: string; nowSec?: number }): DecodedSlackState {
  if (!input.secret) return { ok: false, reason: "tampered" };
  try {
    const [payload, signature, ...extra] = input.state.split(".");
    if (!payload || !signature || extra.length > 0 || !safeEqual(signature, signState(payload, input.secret))) {
      return { ok: false, reason: "tampered" };
    }
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<SlackOAuthState>;
    if (typeof parsed.tenantId !== "string" || typeof parsed.nonce !== "string" || typeof parsed.issuedAtSec !== "number") {
      return { ok: false, reason: "malformed" };
    }
    const now = input.nowSec ?? Math.floor(Date.now() / 1000);
    if (now - parsed.issuedAtSec > STATE_TTL_SEC) return { ok: false, reason: "expired" };
    // A state issued far in the future should not become valid later if a
    // system clock was manipulated. Small clock drift is harmless.
    if (parsed.issuedAtSec > now + 60) return { ok: false, reason: "malformed" };
    return { ok: true, state: parsed as SlackOAuthState };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

function signState(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`slack-install-v1.${payload}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Redact a Slack token for log lines. Never returns the full token. */
export function redactSlackToken(token: string | null | undefined): string {
  if (!token) return "(unset)";
  if (token.length < 12) return "***";
  // Slack tokens look like xoxb-1234-5678-aBcDeFgHiJkLm. Keep prefix + tail.
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

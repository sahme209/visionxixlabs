/**
 * Slack OAuth install flow helpers.
 *
 * Pure URL builder + state validator + redact helpers. The actual
 * OAuth token exchange happens in the route handler; this module
 * provides the inputs.
 *
 * Pure / deterministic.
 */

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

/** Encode tenantId + nonce + issuedAt into a single state string. */
export function encodeSlackState(input: { tenantId: string; nonce: string; nowSec?: number }): string {
  const issuedAt = input.nowSec ?? Math.floor(Date.now() / 1000);
  return Buffer.from(JSON.stringify({
    tenantId: input.tenantId,
    nonce: input.nonce,
    issuedAtSec: issuedAt,
  })).toString("base64url");
}

export interface DecodedSlackState {
  ok: boolean;
  state?: SlackOAuthState;
  reason?: "malformed" | "expired";
}

export function decodeSlackState(encoded: string, nowSec?: number): DecodedSlackState {
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<SlackOAuthState>;
    if (typeof parsed.tenantId !== "string" || typeof parsed.nonce !== "string" || typeof parsed.issuedAtSec !== "number") {
      return { ok: false, reason: "malformed" };
    }
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    if (now - parsed.issuedAtSec > STATE_TTL_SEC) return { ok: false, reason: "expired" };
    return { ok: true, state: parsed as SlackOAuthState };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

/** Redact a Slack token for log lines. Never returns the full token. */
export function redactSlackToken(token: string | null | undefined): string {
  if (!token) return "(unset)";
  if (token.length < 12) return "***";
  // Slack tokens look like xoxb-1234-5678-aBcDeFgHiJkLm. Keep prefix + tail.
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

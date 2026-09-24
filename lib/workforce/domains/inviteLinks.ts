/**
 * Workspace invitation tokens — Phase 639.
 *
 * HMAC-signed token containing (organizationId, email, role,
 * invitedByUserId, expiresAt, nonce). The /accept-invite/[token]
 * route validates the signature + expiry and creates an
 * OrgMembership row binding the invitee to the workspace.
 *
 * Distinct from Phase 634 shareLinks: share tokens grant read
 * access to one AGI memory entry; invite tokens grant
 * workspace membership at a declared OrgRole. Different surface,
 * different consequence.
 *
 * Server-only.
 */

import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type InviteRole =
  | "owner"
  | "admin"
  | "operator"
  | "security_reviewer"
  | "finance_viewer"
  | "read_only";

export interface InviteTokenPayload {
  organizationId: string;
  email: string;
  role: InviteRole;
  invitedByUserId: string;
  expiresAt: number;
  nonce: string;
}

export type InviteTokenError = "malformed" | "bad_signature" | "expired";

export interface InviteValidation {
  ok: boolean;
  payload: InviteTokenPayload | null;
  error: InviteTokenError | null;
}

const DEFAULT_TTL_DAYS = 7;

function getSecret(): string {
  const secret = process.env.INVITE_LINK_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("invite_link_secret_missing_or_too_short");
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

export function createInviteToken(
  organizationId: string,
  email: string,
  role: InviteRole,
  invitedByUserId: string,
  ttlDays = DEFAULT_TTL_DAYS,
): string {
  const expiresAt = Date.now() + Math.max(1, Math.min(30, ttlDays)) * 24 * 60 * 60 * 1000;
  const nonce = b64UrlEncode(randomBytes(8));
  const payload: InviteTokenPayload = {
    organizationId,
    email: email.toLowerCase().trim(),
    role,
    invitedByUserId,
    expiresAt,
    nonce,
  };
  const payloadB64 = b64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = sign(payloadB64, getSecret());
  return `${payloadB64}.${signature}`;
}

export function validateInviteToken(token: string): InviteValidation {
  if (typeof token !== "string" || token.length === 0 || !token.includes(".")) {
    return { ok: false, payload: null, error: "malformed" };
  }
  const [payloadB64, signature] = token.split(".");
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
  let payload: InviteTokenPayload;
  try {
    payload = JSON.parse(b64UrlDecode(payloadB64).toString("utf8")) as InviteTokenPayload;
  } catch {
    return { ok: false, payload: null, error: "malformed" };
  }
  if (
    typeof payload.organizationId !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.invitedByUserId !== "string" ||
    typeof payload.expiresAt !== "number"
  ) {
    return { ok: false, payload: null, error: "malformed" };
  }
  if (Date.now() > payload.expiresAt) {
    return { ok: false, payload: null, error: "expired" };
  }
  return { ok: true, payload, error: null };
}

/** Roles a member with admin privileges is allowed to grant. Owner
 *  role is restricted — only the existing owner can transfer
 *  ownership, and that's a separate flow. */
export const ASSIGNABLE_ROLES: ReadonlyArray<InviteRole> = [
  "admin",
  "operator",
  "security_reviewer",
  "finance_viewer",
  "read_only",
];

export const ROLE_LABEL: Record<InviteRole, { label: string; description: string }> = {
  owner: {
    label: "Owner",
    description: "Full control. Single per workspace. Transfer requires explicit handoff.",
  },
  admin: {
    label: "Admin",
    description: "Manages members, billing, integrations, every engineer setting.",
  },
  operator: {
    label: "Operator",
    description: "Runs scans, approves engineer actions, configures workforce. Cannot manage billing or members.",
  },
  security_reviewer: {
    label: "Security Reviewer",
    description: "Reads findings, approvals, audit trail. Can vote on approvals but not initiate engineer actions.",
  },
  finance_viewer: {
    label: "Finance Viewer",
    description: "Reads FinOps recommendations + cost panels. No write access.",
  },
  read_only: {
    label: "Read-Only",
    description: "Reads dashboards. No vote, no run, no manage.",
  },
};

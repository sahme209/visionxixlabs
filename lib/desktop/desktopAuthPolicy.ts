/**
 * Desktop auth policy — decides whether a request to mint a new desktop
 * session should be allowed, and how a desktop bearer token should map to
 * an operating context for downstream API routes.
 *
 * This is policy, not mechanics. The actual session record + token live
 * in `desktopSession.ts` + `desktopToken.ts`.
 *
 * Hard rules enforced here:
 *  - User must be authenticated to mint a session.
 *  - At most `MAX_ACTIVE_SESSIONS_PER_USER` (5) active sessions per user.
 *  - Device fingerprint must be non-empty and ≥ 16 chars.
 *  - Anonymous fingerprints (e.g. all zeros) are rejected.
 */

import "server-only";

import type { CurrentContext } from "@/lib/auth/currentContext";
import { listActiveSessions, type DesktopSession } from "./desktopSession";

export const MAX_ACTIVE_SESSIONS_PER_USER = 5;
const MIN_FINGERPRINT_LEN = 16;

export interface PairingRequest {
  deviceFingerprint: string;
  deviceLabel: string;
  platform?: DesktopSession["platform"];
  desktopVersion?: string;
}

export type PolicyOutcome =
  | { allowed: true }
  | { allowed: false; code: string; reason: string };

export async function evaluatePairingPolicy(
  ctx: CurrentContext,
  req: PairingRequest,
): Promise<PolicyOutcome> {
  if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId) {
    return { allowed: false, code: "desktop.auth.not_signed_in", reason: "Sign in to the web app before pairing a desktop." };
  }
  const fp = (req.deviceFingerprint ?? "").trim();
  if (fp.length < MIN_FINGERPRINT_LEN) {
    return { allowed: false, code: "desktop.auth.bad_fingerprint", reason: `Device fingerprint must be ≥ ${MIN_FINGERPRINT_LEN} characters.` };
  }
  if (/^0+$/.test(fp) || /^x+$/i.test(fp)) {
    return { allowed: false, code: "desktop.auth.anonymous_fingerprint", reason: "Anonymous device fingerprints are not allowed." };
  }
  if (!req.deviceLabel?.trim()) {
    return { allowed: false, code: "desktop.auth.no_device_label", reason: "Device label is required." };
  }
  const active = await listActiveSessions(ctx.userId);
  if (active.length >= MAX_ACTIVE_SESSIONS_PER_USER) {
    return {
      allowed: false,
      code: "desktop.auth.session_cap",
      reason: `Reached the cap of ${MAX_ACTIVE_SESSIONS_PER_USER} active desktop sessions. Revoke an existing pairing before adding another.`,
    };
  }
  return { allowed: true };
}

/**
 * Map a verified desktop session back to a CurrentContext-shaped object so
 * downstream code that already accepts `CurrentContext` (audit writers,
 * approval engines, etc.) can be reused for desktop-originated requests.
 */
export function contextFromSession(session: DesktopSession): CurrentContext {
  return {
    isAuthenticated: true,
    userId: session.userId,
    organizationId: session.organizationId,
    workspaceLabel: session.deviceLabel,
    roles: ["desktop"],
  };
}

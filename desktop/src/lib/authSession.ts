/**
 * Desktop auth-session controller.
 *
 * Persists the pairing token issued by `/api/desktop/session`, hydrates
 * the `desktopClient` singleton on launch, and exposes save / clear
 * helpers used by the pairing UI.
 *
 * The token is opaque (`axm.desk.<sessionId>.<sig>`) and never combined
 * with any cloud credential. Cloud credentials are passed through to the
 * OS keychain by separate flows.
 */

import { desktopClient } from "./desktopClient";
import { readSecret, writeSecret, clearSecret } from "./secureStorage";

const TOKEN_KEY = "desktop.session.token";
const SESSION_META_KEY = "desktop.session.meta";

export interface PairedSession {
  id: string;
  deviceLabel: string;
  expiresAt: string;
}

export function validateAuthSession(token: string, session: PairedSession, now = Date.now()): string | null {
  if (!/^axm\.desk\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    return "The desktop session token has an invalid format.";
  }
  if (!session || typeof session.id !== "string" || !session.id.trim()) {
    return "The desktop session is missing its identifier.";
  }
  if (typeof session.deviceLabel !== "string" || !session.deviceLabel.trim()) {
    return "The desktop session is missing its device label.";
  }
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt)) return "The desktop session has an invalid expiry date.";
  if (expiresAt <= now) return "The desktop session has expired.";
  return null;
}

export async function hydrateAuthSession(): Promise<PairedSession | undefined> {
  const token = await readSecret<string>(TOKEN_KEY);
  if (!token) return undefined;
  const session = await readSecret<PairedSession>(SESSION_META_KEY);
  if (!session || validateAuthSession(token, session)) {
    await clearAuthSession();
    return undefined;
  }
  desktopClient.setSession(token);
  return session;
}

export async function saveAuthSession(token: string, session: PairedSession): Promise<void> {
  const validationError = validateAuthSession(token, session);
  if (validationError) throw new Error(validationError);
  await writeSecret(TOKEN_KEY, token);
  await writeSecret(SESSION_META_KEY, session);
  desktopClient.setSession(token);
}

export async function clearAuthSession(): Promise<void> {
  await clearSecret(TOKEN_KEY);
  await clearSecret(SESSION_META_KEY);
  desktopClient.setSession(undefined);
}

/** True when an explicit token has been hydrated into the client. */
export function hasActiveSessionToken(): boolean {
  return Boolean(desktopClient.config.sessionToken);
}

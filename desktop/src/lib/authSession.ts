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

export async function hydrateAuthSession(): Promise<PairedSession | undefined> {
  const token = await readSecret<string>(TOKEN_KEY);
  if (!token) return undefined;
  desktopClient.setSession(token);
  return await readSecret<PairedSession>(SESSION_META_KEY);
}

export async function saveAuthSession(token: string, session: PairedSession): Promise<void> {
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

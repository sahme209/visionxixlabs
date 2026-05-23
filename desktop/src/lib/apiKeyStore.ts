/**
 * Desktop API-key store.
 *
 * Persists a `vxlk_*` API key minted from the web admin panel to the
 * Tauri secure store. Hydrates the `desktopClient` singleton on launch
 * + exposes save/clear helpers used by the Settings UI.
 *
 * Why this exists separately from `authSession.ts`:
 *   - authSession.ts holds the legacy desktop "pairing token" (one
 *     desktop ↔ one session) — opaque, tied to a single device.
 *   - apiKeyStore.ts holds a real `vxlk_live_*` / `vxlk_test_*` key
 *     mintable from the admin panel (Phase 394+). Same key works on
 *     every v1 endpoint, scope-checked, quota-enforced.
 *
 * The desktop client prefers the API key when present; falls back to
 * the legacy pairing token otherwise. Both flows go through the same
 * Authorization: Bearer header.
 */

import { desktopClient } from "./desktopClient";
import { readSecret, writeSecret, clearSecret } from "./secureStorage";

const API_KEY_STORE_KEY = "desktop.api_key";

/** Structure: `vxlk_<env>_<24-secret>_<6-checksum>` — see lib/security/apiKeyCrypto.ts on the web side. */
const VXLK_KEY_RE = /^vxlk_(live|test)_[0-9A-HJKMNPQRSTVWXYZ]{24}_[0-9A-HJKMNPQRSTVWXYZ]{6}$/;

export function isWellFormedApiKey(s: string): boolean {
  return VXLK_KEY_RE.test(s.trim());
}

/** Hydrate the desktopClient with the persisted key (if any). */
export async function hydrateApiKey(): Promise<string | undefined> {
  const key = await readSecret<string>(API_KEY_STORE_KEY);
  if (!key) return undefined;
  desktopClient.setSession(key);
  return key;
}

/** Persist + hot-apply a freshly-pasted key. Throws on bad format. */
export async function saveApiKey(plaintext: string): Promise<void> {
  const trimmed = plaintext.trim();
  if (!isWellFormedApiKey(trimmed)) {
    throw new Error(
      "API key format invalid. Expected vxlk_live_… or vxlk_test_… as shown by the admin panel.",
    );
  }
  await writeSecret(API_KEY_STORE_KEY, trimmed);
  desktopClient.setSession(trimmed);
}

export async function clearApiKey(): Promise<void> {
  await clearSecret(API_KEY_STORE_KEY);
  desktopClient.setSession(undefined);
}

export async function readPersistedApiKey(): Promise<string | undefined> {
  return readSecret<string>(API_KEY_STORE_KEY);
}

/** Returns the first 14 chars (the prefix the web admin panel shows). */
export function apiKeyPrefix(plaintext: string): string {
  return plaintext.trim().slice(0, 14);
}

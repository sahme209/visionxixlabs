import { desktopClient, type VerifiedDesktopIdentity } from "./desktopClient";
import { validateAuthSession, type PairedSession } from "./authSession";
import { clearSecret, readSecret, writeSecret } from "./secureStorage";

const ACTIVE_KEY = "desktop.credential.selection.v1";
interface PairedCredential { token: string; session: PairedSession }
interface CredentialSelection {
  version: 1;
  active: "api_key" | "paired_session" | "signed_out";
  apiKey?: string;
  pairedSession?: PairedCredential;
}

export function isWellFormedApiKey(value: string): boolean {
  return /^vxlk_(live|test)_[0-9A-HJKMNPQRSTVWXYZ]{24}_[0-9A-HJKMNPQRSTVWXYZ]{6}$/.test(value.trim());
}

function parseSelection(raw: unknown): CredentialSelection {
  if (!raw || typeof raw !== "object") throw new Error("Saved credential selection is invalid. Sign in again.");
  const value = raw as Partial<CredentialSelection>;
  if (value.version !== 1 || !["api_key", "paired_session", "signed_out"].includes(value.active ?? "")) {
    throw new Error("Saved credential selection is invalid. Sign in again.");
  }
  return value as CredentialSelection;
}

async function saveVerifiedSelection(next: { apiKey: string } | { pairedSession: PairedCredential }, signal?: AbortSignal, onCommitting?: () => void): Promise<void> {
  const raw = await readSecret<unknown>(ACTIVE_KEY);
  // A newly verified recovery can replace corrupt selection metadata. Keep any
  // valid inactive credential in a readable selection; never delete legacy keys.
  let previous: CredentialSelection = { version: 1, active: "signed_out" };
  if (raw !== undefined) {
    try { previous = parseSelection(raw); } catch { /* verified recovery replaces invalid metadata */ }
  }
  const selection: CredentialSelection = "apiKey" in next
    ? { ...previous, ...next, active: "api_key" }
    : { ...previous, ...next, active: "paired_session" };
  // One vault value commits credential + selection together. There is no
  // intermediate state with a new credential and an old preference.
  signal?.throwIfAborted();
  onCommitting?.();
  await writeSecret(ACTIVE_KEY, selection);
}

export async function verifyAndActivateApiKey(value: string, signal?: AbortSignal, onCommitting?: () => void): Promise<VerifiedDesktopIdentity> {
  const candidate = value.trim();
  if (!isWellFormedApiKey(candidate)) throw new Error("API key format invalid. Expected vxlk_live_… or vxlk_test_… as shown by the admin panel.");
  signal?.throwIfAborted();
  const verified = await desktopClient.verifyCredentialCandidate(candidate);
  signal?.throwIfAborted();
  if (!verified.ok) throw new Error(verified.error);
  await saveVerifiedSelection({ apiKey: candidate }, signal, onCommitting);
  signal?.throwIfAborted();
  desktopClient.setSession(candidate);
  return verified.data;
}

export async function verifyAndActivatePairedSession(token: string, session: PairedSession, signal?: AbortSignal, onCommitting?: () => void): Promise<VerifiedDesktopIdentity> {
  const invalid = validateAuthSession(token, session);
  if (invalid) throw new Error(invalid);
  signal?.throwIfAborted();
  const verified = await desktopClient.verifyCredentialCandidate(token);
  signal?.throwIfAborted();
  if (!verified.ok) throw new Error(`The approved desktop session could not be verified. ${verified.error}`);
  await saveVerifiedSelection({ pairedSession: { token, session } }, signal, onCommitting);
  signal?.throwIfAborted();
  desktopClient.setSession(token);
  return verified.data;
}

/** Load only the explicitly selected credential. App still verifies it with the
 * server before loading operational data. No fallback across workspace identities. */
export async function hydrateDesktopCredential(): Promise<void> {
  desktopClient.setSession(undefined);
  const raw = await readSecret<unknown>(ACTIVE_KEY);
  if (raw !== undefined) {
    const selection = parseSelection(raw);
    if (selection.active === "signed_out") return;
    if (selection.active === "api_key") {
      if (typeof selection.apiKey !== "string" || !isWellFormedApiKey(selection.apiKey)) throw new Error("The selected workspace key is unavailable. Sign in again.");
      desktopClient.setSession(selection.apiKey);
      return;
    }
    const paired = selection.pairedSession;
    if (!paired || typeof paired.token !== "string" || validateAuthSession(paired.token, paired.session)) throw new Error("The selected desktop session is unavailable or expired. Sign in again.");
    desktopClient.setSession(paired.token);
    return;
  }

  // Compatibility for installations that have never made an explicit choice:
  // preserve the previous API-key-first order, without deleting either value.
  const key = await readSecret<string>("desktop.api_key");
  if (key) {
    if (!isWellFormedApiKey(key)) throw new Error("The saved workspace key is invalid. Sign in again.");
    desktopClient.setSession(key);
    return;
  }
  const token = await readSecret<string>("desktop.session.token");
  if (!token) return;
  const session = await readSecret<PairedSession>("desktop.session.meta");
  if (!session || validateAuthSession(token, session)) throw new Error("The saved desktop session is unavailable or expired. Sign in again.");
  desktopClient.setSession(token);
}

/** Explicit sign-out writes a tombstone first, so failed legacy cleanup cannot
 * silently reactivate an inactive identity on restart. Always lock transport. */
export async function signOutDesktopCredentials(): Promise<void> {
  desktopClient.setSession(undefined);
  await writeSecret(ACTIVE_KEY, { version: 1, active: "signed_out" });
  const cleanup = await Promise.allSettled([
    clearSecret("desktop.api_key"), clearSecret("desktop.session.token"), clearSecret("desktop.session.meta"),
  ]);
  if (cleanup.some(result => result.status === "rejected")) throw new Error("Sign-out is saved, but some older saved credentials could not be removed. Retry sign-out when secure storage is available.");
}

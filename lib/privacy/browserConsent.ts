export type PrivacyChoice = "accepted" | "essential";
export const PRIVACY_CONSENT_KEY = "axiom_privacy_consent_v1";

function parseChoice(value: string | null): PrivacyChoice | null {
  return value === "accepted" || value === "essential" ? value : null;
}

/** Browser persistence is optional. An explicit refusal in either channel
 * wins over an older grant that could not be replaced in the other channel. */
export function readPrivacyChoice(): PrivacyChoice | null {
  if (typeof window === "undefined") return null;
  let stored: PrivacyChoice | null = null;
  let cookie: PrivacyChoice | null = null;
  try { stored = parseChoice(window.localStorage.getItem(PRIVACY_CONSENT_KEY)); } catch { /* storage can be denied */ }
  try {
    for (const part of document.cookie.split(";")) {
      const entry = part.trim();
      if (!entry.startsWith(`${PRIVACY_CONSENT_KEY}=`)) continue;
      const choice = parseChoice(entry.slice(PRIVACY_CONSENT_KEY.length + 1));
      if (choice === "essential") { cookie = choice; break; }
      if (choice) cookie = choice;
    }
  } catch { /* cookie access can also be denied */ }
  if (stored === "essential" || cookie === "essential") return "essential";
  return stored ?? cookie;
}

export function persistPrivacyChoice(value: PrivacyChoice): boolean {
  if (typeof window === "undefined") return false;
  try { window.localStorage.setItem(PRIVACY_CONSENT_KEY, value); } catch { /* try the cookie independently */ }
  try {
    document.cookie = `${PRIVACY_CONSENT_KEY}=${value}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
  } catch { /* the current-tab choice still applies */ }
  // Cookie writes can fail silently. Confirm the effective stored decision.
  return readPrivacyChoice() === value;
}

/** SDK callbacks can outlive a render; read the current decision per event. */
export function filterPrivacyEvent<T>(choice: PrivacyChoice | null, event: T): T | null {
  return choice === "accepted" ? event : null;
}

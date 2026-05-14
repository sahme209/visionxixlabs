/**
 * Back-compat shim — delegates to the canonical `lib/security/redaction.ts`.
 * Prefer the canonical module in new code; this file is kept so existing
 * imports (`redactSecrets`) keep working.
 */

import { redact } from "./redaction";

export function redactSecrets(text: string): string {
  return redact(text);
}

/**
 * API redaction helpers.
 *
 * Anything that crosses the HTTP boundary must be redacted of secrets,
 * raw credentials, and PII. This module is a pure-string transformer —
 * no I/O — and works on both strings and arbitrary JSON-serialisable
 * structures.
 *
 * Conservative by design: when in doubt the helper redacts. False
 * negatives (a real secret making it through) are far worse than
 * false positives (a harmless string showing as `[redacted]`).
 */

const SECRET_KEY_PATTERN = /(secret|token|password|api[_-]?key|client[_-]?secret|signing[_-]?key|private[_-]?key|access[_-]?key)$/i;

const VALUE_PATTERNS: RegExp[] = [
  /^[A-Z0-9]{16,40}$/,                            // Generic capital-token (AWS access key, etc.)
  /^ghp_[A-Za-z0-9]{20,}$/,                       // GitHub personal access tokens
  /^gho_[A-Za-z0-9]{20,}$/,                       // GitHub OAuth tokens
  /^ghs_[A-Za-z0-9]{20,}$/,                       // GitHub server tokens
  /^xox[abprs]-[A-Za-z0-9-]{10,}$/,               // Slack tokens
  /^sk-[A-Za-z0-9_-]{20,}$/,                      // OpenAI / Anthropic / similar
  /^eyJ[A-Za-z0-9_=-]+\.[A-Za-z0-9_=-]+\.[A-Za-z0-9_.+/=-]+$/, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,           // PEM private keys
  /AKIA[0-9A-Z]{16}/,                             // AWS access key IDs
  /aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{30,}/i,
];

export const REDACTION_PLACEHOLDER = "[redacted]";

export function redactString(input: string): string {
  if (!input) return input;
  if (VALUE_PATTERNS.some((p) => p.test(input))) return REDACTION_PLACEHOLDER;
  return input;
}

/**
 * Recursively redact secret-shaped keys / values in any JSON-serialisable
 * value. Returns a new object — never mutates the input.
 */
export function redactPayload<T>(value: T): T {
  return redactInternal(value) as T;
}

function redactInternal(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => redactInternal(v));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k)) {
        out[k] = REDACTION_PLACEHOLDER;
        continue;
      }
      out[k] = redactInternal(v);
    }
    return out;
  }
  return value;
}

/** Quick check — exposed for tests. */
export function isLikelySecret(value: string): boolean {
  return VALUE_PATTERNS.some((p) => p.test(value));
}

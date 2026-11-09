/**
 * AI context minimization (A7.16). Pure.
 *
 * Applied in the one governed AI path before any text can reach a model:
 * anything that looks like a credential is replaced with a typed placeholder.
 * Deterministic and idempotent. This lowers the chance of a secret leaving the
 * workspace; it is not a guarantee, so callers still must not send secrets.
 */
const RULES: ReadonlyArray<{ kind: string; re: RegExp }> = [
  { kind: "private_key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { kind: "axiom_key", re: /\bvxlk_(?:live|test)_[A-Za-z0-9]{8,}\b/g },
  { kind: "aws_access_key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: "github_token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { kind: "anthropic_key", re: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g },
  { kind: "openai_key", re: /\bsk-(?:proj-)?[A-Za-z0-9\-_]{20,}\b/g },
  { kind: "slack_token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: "stripe_key", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { kind: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { kind: "connection_string_password", re: /(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]{3,}(@)/gi },
  // Matches env-style names too (DB_PASSWORD=, STRIPE_SECRET_KEY:, x-api-key=).
  { kind: "assigned_secret", re: /((?:^|[^A-Za-z0-9])[A-Za-z0-9_-]*?(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key)[A-Za-z0-9_-]*\s*[:=]\s*["']?)(?!\[REDACTED)[^\s"'`,;]{6,}/gi },
];

export interface RedactionResult { text: string; redactions: Record<string, number> }

export function redactSecrets(input: string): RedactionResult {
  let text = input;
  const redactions: Record<string, number> = {};
  for (const { kind, re } of RULES) {
    text = text.replace(re, (match: string, p1?: string, p2?: string) => {
      redactions[kind] = (redactions[kind] ?? 0) + 1;
      // Keep the label (e.g. "password=" or "postgres://user:") so the model still understands the shape.
      if (kind === "connection_string_password") return `${p1}[REDACTED]${p2}`;
      if (kind === "assigned_secret") return `${p1}[REDACTED:${kind}]`;
      return `[REDACTED:${kind}]`;
    });
  }
  return { text, redactions };
}

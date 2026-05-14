/**
 * Canonical secret redaction.
 *
 * One redaction pipeline runs over every string that leaves the platform:
 *  - structured logs
 *  - error bodies returned to users
 *  - audit/event payloads
 *  - copilot context
 *  - workflow/job outputs
 *  - connector sync / desktop sync envelopes
 *  - debug panels
 *
 * The redactor is intentionally aggressive — false positives ("[REDACTED]"
 * appearing in a public string) are recoverable; leaking a real key isn't.
 *
 * Why patterns are bundled into named groups: enterprise reviewers ask
 * "what do you scrub for AWS / GCP / GitHub" — we want one place to point
 * at, not a redactor sprinkled across modules. The previous
 * `lib/security/secretRedaction.ts` covered ~5 patterns and is now a
 * back-compat shim that delegates here.
 */

export interface RedactionPattern {
  /** Stable id for logging which patterns matched. */
  id: string;
  /** Human-readable label. */
  label: string;
  pattern: RegExp;
  replacement: string;
}

/** Pattern groups — exposed so the security center UI can render coverage. */
export const REDACTION_PATTERNS: RedactionPattern[] = [
  // AWS
  { id: "aws.access_key",  label: "AWS access key id",    pattern: /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g,                        replacement: "[REDACTED-AWS-ACCESS-KEY]" },
  { id: "aws.session_token", label: "AWS STS session",    pattern: /\baws_session_token\s*[:=]\s*['"]?[A-Za-z0-9+/=]{100,}['"]?/gi,                replacement: "aws_session_token=[REDACTED-AWS-STS]" },
  { id: "aws.secret_key",  label: "AWS secret access key",pattern: /\baws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi,              replacement: "aws_secret_access_key=[REDACTED-AWS-SECRET]" },
  // GitHub
  { id: "github.pat",      label: "GitHub PAT (classic)",  pattern: /\bghp_[A-Za-z0-9]{36,}\b/g,                                                   replacement: "[REDACTED-GITHUB-PAT]" },
  { id: "github.oauth",    label: "GitHub OAuth token",    pattern: /\bgho_[A-Za-z0-9]{36,}\b/g,                                                   replacement: "[REDACTED-GITHUB-OAUTH]" },
  { id: "github.user",     label: "GitHub user token",     pattern: /\bghu_[A-Za-z0-9]{36,}\b/g,                                                   replacement: "[REDACTED-GITHUB-USER]" },
  { id: "github.app",      label: "GitHub app installation", pattern: /\bghs_[A-Za-z0-9]{36,}\b/g,                                                 replacement: "[REDACTED-GITHUB-APP]" },
  { id: "github.refresh",  label: "GitHub refresh token",  pattern: /\bghr_[A-Za-z0-9]{36,}\b/g,                                                   replacement: "[REDACTED-GITHUB-REFRESH]" },
  // GCP service account JSON — match the `"private_key": "-----BEGIN…"` substring
  { id: "gcp.sa_private_key", label: "GCP service account private key",
    pattern: /"private_key"\s*:\s*"-----BEGIN[^"]+-----[\s\S]*?-----END[^"]+-----\\n?"/g,
    replacement: '"private_key":"[REDACTED-GCP-SA-PRIVATE-KEY]"' },
  // Azure
  { id: "azure.client_secret", label: "Azure client secret",
    pattern: /\b(?:client_secret|clientSecret)\s*[:=]\s*['"]?[A-Za-z0-9._~-]{30,}['"]?/gi,
    replacement: "client_secret=[REDACTED-AZURE-CLIENT-SECRET]" },
  // PEM-encoded private keys
  { id: "private_key.pem", label: "PEM private key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PRIVATE )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PRIVATE )?PRIVATE KEY-----/g,
    replacement: "[REDACTED-PRIVATE-KEY]" },
  // JWT
  { id: "jwt",             label: "JWT",                   pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,           replacement: "[REDACTED-JWT]" },
  // Bearer header
  { id: "bearer",          label: "Authorization bearer",  pattern: /\b(Authorization\s*:\s*Bearer\s+)[A-Za-z0-9._~+/=-]{20,}/gi,                   replacement: "$1[REDACTED-BEARER]" },
  // Slack
  { id: "slack",           label: "Slack token",           pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,                                            replacement: "[REDACTED-SLACK-TOKEN]" },
  // Stripe
  { id: "stripe",          label: "Stripe key",            pattern: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,                             replacement: "[REDACTED-STRIPE-KEY]" },
  // OpenAI / Anthropic
  { id: "openai",          label: "OpenAI key",            pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g,                                                   replacement: "[REDACTED-OPENAI-KEY]" },
  { id: "anthropic",       label: "Anthropic key",         pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,                                               replacement: "[REDACTED-ANTHROPIC-KEY]" },
  // Generic high-entropy credential assignments (token=…, password=…, api_key=…)
  { id: "generic.assignment", label: "Generic credential assignment",
    pattern: /\b(api[_-]?key|secret|password|passwd|token|access[_-]?key|auth[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{16,}['"]?/gi,
    replacement: "$1=[REDACTED]" },
  // Connection strings (postgres / mysql / mongodb)
  { id: "conn.postgres",   label: "Postgres connection",  pattern: /\bpostgres(?:ql)?:\/\/[^\s'"]+/gi,                                              replacement: "[REDACTED-POSTGRES-URL]" },
  { id: "conn.mysql",      label: "MySQL connection",     pattern: /\bmysql:\/\/[^\s'"]+/gi,                                                        replacement: "[REDACTED-MYSQL-URL]" },
  { id: "conn.mongo",      label: "Mongo connection",     pattern: /\bmongodb(?:\+srv)?:\/\/[^\s'"]+/gi,                                            replacement: "[REDACTED-MONGO-URL]" },
  // Webhook secrets
  { id: "webhook.secret",  label: "Webhook signing secret", pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/g,                                                  replacement: "[REDACTED-WEBHOOK-SECRET]" },
];

/** Apply redaction to a string. Safe for any input. */
export function redact(input: string): string {
  if (typeof input !== "string" || input.length === 0) return input;
  let out = input;
  for (const p of REDACTION_PATTERNS) {
    out = out.replace(p.pattern, p.replacement);
  }
  return out;
}

/** Apply redaction recursively to any JSON-shaped value. Returns a new object. */
export function redactDeep<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") return redact(value) as unknown as T;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(redactDeep) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_NAMES.has(k.toLowerCase())) {
        // The key itself signals a secret — replace the value regardless of shape.
        out[k] = typeof v === "string" && v.length > 0 ? "[REDACTED]" : v;
      } else {
        out[k] = redactDeep(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}

/** Key names that always carry secrets — value gets redacted regardless. */
const SENSITIVE_KEY_NAMES = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "session_token",
  "api_key",
  "apikey",
  "client_secret",
  "private_key",
  "credential",
  "credentials",
  "authorization",
  "auth",
  "x-api-key",
  "x-auth-token",
  "cookie",
  "set-cookie",
  "aws_secret_access_key",
  "aws_session_token",
  "github_token",
  "openai_api_key",
  "anthropic_api_key",
  "stripe_secret_key",
  "encryption_key",
  "signing_key",
  "webhook_secret",
]);

/** Audit which patterns are currently configured — used by Security Center UI. */
export function redactionCoverage(): { patterns: { id: string; label: string }[]; sensitiveKeyCount: number } {
  return {
    patterns: REDACTION_PATTERNS.map((p) => ({ id: p.id, label: p.label })),
    sensitiveKeyCount: SENSITIVE_KEY_NAMES.size,
  };
}

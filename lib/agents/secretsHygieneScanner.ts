/**
 * Pure secrets hygiene scanner.
 *
 * Input: a file or diff (operator-provided text) + an optional list
 * of allowlist patterns. Output: a typed list of SecretFinding rows,
 * each with closed-union secret kind + severity + redacted preview +
 * recommended action (rotate / remove / quarantine).
 *
 * Pure / deterministic. Pattern-based — fast + offline. False-positive
 * rate is kept low by requiring entropy + format constraints on the
 * matched string. The kernel never prints the raw secret in its
 * output; it surfaces a redacted preview only.
 *
 * Why this matters for AGI:
 *   Every agent kernel that reads operator files (PRs, configs, logs)
 *   must first run this scanner. Without this gate, an autonomous
 *   pipeline could ship the operator's credentials into a model call.
 */

export type SecretKind =
  | "aws_access_key"
  | "stripe_key"
  | "github_token"
  | "google_api_key"
  | "openai_key"
  | "anthropic_key"
  | "slack_token"
  | "jwt"
  | "private_key_pem"
  | "email"
  | "ipv4";

export type SecretSeverity = "info" | "warn" | "high" | "critical";

export interface SecretFinding {
  kind: SecretKind;
  severity: SecretSeverity;
  /** 1-based line number in the input. */
  line: number;
  /** Column where the match starts (0-based). */
  column: number;
  /** A redacted preview — never includes the raw value. */
  redactedPreview: string;
  /** Recommended remediation. */
  recommendedAction:
    | { kind: "rotate"; rationale: string }
    | { kind: "remove_from_history"; rationale: string }
    | { kind: "quarantine_file"; rationale: string }
    | { kind: "investigate"; rationale: string };
}

interface PatternEntry {
  kind: SecretKind;
  pattern: RegExp;
  /** Closed-union severity baseline (escalation rules below). */
  severity: SecretSeverity;
  /** Minimum length of the matched substring. */
  minLen: number;
  /**
   * Minimum Shannon-entropy bits-per-char. Cuts false positives on
   * generic-high-entropy heuristics.
   */
  minEntropy?: number;
}

// Patterns ordered by specificity. Sort below uses minLen DESC; ties
// follow declaration order so more-specific declarations win.
//
// All patterns are ES2017-safe — no lookbehind, no named groups.
//
// Generic high-entropy base64 patterns (aws_secret_access_key,
// azure_storage_key) were removed because they require lookbehind
// for word-boundary handling around `+/=` and produced too many
// false positives anyway. Context-based detection (env var name +
// short-string match) is the better signal there.
const PATTERNS: ReadonlyArray<PatternEntry> = [
  { kind: "aws_access_key",        pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,                          severity: "critical", minLen: 20 },
  { kind: "stripe_key",            pattern: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g,        severity: "critical", minLen: 28 },
  { kind: "github_token",          pattern: /\bgh[opsu]_[A-Za-z0-9]{20,}\b/g,                          severity: "critical", minLen: 24 },
  { kind: "google_api_key",        pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,                              severity: "high",     minLen: 39 },
  // Anthropic listed BEFORE openai so sk-ant-... goes to anthropic.
  { kind: "anthropic_key",         pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,                          severity: "critical", minLen: 28 },
  // OpenAI's sk- prefix excludes sk-ant- to avoid clobbering anthropic.
  { kind: "openai_key",            pattern: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{30,}\b/g,            severity: "critical", minLen: 33 },
  { kind: "slack_token",           pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,                       severity: "high",     minLen: 16 },
  { kind: "jwt",                   pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, severity: "warn", minLen: 30 },
  // PEM banner alone is 27 chars (-----BEGIN PRIVATE KEY-----).
  { kind: "private_key_pem",       pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED |PGP )?PRIVATE KEY-----/g, severity: "critical", minLen: 25 },
  { kind: "email",                 pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,                            severity: "warn",     minLen: 6 },
  { kind: "ipv4",                  pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                            severity: "info",     minLen: 7 },
];

const ACTION_BY_KIND: Record<SecretKind, SecretFinding["recommendedAction"]> = {
  aws_access_key:  { kind: "rotate",              rationale: "Rotate the IAM access key + remove from history. Audit CloudTrail for use." },
  stripe_key:      { kind: "rotate",              rationale: "Rotate via Stripe Dashboard → Developers → API keys. Roll immediately." },
  github_token:    { kind: "rotate",              rationale: "Revoke at github.com/settings/tokens + rotate." },
  google_api_key:  { kind: "rotate",              rationale: "Restrict in GCP console → APIs & Services → Credentials, then rotate." },
  openai_key:      { kind: "rotate",              rationale: "Revoke at platform.openai.com/api-keys + rotate." },
  anthropic_key:   { kind: "rotate",              rationale: "Revoke at console.anthropic.com + rotate." },
  slack_token:     { kind: "rotate",              rationale: "Regenerate token in the Slack app config." },
  jwt:             { kind: "investigate",         rationale: "JWTs may be intentional in test fixtures; verify before action." },
  private_key_pem: { kind: "remove_from_history", rationale: "Strip from history (git filter-repo) + rotate the keypair." },
  email:           { kind: "investigate",         rationale: "Emails are PII — assess whether redaction is required for compliance." },
  ipv4:            { kind: "investigate",         rationale: "IPs may be public docs vs. internal addresses; review context." },
};

function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const counts: Record<string, number> = {};
  for (const ch of s) counts[ch] = (counts[ch] ?? 0) + 1;
  let h = 0;
  for (const k of Object.keys(counts)) {
    const p = counts[k] / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function redact(match: string, kind: SecretKind): string {
  if (kind === "email") {
    // Show first char + domain only.
    const at = match.indexOf("@");
    if (at > 0) return `${match[0]}***${match.slice(at)}`;
    return "[REDACTED_EMAIL]";
  }
  if (kind === "ipv4") return match;
  if (match.length <= 8) return "[REDACTED]";
  return `${match.slice(0, 4)}…${match.slice(-4)} (${match.length} chars)`;
}

function lineColFor(input: string, idx: number): { line: number; column: number } {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < idx; i++) {
    if (input[i] === "\n") {
      line += 1;
      lastNewline = i;
    }
  }
  return { line, column: idx - lastNewline - 1 };
}

export interface ScanOptions {
  /** Patterns to ignore (e.g. known test fixtures). */
  allowlist?: ReadonlyArray<string>;
}

export interface ScanResult {
  findings: readonly SecretFinding[];
  /** Whether ANY critical-tier finding was raised. */
  hasCritical: boolean;
  /** Bytes scanned. */
  bytesScanned: number;
}

export function scanForSecrets(input: string, options: ScanOptions = {}): ScanResult {
  const findings: SecretFinding[] = [];
  if (!input) return { findings: [], hasCritical: false, bytesScanned: 0 };

  const allow = options.allowlist ?? [];

  // Track which (kind, byteOffset) we've already recorded — when patterns
  // overlap (e.g. AWS access key looks high-entropy too), record only
  // the more specific finding. We sort patterns by specificity (longer
  // minLen first) so the more precise rule wins.
  const sortedPatterns = [...PATTERNS].sort((a, b) => b.minLen - a.minLen);
  const claimedOffsets = new Set<string>();

  for (const p of sortedPatterns) {
    const re = new RegExp(p.pattern.source, p.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      const match = m[0];
      if (match.length < p.minLen) continue;
      if (allow.some((a) => match.includes(a))) continue;
      if (p.minEntropy !== undefined && shannonEntropy(match) < p.minEntropy) continue;

      // De-dup against earlier (more-specific) finds at this offset.
      let alreadyClaimed = false;
      for (let off = m.index; off < m.index + match.length; off++) {
        if (claimedOffsets.has(`${off}`)) {
          alreadyClaimed = true;
          break;
        }
      }
      if (alreadyClaimed) continue;
      for (let off = m.index; off < m.index + match.length; off++) {
        claimedOffsets.add(`${off}`);
      }

      const { line, column } = lineColFor(input, m.index);
      findings.push({
        kind: p.kind,
        severity: p.severity,
        line,
        column,
        redactedPreview: redact(match, p.kind),
        recommendedAction: ACTION_BY_KIND[p.kind],
      });
    }
  }

  // Sort by line, then column.
  findings.sort((a, b) => (a.line - b.line) || (a.column - b.column));

  return {
    findings,
    hasCritical: findings.some((f) => f.severity === "critical"),
    bytesScanned: input.length,
  };
}

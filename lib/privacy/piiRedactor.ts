/**
 * Pure PII redactor.
 *
 * Replaces matches of common sensitive patterns (emails, phone numbers,
 * credit-card-shaped digits, AWS access keys, JWTs, IPv4/IPv6) with
 * stable placeholders. The mapping is returned so a downstream step
 * could (carefully!) un-redact if necessary.
 *
 * Pure / deterministic. No DB. The mapping is per-call — caller is
 * responsible for not persisting it longer than necessary.
 */

export type RedactionKind = "email" | "phone" | "credit_card" | "aws_access_key" | "jwt" | "ipv4" | "ipv6";

export interface RedactionRule {
  kind: RedactionKind;
  pattern: RegExp;
}

export interface Redaction {
  kind: RedactionKind;
  placeholder: string;
  original: string;
}

export interface RedactionReport {
  redactedText: string;
  redactions: Redaction[];
  /** True iff anything was redacted. */
  hadRedactions: boolean;
}

const DEFAULT_RULES: RedactionRule[] = [
  { kind: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: "jwt",            pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { kind: "email",          pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g },
  { kind: "credit_card",    pattern: /\b(?:\d[ -]*?){13,16}\b/g },
  // US-shaped phone — country code now truly optional, so "415-555-1212" matches.
  { kind: "phone",          pattern: /(?:\+?\d{1,3}[ .-])?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g },
  { kind: "ipv6",           pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g },
  { kind: "ipv4",           pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g },
];

export function redactPii(text: string, opts?: { rules?: readonly RedactionRule[] }): RedactionReport {
  const rules = opts?.rules ?? DEFAULT_RULES;
  const redactions: Redaction[] = [];
  const counters = new Map<RedactionKind, number>();

  let out = text;
  for (const rule of rules) {
    out = out.replace(rule.pattern, (match) => {
      const n = (counters.get(rule.kind) ?? 0) + 1;
      counters.set(rule.kind, n);
      const placeholder = `<${rule.kind}:${n}>`;
      redactions.push({ kind: rule.kind, placeholder, original: match });
      return placeholder;
    });
  }

  return { redactedText: out, redactions, hadRedactions: redactions.length > 0 };
}

/** Convenience: just the redacted text. */
export function redactText(text: string): string {
  return redactPii(text).redactedText;
}

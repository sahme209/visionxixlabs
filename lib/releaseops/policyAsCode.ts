/**
 * Policy as code, step 1: export the workspace's policy rules as a canonical document that can live in Git,
 * and diff a proposed document against the current rules. Pure; it never writes rules. Applying a change
 * stays a governed, reviewed action.
 */
import { z } from "zod";

export const POLICY_DOCUMENT_KIND = "v19.policy";
export const POLICY_DOCUMENT_VERSION = 1;

const severity = z.enum(["low", "medium", "high", "critical"]);
const approverRole = z.enum(["manager", "release_captain", "emergency_change"]).nullable();
export const policyRuleSchema = z.object({
  key: z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9_.-]*$/, "keys use lowercase letters, digits, dot, dash or underscore"),
  label: z.string().trim().min(1).max(200),
  severity,
  blocking: z.boolean(),
  exceptionAllowed: z.boolean(),
  approverRole,
  evidenceRequired: z.boolean(),
  enabled: z.boolean(),
  description: z.string().max(2000).nullable(),
}).strict();
export type PolicyRuleSpec = z.infer<typeof policyRuleSchema>;

export const policyDocumentSchema = z.object({
  kind: z.literal(POLICY_DOCUMENT_KIND),
  version: z.literal(POLICY_DOCUMENT_VERSION),
  rules: z.array(policyRuleSchema).max(500),
}).strict().superRefine((doc, ctx) => {
  const seen = new Set<string>();
  doc.rules.forEach((rule, index) => {
    if (seen.has(rule.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rules", index, "key"], message: `duplicate key "${rule.key}"` });
    seen.add(rule.key);
  });
});
export type PolicyDocument = z.infer<typeof policyDocumentSchema>;

interface StoredRule { key: string; label: string; severity: string; blocking: boolean; exceptionAllowed: boolean; approverRole: string | null; evidenceRequired: boolean; enabled: boolean; description: string | null }

/** Canonical, sorted, stable JSON so the same rules always produce the same file (clean Git diffs). */
export function exportPolicyDocument(rules: readonly StoredRule[]): string {
  const doc = {
    kind: POLICY_DOCUMENT_KIND,
    version: POLICY_DOCUMENT_VERSION,
    rules: [...rules].sort((a, b) => a.key.localeCompare(b.key)).map((r) => ({
      key: r.key, label: r.label, severity: r.severity, blocking: r.blocking, exceptionAllowed: r.exceptionAllowed,
      approverRole: r.approverRole, evidenceRequired: r.evidenceRequired, enabled: r.enabled, description: r.description,
    })),
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

export type ParseResult = { ok: true; document: PolicyDocument } | { ok: false; errors: string[] };

export function parsePolicyDocument(text: string): ParseResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ["The file is not valid JSON."] }; }
  const parsed = policyDocumentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "document"}: ${i.message}`) };
  return { ok: true, document: parsed.data };
}

export interface PolicyDiff {
  added: PolicyRuleSpec[];
  removed: string[];
  changed: Array<{ key: string; fields: Array<{ field: keyof PolicyRuleSpec; from: unknown; to: unknown }> }>;
  unchanged: number;
  /** Changes that loosen governance (blocking turned off, rule disabled or removed, exceptions newly allowed). */
  loosening: string[];
}

const FIELDS: Array<keyof PolicyRuleSpec> = ["label", "severity", "blocking", "exceptionAllowed", "approverRole", "evidenceRequired", "enabled", "description"];

export function diffPolicy(current: readonly StoredRule[], proposed: PolicyDocument): PolicyDiff {
  const now = new Map(current.map((r) => [r.key, r]));
  const next = new Map(proposed.rules.map((r) => [r.key, r]));
  const diff: PolicyDiff = { added: [], removed: [], changed: [], unchanged: 0, loosening: [] };
  for (const rule of proposed.rules) {
    const before = now.get(rule.key);
    if (!before) { diff.added.push(rule); continue; }
    const fields = FIELDS.filter((f) => (before as unknown as Record<string, unknown>)[f] !== rule[f]).map((f) => ({ field: f, from: (before as unknown as Record<string, unknown>)[f], to: rule[f] }));
    if (!fields.length) { diff.unchanged += 1; continue; }
    diff.changed.push({ key: rule.key, fields });
    if (before.blocking && !rule.blocking) diff.loosening.push(`${rule.key}: no longer blocks releases`);
    if (before.enabled && !rule.enabled) diff.loosening.push(`${rule.key}: disabled`);
    if (!before.exceptionAllowed && rule.exceptionAllowed) diff.loosening.push(`${rule.key}: exceptions now allowed`);
    if (before.evidenceRequired && !rule.evidenceRequired) diff.loosening.push(`${rule.key}: evidence no longer required for exceptions`);
  }
  for (const key of now.keys()) if (!next.has(key)) { diff.removed.push(key); diff.loosening.push(`${key}: removed`); }
  diff.removed.sort();
  return diff;
}

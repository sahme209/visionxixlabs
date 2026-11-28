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

/**
 * Release autopilot: agent deploys that policy may allow without a person, only to development or
 * staging (never production) and only for contained changes of at most `maxFiles` files. Turning it on
 * or widening it is a loosening change, so it goes through the same two-person review as any rule.
 */
export const AUTOPILOT_ENVIRONMENTS = ["development", "staging"] as const;
export const autopilotSchema = z.object({
  deploy: z.object({
    environments: z.array(z.enum(AUTOPILOT_ENVIRONMENTS)).min(1).max(2).refine((e) => new Set(e).size === e.length, "list each environment once"),
    maxFiles: z.number().int().min(1).max(50),
  }).strict(),
}).strict();
export type AutopilotSpec = z.infer<typeof autopilotSchema>;
/** Stored form; null when autopilot is off. */
export interface StoredAutopilot { deployEnvironments: string[]; maxFiles: number }

export const policyDocumentSchema = z.object({
  kind: z.literal(POLICY_DOCUMENT_KIND),
  version: z.literal(POLICY_DOCUMENT_VERSION),
  rules: z.array(policyRuleSchema).max(500),
  autopilot: autopilotSchema.optional(),
}).strict().superRefine((doc, ctx) => {
  const seen = new Set<string>();
  doc.rules.forEach((rule, index) => {
    if (seen.has(rule.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rules", index, "key"], message: `duplicate key "${rule.key}"` });
    seen.add(rule.key);
  });
});
export type PolicyDocument = z.infer<typeof policyDocumentSchema>;

interface StoredRule { key: string; label: string; severity: string; blocking: boolean; exceptionAllowed: boolean; approverRole: string | null; evidenceRequired: boolean; enabled: boolean; description: string | null }

/** Normalizes a stored autopilot row: empty or invalid means off. */
export function readStoredAutopilot(row: { deployEnvironments: string[]; maxFiles: number } | null | undefined): StoredAutopilot | null {
  if (!row) return null;
  const envs = [...new Set(row.deployEnvironments.filter((e) => (AUTOPILOT_ENVIRONMENTS as readonly string[]).includes(e)))].sort();
  return envs.length && Number.isInteger(row.maxFiles) && row.maxFiles >= 1 && row.maxFiles <= 50 ? { deployEnvironments: envs, maxFiles: row.maxFiles } : null;
}

/** The stored form a reviewed document asks for (a document without an autopilot section turns it off). */
export function autopilotFromDocument(doc: PolicyDocument): StoredAutopilot | null {
  return doc.autopilot ? { deployEnvironments: [...doc.autopilot.deploy.environments].sort(), maxFiles: doc.autopilot.deploy.maxFiles } : null;
}

/** Canonical, sorted, stable JSON so the same rules always produce the same file (clean Git diffs). */
export function exportPolicyDocument(rules: readonly StoredRule[], autopilot: StoredAutopilot | null = null): string {
  const doc = {
    kind: POLICY_DOCUMENT_KIND,
    version: POLICY_DOCUMENT_VERSION,
    rules: [...rules].sort((a, b) => a.key.localeCompare(b.key)).map((r) => ({
      key: r.key, label: r.label, severity: r.severity, blocking: r.blocking, exceptionAllowed: r.exceptionAllowed,
      approverRole: r.approverRole, evidenceRequired: r.evidenceRequired, enabled: r.enabled, description: r.description,
    })),
    // Only present when on, so workspaces without autopilot keep byte-identical files and digests.
    ...(autopilot ? { autopilot: { deploy: { environments: [...autopilot.deployEnvironments].sort(), maxFiles: autopilot.maxFiles } } } : {}),
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
  /** Changes that loosen governance (blocking turned off, rule disabled or removed, exceptions newly allowed, autopilot widened). */
  loosening: string[];
  /** Release autopilot before and after, when it changes. */
  autopilot?: { from: StoredAutopilot | null; to: StoredAutopilot | null };
}

const FIELDS: Array<keyof PolicyRuleSpec> = ["label", "severity", "blocking", "exceptionAllowed", "approverRole", "evidenceRequired", "enabled", "description"];

export function diffPolicy(current: readonly StoredRule[], proposed: PolicyDocument, currentAutopilot: StoredAutopilot | null = null): PolicyDiff {
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
  const to = autopilotFromDocument(proposed);
  if (JSON.stringify(currentAutopilot) !== JSON.stringify(to)) {
    diff.autopilot = { from: currentAutopilot, to };
    const added = (to?.deployEnvironments ?? []).filter((e) => !(currentAutopilot?.deployEnvironments ?? []).includes(e));
    if (added.length) diff.loosening.push(`release autopilot: agents may deploy contained changes to ${added.join(" and ")} without review`);
    if (to && currentAutopilot && to.maxFiles > currentAutopilot.maxFiles) diff.loosening.push(`release autopilot: allows up to ${to.maxFiles} files (was ${currentAutopilot.maxFiles})`);
  }
  return diff;
}

/** True when the document changes nothing (rules and autopilot). */
export function isPolicyDiffEmpty(diff: PolicyDiff): boolean {
  return !diff.added.length && !diff.changed.length && !diff.removed.length && !diff.autopilot;
}

/** Step 2: SHA-256 of the canonical export, so a request can be applied only to the rules it was reviewed against. */
export async function policyDigest(rules: readonly StoredRule[], autopilot: StoredAutopilot | null = null): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(exportPolicyDocument(rules, autopilot)).digest("hex");
}

export type PolicyApplyOp =
  | { op: "upsert"; rule: PolicyRuleSpec }
  | { op: "disable"; key: string };

/**
 * The writes that make the current rules match a reviewed document. Removed rules are disabled,
 * not deleted, so their history and any recorded violations remain.
 */
export function planPolicyApply(current: readonly StoredRule[], proposed: PolicyDocument): PolicyApplyOp[] {
  const diff = diffPolicy(current, proposed);
  const changedKeys = new Set(diff.changed.map((c) => c.key));
  const byKey = new Map(proposed.rules.map((r) => [r.key, r]));
  const ops: PolicyApplyOp[] = [
    ...diff.added.map((rule) => ({ op: "upsert" as const, rule })),
    ...[...changedKeys].sort().map((key) => ({ op: "upsert" as const, rule: byKey.get(key)! })),
    ...diff.removed.filter((key) => current.find((r) => r.key === key)?.enabled).map((key) => ({ op: "disable" as const, key })),
  ];
  return ops;
}

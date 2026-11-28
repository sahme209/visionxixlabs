/**
 * Workspace runbook library (pure). Versioned procedures for day-2 work: what to do when a deploy
 * fails, during an incident, before a freeze. V19 does not run them in your infrastructure; each step
 * says what a person (or an agent through the gateway) does, and steps that change something name the
 * approval they need. Runbooks can be kept in Git as one file.
 */
import { z } from "zod";
import { forbiddenStepReasons } from "@/lib/runbooks/runbookStepValidator";

export const RUNBOOK_TRIGGERS = ["manual", "incident", "deployment_failed", "freeze", "scheduled"] as const;
export type RunbookTrigger = (typeof RUNBOOK_TRIGGERS)[number];
export const STEP_APPROVALS = ["none", "one_admin", "two_admins"] as const;
export type StepApproval = (typeof STEP_APPROVALS)[number];
export const MAX_RUNBOOKS = 200;

export const TRIGGER_LABEL: Record<RunbookTrigger, string> = { manual: "Run by hand", incident: "During an incident", deployment_failed: "When a deploy fails", freeze: "Before or during a freeze", scheduled: "On a schedule" };
export const APPROVAL_LABEL: Record<StepApproval, string> = { none: "No approval", one_admin: "One admin approves", two_admins: "Two different admins approve" };

const stepSchema = z.object({
  title: z.string().trim().min(1).max(160),
  detail: z.string().max(2000),
  approval: z.enum(STEP_APPROVALS),
}).strict();
export const runbookSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "use lowercase letters, digits and dashes"),
  title: z.string().trim().min(1).max(120),
  trigger: z.enum(RUNBOOK_TRIGGERS),
  steps: z.array(stepSchema).min(1).max(30),
  enabled: z.boolean(),
}).strict();
export type RunbookSpec = z.infer<typeof runbookSchema>;

export function validateRunbook(input: unknown): { ok: true; runbook: RunbookSpec } | { ok: false; errors: string[] } {
  const parsed = runbookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "runbook"}: ${i.message}`) };
  const errors = parsed.data.steps.flatMap((s, i) => forbiddenStepReasons(`${s.title}\n${s.detail}`).map((r) => `steps.${i}: ${r}`));
  return errors.length ? { ok: false, errors } : { ok: true, runbook: parsed.data };
}

/** Steps that need someone's approval, and the strongest approval any step needs. */
export function approvalSummary(r: Pick<RunbookSpec, "steps">): { gated: number; strongest: StepApproval } {
  const gated = r.steps.filter((s) => s.approval !== "none").length;
  const strongest: StepApproval = r.steps.some((s) => s.approval === "two_admins") ? "two_admins" : gated ? "one_admin" : "none";
  return { gated, strongest };
}

export const RUNBOOKS_DOCUMENT_KIND = "v19.runbooks";
const documentSchema = z.object({ kind: z.literal(RUNBOOKS_DOCUMENT_KIND), version: z.literal(1), runbooks: z.array(z.unknown()).max(MAX_RUNBOOKS) }).strict();

/** Canonical file for Git: sorted by key, stable field order. */
export function exportRunbooks(runbooks: readonly RunbookSpec[]): string {
  const sorted = [...runbooks].sort((a, b) => a.key.localeCompare(b.key)).map((r) => ({ key: r.key, title: r.title, trigger: r.trigger, enabled: r.enabled, steps: r.steps.map((s) => ({ title: s.title, detail: s.detail, approval: s.approval })) }));
  return JSON.stringify({ kind: RUNBOOKS_DOCUMENT_KIND, version: 1, runbooks: sorted }, null, 2) + "\n";
}

export function parseRunbooksDocument(text: string): { ok: true; runbooks: RunbookSpec[] } | { ok: false; errors: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ["The file is not valid JSON."] }; }
  const doc = documentSchema.safeParse(raw);
  if (!doc.success) return { ok: false, errors: doc.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "document"}: ${i.message}`) };
  const runbooks: RunbookSpec[] = []; const errors: string[] = []; const seen = new Set<string>();
  doc.data.runbooks.forEach((r, i) => {
    const v = validateRunbook(r);
    if (!v.ok) { errors.push(...v.errors.map((e) => `runbooks.${i}.${e}`)); return; }
    if (seen.has(v.runbook.key)) { errors.push(`runbooks.${i}.key: duplicate key "${v.runbook.key}"`); return; }
    seen.add(v.runbook.key); runbooks.push(v.runbook);
  });
  return errors.length ? { ok: false, errors: errors.slice(0, 20) } : { ok: true, runbooks };
}

export interface RunbooksDiff { added: string[]; changed: string[]; disabled: string[]; unchanged: number; loosening: string[] }
/**
 * What applying a file would change. Runbooks missing from the file are disabled, not deleted, so their
 * history stays. Removing an approval from a step is called out as loosening.
 */
export function diffRunbooks(current: readonly RunbookSpec[], proposed: readonly RunbookSpec[]): RunbooksDiff {
  const now = new Map(current.map((r) => [r.key, r]));
  const next = new Map(proposed.map((r) => [r.key, r]));
  const diff: RunbooksDiff = { added: [], changed: [], disabled: [], unchanged: 0, loosening: [] };
  const rank: Record<StepApproval, number> = { none: 0, one_admin: 1, two_admins: 2 };
  for (const r of proposed) {
    const before = now.get(r.key);
    if (!before) { diff.added.push(r.key); continue; }
    if (exportRunbooks([before]) === exportRunbooks([r])) { diff.unchanged += 1; continue; }
    diff.changed.push(r.key);
    if (rank[approvalSummary(r).strongest] < rank[approvalSummary(before).strongest] || approvalSummary(r).gated < approvalSummary(before).gated) diff.loosening.push(`${r.key}: fewer or weaker approvals`);
  }
  for (const r of current) if (!next.has(r.key) && r.enabled) diff.disabled.push(r.key);
  diff.added.sort(); diff.changed.sort(); diff.disabled.sort();
  return diff;
}

/** Starting points a workspace can copy. */
export const RUNBOOK_TEMPLATES: readonly RunbookSpec[] = [
  { key: "failed-deploy", title: "A deploy failed", trigger: "deployment_failed", enabled: true, steps: [
    { title: "Read the failed run", detail: "Open the deployment in V19 and the CI run it links to. Note the failing step and the commit.", approval: "none" },
    { title: "Check what is live", detail: "Look at the environment's last successful version on the Services page and its health checks.", approval: "none" },
    { title: "Roll back to the last good version", detail: "In the desktop app choose Roll back to the last good version. It is an ordinary deployment, so policy, checks and approvals apply.", approval: "one_admin" },
    { title: "Open an incident if customers were affected", detail: "Report it from Tickets with the release and severity.", approval: "none" },
  ] },
  { key: "incident-freeze", title: "Freeze production during an incident", trigger: "incident", enabled: true, steps: [
    { title: "Freeze production", detail: "On the cockpit Overview choose Deployment freeze, production, a duration and the incident as the reason.", approval: "one_admin" },
    { title: "Tell the team", detail: "Post the freeze and its end time in the incident channel.", approval: "none" },
    { title: "End the freeze when resolved", detail: "Choose End freeze now. The freeze stays on record.", approval: "one_admin" },
  ] },
  { key: "rotate-api-key", title: "Rotate a leaked API key", trigger: "manual", enabled: true, steps: [
    { title: "Revoke the key", detail: "In API keys, revoke the key named in the report. Agents using it stop at once.", approval: "one_admin" },
    { title: "Create a replacement with the same scopes", detail: "Give it a new name and the shortest expiry that works.", approval: "two_admins" },
    { title: "Check the audit log", detail: "In Audit & Security, review what the old key did since the suspected leak.", approval: "none" },
  ] },
];

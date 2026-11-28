/**
 * Deployment step checks (pure kernel). A check is attached to one release stage and is either
 * blocking or advisory. V19 never executes checks: they run in the customer's CI or runners and
 * their results come back as recorded evidence. This module only validates and summarizes.
 */
import { z } from "zod";

export const CHECK_STAGES = ["plan", "validate", "approve", "deploy", "verify", "recover"] as const;
export type CheckStage = (typeof CHECK_STAGES)[number];
export const CHECK_KINDS = ["smoke_test", "health_check", "migration_dry_run", "custom_script", "manual_checklist", "security_scan", "supply_chain", "resilience_experiment", "marketplace_action", "cost_estimate"] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];
export const MAX_CHECKS_PER_WORKSPACE = 200;

const httpsUrl = z.string().max(2000).url().refine((u) => u.startsWith("https://"), "use an https URL");
const repoPath = z.string().min(1).max(300).regex(/^(?!\/)(?!.*\.\.)[A-Za-z0-9._/-]+$/, "use a relative path inside the repository");

/** A GitHub Actions marketplace action pinned to an exact commit, e.g. aquasecurity/trivy-action. */
const actionRef = z.string().min(3).max(200).regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._/-]+)?$/, "use owner/repository or owner/repository/path").refine((v) => !v.includes(".."), "use owner/repository or owner/repository/path");
const actionInput = z.string().trim().max(520).regex(/^[A-Za-z_][A-Za-z0-9_-]{0,63}=[^\r\n]{0,450}$/, "write each input as name=value on its own line").refine((v) => !v.includes("${{"), "expressions are not allowed in inputs");

export const checkSpecSchemas = {
  smoke_test: z.object({ url: httpsUrl, expectStatus: z.number().int().min(100).max(599), maxLatencyMs: z.number().int().min(1).max(120_000) }).strict(),
  health_check: z.object({ metric: z.string().min(1).max(200), comparison: z.enum(["below", "above"]), threshold: z.number().finite(), windowMinutes: z.number().int().min(1).max(1440) }).strict(),
  migration_dry_run: z.object({ workflowPath: repoPath, job: z.string().min(1).max(100) }).strict(),
  custom_script: z.object({ scriptPath: repoPath, runner: z.enum(["github_actions", "customer_runner"]) }).strict(),
  manual_checklist: z.object({ items: z.array(z.string().trim().min(1).max(300)).min(1).max(25) }).strict(),
  marketplace_action: z.object({ action: actionRef, commit: z.string().regex(/^[0-9a-f]{40}$/, "pin the action to a full 40-character commit SHA"), inputs: z.array(actionInput).max(20) }).strict(),
  security_scan: z.object({ tool: z.string().trim().min(1).max(100), maxCritical: z.number().int().min(0).max(10_000), maxHigh: z.number().int().min(0).max(10_000) }).strict(),
  supply_chain: z.object({ evidence: z.enum(["sbom", "slsa_provenance", "sbom_and_provenance"]), verifier: z.string().trim().min(1).max(100) }).strict(),
  resilience_experiment: z.object({ tool: z.string().trim().min(1).max(100), experiment: z.string().trim().min(1).max(200), environmentScope: z.enum(["non_production", "production"]) }).strict(),
  /** Infracost estimates the monthly cost of the infrastructure code at `path`; V19 fails a result whose increase over the previous estimate exceeds the limit. */
  cost_estimate: z.object({ tool: z.literal("infracost"), path: repoPath, maxMonthlyIncreaseUsd: z.number().finite().min(0).max(10_000_000) }).strict(),
} as const;

export const checkInputSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "use lowercase letters, digits and dashes"),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(CHECK_KINDS),
  stage: z.enum(CHECK_STAGES),
  mode: z.enum(["blocking", "advisory"]),
  spec: z.unknown(),
}).strict();

export type CheckInput = z.infer<typeof checkInputSchema>;
export type ValidatedCheck = Omit<CheckInput, "spec"> & { spec: Record<string, unknown> };

export function validateCheck(input: unknown): { ok: true; check: ValidatedCheck } | { ok: false; errors: string[] } {
  const base = checkInputSchema.safeParse(input);
  if (!base.success) return { ok: false, errors: base.error.issues.map((i) => `${i.path.join(".") || "check"}: ${i.message}`) };
  const spec = checkSpecSchemas[base.data.kind].safeParse(base.data.spec);
  if (!spec.success) return { ok: false, errors: spec.error.issues.map((i) => `spec.${i.path.join(".")}: ${i.message}`) };
  // Generated CI files evaluate ${{ }} expressions, so no stored text may contain one.
  const texts = [base.data.name, ...Object.values(spec.data as Record<string, unknown>).flatMap((v) => (Array.isArray(v) ? v : [v]))].filter((v): v is string => typeof v === "string");
  if (texts.some((t) => t.includes("${{"))) return { ok: false, errors: ["check: remove ${{ … }} expressions; check values are inserted into CI files as plain text"] };
  return { ok: true, check: { ...base.data, spec: spec.data as Record<string, unknown> } };
}

export interface StoredCheck { key: string; name: string; kind: CheckKind; stage: CheckStage; mode: "blocking" | "advisory"; enabled: boolean; version: number }
export interface StageCoverage { stage: CheckStage; blocking: number; advisory: number }

/** Per-stage counts of enabled checks, in lifecycle order, plus stages a release passes with nothing attached. */
export function stageCoverage(checks: readonly StoredCheck[]): { stages: StageCoverage[]; uncovered: CheckStage[] } {
  const stages = CHECK_STAGES.map((stage) => ({ stage, blocking: 0, advisory: 0 }));
  for (const c of checks) if (c.enabled) stages[CHECK_STAGES.indexOf(c.stage)][c.mode] += 1;
  return { stages, uncovered: stages.filter((s) => s.blocking + s.advisory === 0).map((s) => s.stage) };
}

export const STAGE_LABEL: Record<CheckStage, string> = { plan: "Plan", validate: "Validate", approve: "Approve", deploy: "Deploy", verify: "Verify", recover: "Recover" };
export const KIND_LABEL: Record<CheckKind, string> = { smoke_test: "Smoke test", health_check: "Health check", migration_dry_run: "Migration dry run", custom_script: "Custom script", manual_checklist: "Manual checklist", security_scan: "Security scan", supply_chain: "Supply-chain evidence", resilience_experiment: "Resilience experiment", marketplace_action: "GitHub Action", cost_estimate: "Cost estimate" };

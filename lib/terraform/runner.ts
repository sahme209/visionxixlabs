/**
 * Legacy Terraform planning refusal and historical apply boundary.
 * Legacy init/validate/plan refuse until a trusted tenant producer exists.
 * The historical apply path keeps its independent default-off kill switch.
 * - sensitive values redacted from stored output
 * - timeout protection on every command
 */

import { prisma } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const COMMAND_TIMEOUT_MS = 120_000; // 2 minutes per command
const APPLY_TIMEOUT_MS = 300_000;   // 5 minutes for apply

const SENSITIVE_PATTERNS = [
  /client_secret\s*=\s*"[^"]*"/gi,
  /password\s*=\s*"[^"]*"/gi,
  /secret\s*=\s*"[^"]*"/gi,
  /access_key\s*=\s*"[^"]*"/gi,
  /private_key\s*=\s*"[^"]*"/gi,
  /token\s*=\s*"[^"]*"/gi,
  /ARM_CLIENT_SECRET=[^\s]*/gi,
  /ARM_ACCESS_KEY=[^\s]*/gi,
  /AWS_SECRET_ACCESS_KEY=[^\s]*/gi,
  /GOOGLE_CREDENTIALS=[^\s]*/gi,
];

function redactSensitive(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const eqIndex = match.indexOf("=");
      if (eqIndex === -1) return "[REDACTED]";
      return match.slice(0, eqIndex + 1) + " [REDACTED]";
    });
  }
  return result;
}

interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runTerraformCommand(
  command: string,
  cwd: string,
  timeoutMs: number = COMMAND_TIMEOUT_MS
): Promise<RunCommandResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: timeoutMs,
      env: { ...process.env, TF_IN_AUTOMATION: "1", TF_INPUT: "0" },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean };
    if (e.killed) {
      return {
        stdout: e.stdout ?? "",
        stderr: `Command timed out after ${timeoutMs / 1000}s`,
        exitCode: 124,
      };
    }
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? String(err),
      exitCode: e.code ?? 1,
    };
  }
}

/** Historical lead/text jobs have no tenant-bound saved-plan producer.
 * These exported helpers deliberately refuse before CLI detection or DB IO.
 * Apply's existing independent kill switch remains below, unchanged. */
export const LEGACY_TERRAFORM_AUTHORITY_CODE = "legacy_terraform_authority_unavailable";
export const LEGACY_TERRAFORM_AUTHORITY_MESSAGE = "Live Terraform planning and approval are unavailable. Generated configuration and historical text output are not a tenant-bound saved plan.";

interface LegacyPlanningRefusal {
  success: false;
  blockedByAuthority: true;
  code: typeof LEGACY_TERRAFORM_AUTHORITY_CODE;
  output: string;
}
function legacyPlanningRefusal(): LegacyPlanningRefusal {
  return { success: false, blockedByAuthority: true, code: LEGACY_TERRAFORM_AUTHORITY_CODE, output: LEGACY_TERRAFORM_AUTHORITY_MESSAGE };
}
export async function terraformInit(jobId: string): Promise<LegacyPlanningRefusal> {
  void jobId;
  return legacyPlanningRefusal();
}
export async function terraformValidate(jobId: string): Promise<LegacyPlanningRefusal> {
  void jobId;
  return legacyPlanningRefusal();
}
export async function terraformPlan(jobId: string): Promise<LegacyPlanningRefusal & { summary: null }> {
  void jobId;
  return { ...legacyPlanningRefusal(), summary: null };
}

export interface TerraformApplyResult {
  success: boolean;
  output: string;
  /** True when apply was refused by the platform kill-switch below, not by
   *  Terraform itself or the job's own approval state. Lets callers audit
   *  this distinctly from a real execution failure. */
  blockedByKillSwitch?: boolean;
}

/**
 * Hard, fail-closed kill-switch for this legacy (pre-Axiom-tenant-model)
 * self-serve "Cloud Operator" apply path.
 *
 * This system has no organization/tenant concept, no role-based
 * authorization, no environment/blast-radius safeguard, and no rollback
 * or recovery evidence — it is gated only by a signed starter token
 * (proves lead ownership) and a typed "CONFIRM APPLY" phrase. That is not
 * sufficient authorization for executing real `terraform apply` against a
 * customer's connected cloud account. Live apply stays OFF
 * (TERRAFORM_LEGACY_APPLY_ENABLED unset/not exactly "true") until it is
 * rebuilt on the canonical tenant/role model and the terraformBoundary.ts
 * safety boundary the rest of the platform already uses. Legacy planning
 * has a separate unconditional authority refusal above, regardless of this flag.
 */
export function legacyApplyEnabled(): boolean {
  return process.env.TERRAFORM_LEGACY_APPLY_ENABLED === "true";
}

export async function terraformApply(jobId: string): Promise<TerraformApplyResult> {
  const job = await prisma.terraformExecutionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (!job.workingDirectory) throw new Error("Job has no working directory");

  if (!legacyApplyEnabled()) {
    return {
      success: false,
      blockedByKillSwitch: true,
      output: "Live apply is temporarily disabled for this self-serve flow pending a security review (no tenant/role authorization model yet). Your plan and approval are saved — contact support to proceed.",
    };
  }

  // Safety: must be approved
  if (!job.approvedAt || !job.approvedBy) {
    return {
      success: false,
      output: "Apply rejected: job has not been approved. Submit CONFIRM APPLY first.",
    };
  }

  // Safety: must have a plan
  if (job.status !== "awaiting_approval" && job.status !== "planned") {
    return {
      success: false,
      output: `Apply rejected: job status is "${job.status}". A successful plan and approval are required before apply.`,
    };
  }

  await prisma.terraformExecutionJob.update({
    where: { id: jobId },
    data: { status: "applying" },
  });

  const result = await runTerraformCommand(
    "terraform apply -auto-approve -no-color",
    job.workingDirectory,
    APPLY_TIMEOUT_MS
  );
  const output = redactSensitive(result.stdout + "\n" + result.stderr);

  if (result.exitCode !== 0) {
    await prisma.terraformExecutionJob.update({
      where: { id: jobId },
      data: { status: "failed", applyOutput: output.slice(0, 50000), errorMessage: output.slice(0, 2000) },
    });
    return { success: false, output };
  }

  await prisma.terraformExecutionJob.update({
    where: { id: jobId },
    data: { status: "succeeded", applyOutput: output.slice(0, 50000) },
  });

  return { success: true, output };
}

export async function getJobStatus(jobId: string) {
  const job = await prisma.terraformExecutionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  return {
    id: job.id,
    // Preserve history without turning old lead/text approval fields into authority.
    evidenceKind: "legacy_text_only" as const,
    approval: "unavailable" as const,
    executionEnabled: false as const,
    status: job.status,
    mode: job.mode,
    primaryCloud: job.primaryCloud,
    secondaryCloud: job.secondaryCloud,
    planSummary: job.planSummary,
    planOutput: job.planOutput ? redactSensitive(job.planOutput) : null,
    applyOutput: job.applyOutput ? redactSensitive(job.applyOutput) : null,
    errorMessage: job.errorMessage,
    approvedAt: job.approvedAt,
    approvedBy: job.approvedBy,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

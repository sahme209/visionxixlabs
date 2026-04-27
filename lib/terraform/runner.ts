/**
 * Terraform Runner — executes terraform CLI commands safely.
 * Phase 4: init, validate, plan, apply with strict safety controls.
 * - plan runs automatically; apply requires prior approval
 * - all output captured and saved to TerraformExecutionJob
 * - sensitive values redacted from stored output
 * - timeout protection on every command
 * - graceful failure if terraform CLI not installed
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

async function isTerraformInstalled(): Promise<boolean> {
  try {
    await execAsync("terraform version", { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
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

function parsePlanSummary(planOutput: string): { add: number; change: number; destroy: number } {
  const match = planOutput.match(
    /Plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/
  );
  if (match) {
    return { add: parseInt(match[1]), change: parseInt(match[2]), destroy: parseInt(match[3]) };
  }
  if (planOutput.includes("No changes.") || planOutput.includes("Your infrastructure matches")) {
    return { add: 0, change: 0, destroy: 0 };
  }
  return { add: -1, change: -1, destroy: -1 };
}

// --- Public API ---

export async function terraformInit(jobId: string): Promise<{ success: boolean; output: string }> {
  const job = await prisma.terraformExecutionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (!job.workingDirectory) throw new Error("Job has no working directory");

  if (!(await isTerraformInstalled())) {
    await prisma.terraformExecutionJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage:
          "Terraform CLI not found. Install from https://developer.hashicorp.com/terraform/downloads",
      },
    });
    return {
      success: false,
      output: "Terraform CLI is not installed. Install it and retry.",
    };
  }

  const result = await runTerraformCommand("terraform init -no-color", job.workingDirectory);
  const output = redactSensitive(result.stdout + "\n" + result.stderr);

  if (result.exitCode !== 0) {
    await prisma.terraformExecutionJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: output.slice(0, 2000) },
    });
    return { success: false, output };
  }

  return { success: true, output };
}

export async function terraformValidate(jobId: string): Promise<{ success: boolean; output: string }> {
  const job = await prisma.terraformExecutionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (!job.workingDirectory) throw new Error("Job has no working directory");

  await prisma.terraformExecutionJob.update({
    where: { id: jobId },
    data: { status: "validating" },
  });

  const result = await runTerraformCommand("terraform validate -no-color", job.workingDirectory);
  const output = redactSensitive(result.stdout + "\n" + result.stderr);

  if (result.exitCode !== 0) {
    await prisma.terraformExecutionJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: output.slice(0, 2000) },
    });
    return { success: false, output };
  }

  return { success: true, output };
}

export async function terraformPlan(jobId: string): Promise<{
  success: boolean;
  output: string;
  summary: { add: number; change: number; destroy: number } | null;
}> {
  const job = await prisma.terraformExecutionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (!job.workingDirectory) throw new Error("Job has no working directory");

  // Init first
  const initResult = await terraformInit(jobId);
  if (!initResult.success) {
    return { success: false, output: initResult.output, summary: null };
  }

  // Validate
  const validateResult = await terraformValidate(jobId);
  if (!validateResult.success) {
    return { success: false, output: validateResult.output, summary: null };
  }

  // Plan
  const result = await runTerraformCommand("terraform plan -no-color", job.workingDirectory);
  const output = redactSensitive(result.stdout + "\n" + result.stderr);

  if (result.exitCode !== 0) {
    await prisma.terraformExecutionJob.update({
      where: { id: jobId },
      data: { status: "failed", planOutput: output.slice(0, 50000), errorMessage: output.slice(0, 2000) },
    });
    return { success: false, output, summary: null };
  }

  const summary = parsePlanSummary(output);

  await prisma.terraformExecutionJob.update({
    where: { id: jobId },
    data: {
      status: "planned",
      planOutput: output.slice(0, 50000),
      planSummary: summary as object,
    },
  });

  return { success: true, output, summary };
}

export async function terraformApply(jobId: string): Promise<{ success: boolean; output: string }> {
  const job = await prisma.terraformExecutionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (!job.workingDirectory) throw new Error("Job has no working directory");

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

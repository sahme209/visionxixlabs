import type { ExecutionPlan } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";
import { generateTerraform } from "./terraformGenerator";
import { generateCLICommands } from "./cliGenerator";
import { simulateDryRun } from "./dryRunSimulator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = "terraform" | "json" | "cli_script";

export type ExportedFile = {
  format: ExportFormat;
  filename: string;
  content: string;
  mimeType: string;
  metadata: ExportMetadata;
  byteSize: number;
};

export type ExportMetadata = {
  generatedAt: string;
  provider: CloudProvider;
  accountId: string;
  actionCount: number;
  estimatedSavings: { monthly: number; yearly: number };
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function exportExecutionPlan(
  plan: ExecutionPlan,
  format: ExportFormat,
): ExportedFile {
  const timestamp = toFileTimestamp(plan.generatedAt);
  const safeName = plan.accountId.replace(/[^a-z0-9-]/gi, "-");

  const metadata: ExportMetadata = {
    generatedAt: plan.generatedAt,
    provider: plan.provider,
    accountId: plan.accountId,
    actionCount: plan.items.length,
    estimatedSavings: plan.totalEstimatedSavings,
    warnings: [],
  };

  const renderer = RENDERERS[format];
  const result = renderer(plan, metadata);

  metadata.warnings = result.warnings;

  const content = result.content;
  const filename = `axiom-plan-${safeName}-${timestamp}${FILE_EXT[format]}`;

  return {
    format,
    filename,
    content,
    mimeType: MIME_TYPES[format],
    metadata,
    byteSize: new TextEncoder().encode(content).length,
  };
}

// Convenience: export all 3 formats at once
export function exportAllFormats(plan: ExecutionPlan): ExportedFile[] {
  return FORMATS.map((format) => exportExecutionPlan(plan, format));
}

// ---------------------------------------------------------------------------
// Format renderers
// ---------------------------------------------------------------------------

type RenderResult = { content: string; warnings: string[] };
type Renderer = (plan: ExecutionPlan, meta: ExportMetadata) => RenderResult;

const FORMATS: ExportFormat[] = ["terraform", "json", "cli_script"];

const RENDERERS: Record<ExportFormat, Renderer> = {
  terraform: renderTerraform,
  json: renderJSON,
  cli_script: renderCLIScript,
};

const FILE_EXT: Record<ExportFormat, string> = {
  terraform: ".tf",
  json: ".json",
  cli_script: ".sh",
};

const MIME_TYPES: Record<ExportFormat, string> = {
  terraform: "text/plain",
  json: "application/json",
  cli_script: "text/x-shellscript",
};

// ---- Terraform ----

function renderTerraform(plan: ExecutionPlan, meta: ExportMetadata): RenderResult {
  const tf = generateTerraform(plan);
  return { content: tf.hcl, warnings: tf.warnings };
}

// ---- JSON ----

function renderJSON(plan: ExecutionPlan, meta: ExportMetadata): RenderResult {
  const dryRun = simulateDryRun(plan);

  const payload = {
    _meta: {
      format: "axiom-execution-plan",
      version: 1,
      generatedAt: meta.generatedAt,
      provider: meta.provider,
      accountId: meta.accountId,
    },
    summary: {
      actionCount: meta.actionCount,
      estimatedSavings: meta.estimatedSavings,
      safeToApply: dryRun.safeToApply,
      downtimeEstimate: dryRun.downtimeEstimate,
      rollbackComplexity: dryRun.rollbackComplexity,
    },
    actions: plan.items.map((item) => ({
      id: item.id,
      actionType: item.actionType,
      provider: item.provider,
      region: item.region,
      resourceIds: item.resourceIds,
      currentState: item.currentState,
      recommendedState: item.recommendedState,
      estimatedSavings: item.estimatedSavings,
      riskLevel: item.riskLevel,
      requiresDowntime: item.requiresDowntime,
      rollbackSteps: item.rollbackSteps,
    })),
    risks: dryRun.risks.map((r) => ({
      itemId: r.itemId,
      severity: r.severity,
      message: r.message,
      mitigation: r.mitigation,
    })),
  };

  const warnings = dryRun.risks
    .filter((r) => r.severity === "high")
    .map((r) => r.message);

  return { content: JSON.stringify(payload, null, 2), warnings };
}

// ---- CLI Script ----

function renderCLIScript(plan: ExecutionPlan, meta: ExportMetadata): RenderResult {
  const cli = generateCLICommands(plan);

  const header = `# Axiom Execution Plan — ${meta.provider.toUpperCase()}
# Account:  ${meta.accountId}
# Generated: ${meta.generatedAt}
# Actions:  ${meta.actionCount}
# Est. savings: $${meta.estimatedSavings.monthly.toLocaleString()}/mo ($${meta.estimatedSavings.yearly.toLocaleString()}/yr)
#
# Make executable: chmod +x <this-file>
# Review every command before running.
`;

  const content = cli.script.replace(/^#!.*\n/, `#!/usr/bin/env bash\n${header}`);
  return { content, warnings: cli.warnings };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFileTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  } catch {
    return Date.now().toString();
  }
}

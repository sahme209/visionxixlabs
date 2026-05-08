import type { CloudSnapshot, CloudProvider } from "./cloudSnapshot";
import type { CostSummary } from "./costSignals";
import type { ExecutionPlan, ExecutionPlanItem, ActionType } from "./executionPlan";
import type { TerraformOutput } from "./terraformGenerator";
import type { CLIOutput } from "./cliGenerator";
import type { DryRunResult } from "./dryRunSimulator";

import { deriveCostSignals } from "./costSignals";
import { generateExecutionPlan } from "./executionPlan";
import { generateTerraform } from "./terraformGenerator";
import { generateCLICommands } from "./cliGenerator";
import { simulateDryRun } from "./dryRunSimulator";

// ---------------------------------------------------------------------------
// Flow steps — the user progresses through these in order
// ---------------------------------------------------------------------------

export type FlowStep = "plan" | "preview" | "export";

// ---------------------------------------------------------------------------
// Step 1: "View Full Plan" — shows what we found and what we recommend
// ---------------------------------------------------------------------------

export type PlanStepData = {
  step: "plan";
  provider: CloudProvider;
  accountId: string;
  costSummary: CostSummary;
  executionPlan: ExecutionPlan;
  actionBreakdown: ActionBreakdown[];
  totalSavings: { monthly: number; yearly: number };
  regionCount: number;
  resourceCount: number;
};

export type ActionBreakdown = {
  actionType: ActionType;
  label: string;
  itemCount: number;
  resourceCount: number;
  monthlySavings: number;
  riskLevel: string;
  requiresDowntime: boolean;
};

// ---------------------------------------------------------------------------
// Step 2: "Preview Changes" — shows exactly what will happen
// ---------------------------------------------------------------------------

export type PreviewStepData = {
  step: "preview";
  terraform: TerraformOutput;
  cli: CLIOutput;
  dryRun: DryRunResult;
  safeToApply: boolean;
  highRiskCount: number;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Step 3: "Export / Apply" — user picks an output format
// ---------------------------------------------------------------------------

export type ExportFormat = "terraform" | "cli_script" | "json_plan";

export type ExportStepData = {
  step: "export";
  availableFormats: ExportFormatOption[];
  selectedFormat: ExportFormat | null;
  exportedContent: string | null;
  filename: string | null;
  acknowledgedRisks: boolean;
};

export type ExportFormatOption = {
  format: ExportFormat;
  label: string;
  description: string;
  filename: string;
};

// ---------------------------------------------------------------------------
// Unified flow state — holds everything accumulated across steps
// ---------------------------------------------------------------------------

export type ApplyFlowState = {
  currentStep: FlowStep;
  snapshot: CloudSnapshot;
  plan: PlanStepData | null;
  preview: PreviewStepData | null;
  export: ExportStepData | null;
  startedAt: string;
  completedSteps: FlowStep[];
};

// ---------------------------------------------------------------------------
// Flow controller — pure functions, no side effects
// ---------------------------------------------------------------------------

export function initializeFlow(snapshot: CloudSnapshot): ApplyFlowState {
  return {
    currentStep: "plan",
    snapshot,
    plan: null,
    preview: null,
    export: null,
    startedAt: new Date().toISOString(),
    completedSteps: [],
  };
}

// Step 1: Generate the plan from a snapshot
export function buildPlanStep(state: ApplyFlowState): ApplyFlowState {
  const snapshot = state.snapshot;
  const costSummary = deriveCostSignals(snapshot);
  const executionPlan = generateExecutionPlan(snapshot);

  const actionBreakdown = buildActionBreakdown(executionPlan);

  const planData: PlanStepData = {
    step: "plan",
    provider: snapshot.provider,
    accountId: snapshot.accountId,
    costSummary,
    executionPlan,
    actionBreakdown,
    totalSavings: executionPlan.totalEstimatedSavings,
    regionCount: snapshot.regions.length,
    resourceCount: snapshot.resources.length,
  };

  return {
    ...state,
    currentStep: "plan",
    plan: planData,
    completedSteps: addStep(state.completedSteps, "plan"),
  };
}

// Step 2: Generate previews from the plan
export function buildPreviewStep(state: ApplyFlowState): ApplyFlowState {
  if (!state.plan) {
    throw new Error("Cannot preview without a plan. Call buildPlanStep first.");
  }

  const { executionPlan } = state.plan;
  const terraform = generateTerraform(executionPlan);
  const cli = generateCLICommands(executionPlan);
  const dryRun = simulateDryRun(executionPlan);

  const allWarnings = deduplicateWarnings([
    ...terraform.warnings,
    ...cli.warnings,
    ...dryRun.risks.filter((r) => r.severity === "high").map((r) => r.message),
  ]);

  const previewData: PreviewStepData = {
    step: "preview",
    terraform,
    cli,
    dryRun,
    safeToApply: dryRun.safeToApply,
    highRiskCount: dryRun.risks.filter((r) => r.severity === "high").length,
    warnings: allWarnings,
  };

  return {
    ...state,
    currentStep: "preview",
    preview: previewData,
    completedSteps: addStep(state.completedSteps, "preview"),
  };
}

// Step 3: Prepare the export
export function buildExportStep(
  state: ApplyFlowState,
  acknowledgedRisks: boolean,
): ApplyFlowState {
  if (!state.plan || !state.preview) {
    throw new Error("Cannot export without plan and preview. Complete prior steps first.");
  }

  const provider = state.plan.provider;
  const accountId = state.plan.accountId;
  const safeName = accountId.replace(/[^a-z0-9-]/gi, "-");

  const formats: ExportFormatOption[] = [
    {
      format: "terraform",
      label: "Terraform (.tf)",
      description: "Infrastructure-as-code file — run with terraform plan + apply",
      filename: `axiom-optimization-${safeName}.tf`,
    },
    {
      format: "cli_script",
      label: "Shell Script (.sh)",
      description: `Copy-paste ${provider.toUpperCase()} CLI commands — review and run manually`,
      filename: `axiom-optimization-${safeName}.sh`,
    },
    {
      format: "json_plan",
      label: "JSON Plan (.json)",
      description: "Machine-readable execution plan — integrate with CI/CD pipelines",
      filename: `axiom-optimization-${safeName}.json`,
    },
  ];

  const exportData: ExportStepData = {
    step: "export",
    availableFormats: formats,
    selectedFormat: null,
    exportedContent: null,
    filename: null,
    acknowledgedRisks,
  };

  return {
    ...state,
    currentStep: "export",
    export: exportData,
    completedSteps: addStep(state.completedSteps, "export"),
  };
}

// Select a format and produce the final content
export function selectExportFormat(
  state: ApplyFlowState,
  format: ExportFormat,
): ApplyFlowState {
  if (!state.plan || !state.preview || !state.export) {
    throw new Error("Flow not ready for format selection.");
  }

  if (!state.export.acknowledgedRisks && !state.preview.safeToApply) {
    throw new Error("User must acknowledge risks before exporting a plan with high-risk items.");
  }

  const content = renderExport(format, state);
  const formatOption = state.export.availableFormats.find((f) => f.format === format);

  return {
    ...state,
    export: {
      ...state.export,
      selectedFormat: format,
      exportedContent: content,
      filename: formatOption?.filename ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Navigation guards — can the user move to this step?
// ---------------------------------------------------------------------------

export function canAdvanceTo(state: ApplyFlowState, target: FlowStep): boolean {
  switch (target) {
    case "plan":
      return true;
    case "preview":
      return state.plan !== null && state.plan.executionPlan.items.length > 0;
    case "export":
      return state.preview !== null;
  }
}

export function getBlockingReason(state: ApplyFlowState, target: FlowStep): string | null {
  switch (target) {
    case "plan":
      return null;
    case "preview":
      if (!state.plan) return "Generate a plan first.";
      if (state.plan.executionPlan.items.length === 0) return "No actionable optimizations found.";
      return null;
    case "export":
      if (!state.preview) return "Preview changes before exporting.";
      return null;
  }
}

// ---------------------------------------------------------------------------
// Summary for each step — what to show the user at a glance
// ---------------------------------------------------------------------------

export function getPlanSummary(state: ApplyFlowState): string | null {
  if (!state.plan) return null;
  const p = state.plan;
  return [
    `${p.executionPlan.items.length} optimization${p.executionPlan.items.length === 1 ? "" : "s"} found`,
    `across ${p.regionCount} region${p.regionCount === 1 ? "" : "s"}`,
    `covering ${p.resourceCount} resource${p.resourceCount === 1 ? "" : "s"}`,
    `— est. savings: $${p.totalSavings.monthly.toLocaleString()}/mo ($${p.totalSavings.yearly.toLocaleString()}/yr)`,
  ].join(" ");
}

export function getPreviewSummary(state: ApplyFlowState): string | null {
  if (!state.preview) return null;
  const d = state.preview.dryRun;
  const parts = [d.summary];
  if (d.downtimeEstimate) parts.push(`Downtime: ${d.downtimeEstimate}`);
  parts.push(`Rollback complexity: ${d.rollbackComplexity}`);
  return parts.join(" | ");
}

export function getExportSummary(state: ApplyFlowState): string | null {
  if (!state.export?.selectedFormat) return null;
  const e = state.export;
  return `Ready to download: ${e.filename} (${e.selectedFormat})`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<ActionType, string> = {
  resize_compute: "Compute right-sizing",
  apply_storage_policy: "Storage lifecycle tiering",
  purchase_commitment: "Commitment plan (manual)",
  decommission_compute: "Decommission stopped instances",
  restrict_public_access: "Restrict public storage access",
  enable_backup: "Enable automated backup",
};

function buildActionBreakdown(plan: ExecutionPlan): ActionBreakdown[] {
  const groups = new Map<ActionType, ExecutionPlanItem[]>();
  for (const item of plan.items) {
    const group = groups.get(item.actionType);
    if (group) group.push(item);
    else groups.set(item.actionType, [item]);
  }

  const breakdown: ActionBreakdown[] = [];
  for (const [actionType, items] of groups) {
    const totalResources = items.reduce((s, i) => s + i.resourceIds.length, 0);
    const monthlySavings = items.reduce((s, i) => s + i.estimatedSavings.monthly, 0);
    const worstRisk = items.reduce<string>((worst, i) => {
      const rank = { low: 0, medium: 1, high: 2 };
      return rank[i.riskLevel] > rank[worst as keyof typeof rank] ? i.riskLevel : worst;
    }, "low");
    const anyDowntime = items.some((i) => i.requiresDowntime);

    breakdown.push({
      actionType,
      label: ACTION_LABELS[actionType],
      itemCount: items.length,
      resourceCount: totalResources,
      monthlySavings,
      riskLevel: worstRisk,
      requiresDowntime: anyDowntime,
    });
  }

  return breakdown.sort((a, b) => b.monthlySavings - a.monthlySavings);
}

function renderExport(format: ExportFormat, state: ApplyFlowState): string {
  switch (format) {
    case "terraform":
      return state.preview!.terraform.hcl;
    case "cli_script":
      return state.preview!.cli.script;
    case "json_plan":
      return JSON.stringify(
        {
          generatedAt: state.plan!.executionPlan.generatedAt,
          provider: state.plan!.provider,
          accountId: state.plan!.accountId,
          totalSavings: state.plan!.totalSavings,
          actions: state.plan!.executionPlan.items,
          dryRun: {
            safeToApply: state.preview!.dryRun.safeToApply,
            downtimeEstimate: state.preview!.dryRun.downtimeEstimate,
            rollbackComplexity: state.preview!.dryRun.rollbackComplexity,
            risks: state.preview!.dryRun.risks,
          },
        },
        null,
        2,
      );
  }
}

function addStep(steps: FlowStep[], step: FlowStep): FlowStep[] {
  if (steps.includes(step)) return steps;
  return [...steps, step];
}

function deduplicateWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}

/**
 * Axiom Workflow Executor — automatically runs safe (read-only) plan steps in sequence.
 * Pauses at destructive steps for user confirmation.
 */

import { READ_ONLY_PLUGINS, DESTRUCTIVE_PLUGINS } from "./intentToPluginMap";
import { runExecutionPlugin } from "./axiomAssistantTools";
import type { ToolContext } from "./axiomAssistantTools";
import type { DevOpsPlan, DevOpsPlanStep } from "./axiomAssistantAgent";

export type WorkflowStepResult = {
  stepIndex: number;
  action: string;
  pluginId?: string;
  ok: boolean;
  summary?: string;
  error?: string;
  executionId?: string;
};

export type WorkflowExecutionResult = {
  /** Steps that were executed (read-only only) */
  executedSteps: WorkflowStepResult[];
  /** Index at which execution stopped (destructive step or failure) */
  stoppedAtStepIndex: number | null;
  /** Remaining plan steps (including the destructive one we paused at) */
  remainingPlan: DevOpsPlan | null;
  /** Human-readable summary for chat */
  summary: string;
  /** Whether we hit a destructive step and need user confirmation */
  awaitsConfirmation: boolean;
  /** Suggested confirmation message when awaitsConfirmation is true */
  confirmationPrompt?: string;
};

const VALID_RUN_PLUGIN_IDS = new Set([
  "aws:iam-exposure-scan",
  "aws:disable-unused-access-key",
  "aws:infra-discovery",
  "aws:cost-explorer-summary",
  "aws:s3-public-bucket-scan",
  "github:create-cicd-pipeline",
]);

function isReadOnlyPlugin(pluginId: string): boolean {
  return READ_ONLY_PLUGINS.has(pluginId);
}

function isDestructivePlugin(pluginId: string): boolean {
  return DESTRUCTIVE_PLUGINS.has(pluginId);
}

/**
 * Execute workflow: run read-only plugins automatically, stop at destructive steps.
 * ExecutionLog entries are created by runExecutionPlugin (via pluginEngine).
 * Architecture graph is updated after aws:infra-discovery (handled in axiomAssistantTools).
 */
export async function executeWorkflow(
  plan: DevOpsPlan,
  ctx: ToolContext
): Promise<WorkflowExecutionResult> {
  const executedSteps: WorkflowStepResult[] = [];
  let stoppedAtStepIndex: number | null = null;
  let remainingPlan: DevOpsPlan | null = null;
  let awaitsConfirmation = false;
  let confirmationPrompt: string | undefined;

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i] as DevOpsPlanStep;

    if (step.action === "run_plugin" && step.pluginId) {
      const pluginId = step.pluginId;

      if (!VALID_RUN_PLUGIN_IDS.has(pluginId)) {
        executedSteps.push({
          stepIndex: i + 1,
          action: "run_plugin",
          pluginId,
          ok: false,
          error: `Unknown plugin: ${pluginId}`,
        });
        stoppedAtStepIndex = i;
        break;
      }

      if (isDestructivePlugin(pluginId)) {
        stoppedAtStepIndex = i;
        remainingPlan = {
          goal: plan.goal,
          steps: plan.steps.slice(i),
        };
        awaitsConfirmation = true;
        confirmationPrompt =
          pluginId === "aws:disable-unused-access-key"
            ? "I found unused IAM keys. Confirm if I should disable them."
            : `I need your confirmation to run: ${pluginId}. Type CONFIRM APPLY to proceed.`;
        break;
      }

      if (!isReadOnlyPlugin(pluginId)) {
        // Non-read-only, non-destructive (e.g. github:create-cicd-pipeline) — require confirmation
        stoppedAtStepIndex = i;
        remainingPlan = { goal: plan.goal, steps: plan.steps.slice(i) };
        awaitsConfirmation = true;
        confirmationPrompt = `I need your confirmation to run: ${pluginId}. Type CONFIRM APPLY to proceed.`;
        break;
      }

      try {
        const result = await runExecutionPlugin(
          ctx,
          pluginId,
          step.input ?? {},
          { dryRun: true, apply: false }
        );

        executedSteps.push({
          stepIndex: i + 1,
          action: "run_plugin",
          pluginId,
          ok: result.ok,
          summary: result.ok
            ? (result.data?.resultSummary as string) ?? "Done"
            : undefined,
          error: result.ok ? undefined : (result.error ?? "Plugin failed"),
          executionId: result.data?.executionId as string | undefined,
        });

        if (!result.ok) {
          stoppedAtStepIndex = i;
          remainingPlan = { goal: plan.goal, steps: plan.steps.slice(i + 1) };
          break;
        }
      } catch (e) {
        executedSteps.push({
          stepIndex: i + 1,
          action: "run_plugin",
          pluginId,
          ok: false,
          error: e instanceof Error ? e.message : "Plugin execution failed",
        });
        stoppedAtStepIndex = i;
        remainingPlan = { goal: plan.goal, steps: plan.steps.slice(i + 1) };
        break;
      }
    } else {
      // generate_report, run_analysis, view_execution_history, export_report — don't auto-run
      stoppedAtStepIndex = i;
      remainingPlan = { goal: plan.goal, steps: plan.steps.slice(i) };
      awaitsConfirmation = true;
      confirmationPrompt = `Next step: ${step.action}. I've completed the read-only scans. Confirm if you'd like me to proceed with the remaining steps.`;
      break;
    }
  }

  const successCount = executedSteps.filter((s) => s.ok).length;
  const totalExecuted = executedSteps.length;

  let summary: string;
  if (executedSteps.length === 0 && awaitsConfirmation) {
    summary = "No read-only steps to run. The first step requires confirmation.";
  } else if (awaitsConfirmation && successCount > 0) {
    summary = `Completed ${successCount} read-only step(s). ${confirmationPrompt ?? ""}`;
  } else if (successCount === totalExecuted && !awaitsConfirmation) {
    summary = `Completed all ${totalExecuted} step(s).`;
  } else if (successCount > 0) {
    const lastErr = executedSteps.find((s) => !s.ok);
    summary = `Completed ${successCount}/${totalExecuted} steps. ${lastErr?.error ?? "Workflow stopped."}`;
  } else {
    const firstErr = executedSteps[0];
    summary = firstErr?.error ?? "Workflow failed.";
  }

  return {
    executedSteps,
    stoppedAtStepIndex,
    remainingPlan,
    summary,
    awaitsConfirmation,
    confirmationPrompt,
  };
}

/**
 * Axiom — plugin execution layer for cloud fix execution.
 * Scan → generate fix plan → execute via plugins (with user approval toggle).
 * Delegates to execution engine for validation, logging, and error recovery.
 */

import { execute } from "@/lib/execution/engine";
import type { ExecutionAction } from "@/lib/execution/types";

export type FixAction = {
  id: string;
  pluginId: string;
  action: string;
  params: Record<string, unknown>;
  approvalRequired: boolean;
  description?: string;
  rollbackSteps?: string[];
};

export type ExecuteFixOptions = {
  userId: string;
  projectId?: string;
  leadId?: string;
  actions: FixAction[];
  approvedActionIds: string[];
  userPlan?: string | null;
};

export type ExecuteFixResult = {
  executed: Array<{
    actionId: string;
    pluginId: string;
    success: boolean;
    data?: unknown;
    error?: string;
    executionLogId?: string;
  }>;
  skipped: Array<{ actionId: string; reason: string }>;
};

/**
 * Execute approved fix actions via execution engine.
 * Logs actions, supports rollback, requires explicit user confirmation for destructive actions.
 */
export async function executeFixes(opts: ExecuteFixOptions): Promise<ExecuteFixResult> {
  const approved = new Set(opts.approvedActionIds);
  const skipped: ExecuteFixResult["skipped"] = [];
  const toExecute: ExecutionAction[] = [];

  for (const action of opts.actions) {
    if (action.approvalRequired && !approved.has(action.id)) {
      skipped.push({ actionId: action.id, reason: "Not approved by user" });
      continue;
    }
    toExecute.push({
      id: action.id,
      pluginId: action.pluginId,
      action: action.action,
      params: action.params,
      approvalRequired: action.approvalRequired,
      description: action.description,
      rollbackSteps: action.rollbackSteps,
    });
  }

  if (toExecute.length === 0) {
    return { executed: [], skipped };
  }

  const { results } = await execute(
    {
      context: {
        userId: opts.userId,
        projectId: opts.projectId,
        leadId: opts.leadId,
        credentialsKey: opts.leadId ?? undefined,
      },
      actions: toExecute,
      approvedActionIds: opts.approvedActionIds,
    },
    opts.userPlan ?? null,
    "axiom"
  );

  return {
    executed: results.map((r) => ({
      actionId: r.actionId,
      pluginId: r.pluginId,
      success: r.success,
      data: r.data,
      error: r.error,
      executionLogId: r.executionLogId,
    })),
    skipped,
  };
}

/** Map recommended improvement text to FixAction (plugin inferred from hostingProvider). */
export function improvementToFixAction(
  improvement: string,
  index: number,
  hostingProvider: string
): FixAction {
  const provider = hostingProvider.toLowerCase();
  const pluginId =
    provider.includes("aws") ? "aws"
    : provider.includes("azure") ? "azure"
    : provider.includes("gcp") || provider.includes("google") ? "gcp"
    : "aws";
  return {
    id: `fix-${index}-${Date.now()}`,
    pluginId,
    action: "remediate",
    params: { improvementText: improvement },
    approvalRequired: true,
    description: improvement,
    rollbackSteps: ["Revert changes via cloud console", "Restore from backup if applicable"],
  };
}

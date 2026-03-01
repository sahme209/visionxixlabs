/**
 * Execution Engine — validates permissions, calls cloud APIs, logs actions, handles error recovery.
 * All cloud actions require explicit user authorization.
 */

import { prisma } from "@/lib/db";
import { getPlugin } from "@/lib/plugins";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import type { ExecutionAction, ExecutionContext, ExecutionResult } from "./types";

export type ExecuteOptions = {
  context: ExecutionContext;
  actions: ExecutionAction[];
  approvedActionIds: string[];
  /** Skip plan check when user explicitly authorized (e.g. Builder cloud services) */
  skipPlanCheck?: boolean;
};

export type ExecuteEngineResult = {
  results: ExecutionResult[];
  executionLogIds: string[];
};

function validatePermissions(
  userPlan: string | null | undefined,
  actions: ExecutionAction[],
  source: "builder" | "axiom",
  opts?: { skipPlanCheck?: boolean }
): { ok: true } | { ok: false; error: string } {
  if (!opts?.skipPlanCheck) {
    const ent = getEntitlementsFromPlan(userPlan);
    if (source === "axiom" && !ent.axiomExecution) {
      return { ok: false, error: "Scale or Enterprise plan required for Axiom execution" };
    }
    if (source === "builder" && !ent.builder) {
      return { ok: false, error: "Builder access required" };
    }
  }
  return { ok: true };
}

async function logExecution(
  userId: string,
  projectId: string | undefined,
  leadId: string | undefined,
  action: ExecutionAction,
  status: "pending" | "success" | "failed",
  result?: unknown,
  error?: string
): Promise<string> {
  const log = await prisma.executionLog.create({
    data: {
      userId,
      projectId: projectId ?? null,
      leadId: leadId ?? null,
      action: action.action,
      pluginId: action.pluginId,
      status,
      params: JSON.parse(JSON.stringify(action.params ?? {})),
      result: result != null ? JSON.parse(JSON.stringify(result)) : undefined,
      error: error ?? null,
      rollbackSteps: action.rollbackSteps ?? [],
    },
  });
  return log.id;
}

/**
 * Execute actions via execution engine.
 * Validates permissions from User.plan, requires explicit approval for destructive actions, logs all executions.
 */
export async function execute(
  opts: ExecuteOptions,
  userPlan: string | null | undefined,
  source: "builder" | "axiom"
): Promise<ExecuteEngineResult> {
  const { context, actions, approvedActionIds } = opts;
  const approved = new Set(approvedActionIds);

  const perm = validatePermissions(
    userPlan,
    actions,
    source,
    { skipPlanCheck: opts.skipPlanCheck }
  );
  if (!perm.ok) {
    throw new Error(perm.error);
  }

  const results: ExecutionResult[] = [];
  const executionLogIds: string[] = [];

  for (const action of actions) {
    if (action.approvalRequired && !approved.has(action.id)) {
      results.push({
        success: false,
        actionId: action.id,
        pluginId: action.pluginId,
        error: "Not approved by user",
      });
      continue;
    }

    const plugin = getPlugin(action.pluginId);
    if (!plugin) {
      results.push({
        success: false,
        actionId: action.id,
        pluginId: action.pluginId,
        error: `Plugin ${action.pluginId} not found`,
      });
      continue;
    }

    let logId: string | undefined;
    try {
      const pluginResult = await plugin.execute({
        userId: context.userId,
        projectId: context.projectId,
        params: { action: action.action, ...action.params },
        credentialsKey: context.credentialsKey,
      });

      if (pluginResult.ok) {
        logId = await logExecution(
          context.userId,
          context.projectId,
          context.leadId,
          action,
          "success",
          pluginResult.data
        );
        executionLogIds.push(logId);
        results.push({
          success: true,
          actionId: action.id,
          pluginId: action.pluginId,
          data: pluginResult.data,
          executionLogId: logId,
        });
      } else {
        logId = await logExecution(
          context.userId,
          context.projectId,
          context.leadId,
          action,
          "failed",
          undefined,
          pluginResult.error
        );
        executionLogIds.push(logId);
        results.push({
          success: false,
          actionId: action.id,
          pluginId: action.pluginId,
          error: pluginResult.error,
          executionLogId: logId,
        });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      try {
        logId = await logExecution(
          context.userId,
          context.projectId,
          context.leadId,
          action,
          "failed",
          undefined,
          errMsg
        );
        executionLogIds.push(logId);
      } catch {
        // log failure — non-fatal
      }
      results.push({
        success: false,
        actionId: action.id,
        pluginId: action.pluginId,
        error: errMsg,
        executionLogId: logId,
      });
    }
  }

  return { results, executionLogIds };
}

/**
 * Get execution log by id (for rollback info).
 */
export async function getExecutionLog(logId: string) {
  return prisma.executionLog.findUnique({
    where: { id: logId },
  });
}

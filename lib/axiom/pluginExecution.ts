/**
 * Axiom — plugin execution layer for cloud fix execution.
 * Scan → generate fix plan → execute via plugins (with user approval toggle).
 */

import { getPlugin } from "@/lib/plugins";
import type { PluginExecuteResult } from "@/lib/plugins";

export type FixAction = {
  id: string;
  pluginId: string;
  action: string;
  params: Record<string, unknown>;
  approvalRequired: boolean;
  description?: string;
};

export type ExecuteFixOptions = {
  userId: string;
  projectId?: string;
  actions: FixAction[];
  approvedActionIds?: string[];
};

export type ExecuteFixResult = {
  executed: Array<{ actionId: string; pluginId: string; result: PluginExecuteResult }>;
  skipped: Array<{ actionId: string; reason: string }>;
};

/**
 * Execute approved fix actions via plugin layer.
 * Only actions in approvedActionIds (or with approvalRequired=false) are executed.
 */
export async function executeFixes(opts: ExecuteFixOptions): Promise<ExecuteFixResult> {
  const executed: ExecuteFixResult["executed"] = [];
  const skipped: ExecuteFixResult["skipped"] = [];
  const approved = new Set(opts.approvedActionIds ?? []);

  for (const action of opts.actions) {
    const plugin = getPlugin(action.pluginId);
    if (!plugin) {
      skipped.push({ actionId: action.id, reason: `Plugin ${action.pluginId} not found` });
      continue;
    }
    if (action.approvalRequired && !approved.has(action.id)) {
      skipped.push({ actionId: action.id, reason: "Not approved by user" });
      continue;
    }

    const result = await plugin.execute({
      userId: opts.userId,
      projectId: opts.projectId,
      params: { action: action.action, ...action.params },
    });
    executed.push({ actionId: action.id, pluginId: action.pluginId, result });
  }

  return { executed, skipped };
}

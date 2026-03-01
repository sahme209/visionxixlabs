/**
 * Execution plugin registry — registers plugins for Axiom automation.
 * Use getExecutionPlugin / listExecutionPlugins for run/scan flows.
 * Placeholder plugins hidden unless ENABLE_PLACEHOLDER_PLUGINS=true.
 */

import type { ExecutionPlugin } from "./types";
import { ENABLE_PLACEHOLDER_PLUGINS } from "@/lib/featureFlags";

const PLACEHOLDER_EXECUTION_PLUGIN_IDS = new Set([
  "aws:cost-explorer-summary",
]);

const executionPlugins = new Map<string, ExecutionPlugin>();

export function registerExecutionPlugin(plugin: ExecutionPlugin): void {
  executionPlugins.set(plugin.id, plugin);
}

function isPlaceholderExecutionPlugin(id: string): boolean {
  return PLACEHOLDER_EXECUTION_PLUGIN_IDS.has(id);
}

export function getExecutionPlugin(id: string): ExecutionPlugin | undefined {
  const p = executionPlugins.get(id);
  if (!p) return undefined;
  if (!ENABLE_PLACEHOLDER_PLUGINS && isPlaceholderExecutionPlugin(p.id)) return undefined;
  return p;
}

export function listExecutionPlugins(): ExecutionPlugin[] {
  const all = Array.from(executionPlugins.values());
  if (ENABLE_PLACEHOLDER_PLUGINS) return all;
  return all.filter((p) => !isPlaceholderExecutionPlugin(p.id));
}

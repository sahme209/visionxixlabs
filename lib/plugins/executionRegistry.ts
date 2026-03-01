/**
 * Execution plugin registry — registers plugins for Axiom automation.
 * Use getExecutionPlugin / listExecutionPlugins for run/scan flows.
 */

import type { ExecutionPlugin } from "./types";

const executionPlugins = new Map<string, ExecutionPlugin>();

export function registerExecutionPlugin(plugin: ExecutionPlugin): void {
  executionPlugins.set(plugin.id, plugin);
}

export function getExecutionPlugin(id: string): ExecutionPlugin | undefined {
  return executionPlugins.get(id);
}

export function listExecutionPlugins(): ExecutionPlugin[] {
  return Array.from(executionPlugins.values());
}

/**
 * Plugin registry — register, list, get by id.
 * Placeholder plugins are hidden unless ENABLE_PLACEHOLDER_PLUGINS=true.
 */

import type { PluginDefinition } from "./types";
import { ENABLE_PLACEHOLDER_PLUGINS } from "@/lib/featureFlags";

const PLACEHOLDER_PLUGIN_IDS = new Set([
  "analytics",
  "domain-dns",
  "deployment",
  "aws",
  "azure",
  "gcp",
]);

const plugins = new Map<string, PluginDefinition>();

export function registerPlugin(plugin: PluginDefinition): void {
  plugins.set(plugin.id, plugin);
}

function isPlaceholderPlugin(id: string): boolean {
  return PLACEHOLDER_PLUGIN_IDS.has(id);
}

export function getPlugin(id: string): PluginDefinition | undefined {
  const p = plugins.get(id);
  if (!p) return undefined;
  if (!ENABLE_PLACEHOLDER_PLUGINS && isPlaceholderPlugin(p.id)) return undefined;
  return p;
}

export function listPlugins(): PluginDefinition[] {
  const all = Array.from(plugins.values());
  if (ENABLE_PLACEHOLDER_PLUGINS) return all;
  return all.filter((p) => !isPlaceholderPlugin(p.id));
}

export function listPluginsForTrack(track: "builder" | "axiom"): PluginDefinition[] {
  return listPlugins().filter((p) => p.productTracks.includes(track));
}

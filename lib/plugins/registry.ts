/**
 * Plugin registry — register, list, get by id.
 */

import type { PluginDefinition } from "./types";

const plugins = new Map<string, PluginDefinition>();

export function registerPlugin(plugin: PluginDefinition): void {
  plugins.set(plugin.id, plugin);
}

export function getPlugin(id: string): PluginDefinition | undefined {
  return plugins.get(id);
}

export function listPlugins(): PluginDefinition[] {
  return Array.from(plugins.values());
}

export function listPluginsForTrack(track: "builder" | "axiom"): PluginDefinition[] {
  return listPlugins().filter((p) => p.productTracks.includes(track));
}

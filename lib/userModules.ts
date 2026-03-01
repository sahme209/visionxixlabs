/**
 * User modules — tracks which product add-ons are enabled.
 * Chatbot is an add-on flag, not standalone.
 * - Builder track + chatbot → chatbot attaches to website
 * - Axiom track + chatbot → AI Ops Assistant
 * Plugins: feature-flag controlled, paid add-ons, linked to subscription tier.
 */

export type UserModules = {
  builder?: boolean;
  axiom?: boolean;
  chatbot?: boolean;
  /** Plugin IDs the user has enabled (e.g. ["aws","analytics"]) */
  plugins?: string[];
};

export function parseUserModules(modules: unknown): UserModules {
  if (!modules || typeof modules !== "object") {
    return { builder: false, axiom: false, chatbot: false, plugins: [] };
  }
  const m = modules as Record<string, unknown>;
  const plugins = Array.isArray(m.plugins) ? (m.plugins as string[]).filter((p) => typeof p === "string") : [];
  return {
    builder: Boolean(m.builder),
    axiom: Boolean(m.axiom),
    chatbot: Boolean(m.chatbot),
    plugins,
  };
}

export function hasBuilderModule(modules: unknown): boolean {
  return parseUserModules(modules).builder ?? false;
}

export function hasAxiomModule(modules: unknown): boolean {
  return parseUserModules(modules).axiom ?? false;
}

export function hasChatbotModule(modules: unknown): boolean {
  return parseUserModules(modules).chatbot ?? false;
}

export function getUserPlugins(modules: unknown): string[] {
  return parseUserModules(modules).plugins ?? [];
}

export function hasPlugin(modules: unknown, pluginId: string): boolean {
  return getUserPlugins(modules).includes(pluginId);
}

/**
 * User modules — tracks which product add-ons are enabled.
 * Chatbot is an add-on flag, not standalone.
 * - Builder track + chatbot → chatbot attaches to website
 * - Axiom track + chatbot → AI Ops Assistant
 */

export type UserModules = {
  builder?: boolean;
  axiom?: boolean;
  chatbot?: boolean;
};

export function parseUserModules(modules: unknown): UserModules {
  if (!modules || typeof modules !== "object") {
    return { builder: false, axiom: false, chatbot: false };
  }
  const m = modules as Record<string, unknown>;
  return {
    builder: Boolean(m.builder),
    axiom: Boolean(m.axiom),
    chatbot: Boolean(m.chatbot),
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

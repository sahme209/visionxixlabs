/**
 * Chatbot Action Agent — multi-model fallback, RAG, plugin-based actions.
 * Chatbot is no longer text-only; it becomes an action agent.
 */

import { orchestrateChat } from "@/lib/ai/orchestrator";
import { getPlugin } from "@/lib/plugins";
import { getUserPlugins } from "@/lib/userModules";
import type { ChatMessage } from "@/lib/ai/chat";

export type ActionIntent =
  | { type: "create_ticket"; params?: Record<string, unknown> }
  | { type: "deploy_fix"; params?: Record<string, unknown> }
  | { type: "pull_cloud_metrics"; params?: Record<string, unknown> }
  | { type: "update_website_content"; params?: Record<string, unknown> }
  | { type: "none" };

export type ActionAgentResult = {
  text: string;
  actionIntent?: ActionIntent;
  /** If action was executed, result */
  actionResult?: unknown;
};

/**
 * RAG: placeholder for vector store. Returns context from knowledge base.
 * Full implementation would query vector DB.
 */
export function getRAGContext(
  _query: string,
  knowledgeContent: string,
  _vectorStore?: unknown
): string {
  // Minimal: use knowledge content as context (truncate if large)
  const maxChars = 15000;
  if (knowledgeContent.length <= maxChars) return knowledgeContent;
  return knowledgeContent.slice(0, maxChars) + "\n[Content truncated for context...]";
}

/**
 * Parse AI response for action intents. Returns action or none.
 */
export function parseActionIntent(text: string): ActionIntent {
  const lower = text.toLowerCase();
  if (lower.includes("[create_ticket]") || lower.includes("create ticket")) {
    return { type: "create_ticket" };
  }
  if (lower.includes("[deploy_fix]") || lower.includes("deploy fix")) {
    return { type: "deploy_fix" };
  }
  if (lower.includes("[pull_metrics]") || lower.includes("pull cloud metrics")) {
    return { type: "pull_cloud_metrics" };
  }
  if (lower.includes("[update_content]") || lower.includes("update website content")) {
    return { type: "update_website_content" };
  }
  return { type: "none" };
}

/**
 * Execute plugin action if user has plugin and intent matches.
 */
export async function executeActionIntent(
  intent: ActionIntent,
  userId: string,
  userModules: unknown,
  projectId?: string
): Promise<unknown | null> {
  if (intent.type === "none") return null;

  const plugins = getUserPlugins(userModules);
  let pluginId: string | null = null;
  let action = "";
  if (intent.type === "deploy_fix" && plugins.includes("deployment")) {
    pluginId = "deployment";
    action = "deploy";
  } else if (intent.type === "pull_cloud_metrics" && (plugins.includes("aws") || plugins.includes("gcp") || plugins.includes("azure"))) {
    pluginId = plugins.find((p) => ["aws", "gcp", "azure"].includes(p)) ?? null;
    action = "scan";
  }
  if (!pluginId) return null;

  const plugin = getPlugin(pluginId);
  if (!plugin) return null;

  const result = await plugin.execute({
    userId,
    projectId,
    params: { action, ...(intent.params ?? {}) },
  });
  return result.ok ? result.data : null;
}

/**
 * Chatbot action agent — multi-model, RAG, optional plugin execution.
 */
export async function runActionAgent(opts: {
  systemPrompt: string;
  messages: ChatMessage[];
  knowledgeContent: string;
  userId: string;
  userModules: unknown;
  projectId?: string;
  executeActions?: boolean;
}): Promise<ActionAgentResult> {
  const ragContext = getRAGContext(opts.messages[opts.messages.length - 1]?.content ?? "", opts.knowledgeContent);
  const enhancedSystem = `${opts.systemPrompt}

--- RAG Context (knowledge base) ---
${ragContext}
--- End RAG Context ---

You can suggest actions by including tags: [create_ticket], [deploy_fix], [pull_metrics], [update_content].`;

  const { text } = await orchestrateChat({
    taskType: "chat",
    systemPrompt: enhancedSystem,
    messages: opts.messages,
    maxTokens: 1536,
    temperature: 0.4,
  });

  const intent = parseActionIntent(text);
  let actionResult: unknown = null;
  if (opts.executeActions && intent.type !== "none") {
    actionResult = await executeActionIntent(intent, opts.userId, opts.userModules, opts.projectId);
  }

  return {
    text,
    actionIntent: intent.type !== "none" ? intent : undefined,
    actionResult: actionResult ?? undefined,
  };
}

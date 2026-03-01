/**
 * Common provider interface for multi-model AI orchestration.
 */

export type ProviderName = "openai" | "anthropic" | "gemini";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ToolDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

export interface GenerateTextOptions {
  system?: string;
  prompt?: string;
  messages?: ChatMessage[];
  tools?: ToolDefinition[];
  jsonSchema?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateTextResult {
  text: string;
  toolCalls?: Array<{ name: string; arguments: string }>;
  usage?: { inputTokens: number; outputTokens: number };
}

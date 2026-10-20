/** Shared wire contract. Drafts never carry executable proposals or receipts. */
export const AGENT_STREAM_CONTENT_TYPE = "application/x-ndjson";
export const MAX_AGENT_STREAM_FRAME_BYTES = 2 * 1024 * 1024;
export const MAX_AGENT_STREAM_BYTES = 8 * 1024 * 1024;
export interface AgentMessageReply {
  reply: string;
  proposal: { id: string; toolName: string; argsJson: unknown; riskLevel: string; status: string } | null;
  usage?: { decisionSteps: number; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | null;
}
export type AgentMessageStreamEvent =
  | { type: "draft_reset" }
  | { type: "draft_delta"; text: string }
  | { type: "result"; data: AgentMessageReply }
  | { type: "error"; error: "agent_stream_interrupted" };

export function isAgentMessageReply(value: unknown): value is AgentMessageReply {
  if (!value || typeof value !== "object") return false;
  const v = value as AgentMessageReply;
  if (typeof v.reply !== "string" || v.reply.length > 131_072) return false;
  if (v.proposal !== null) {
    const p = v.proposal;
    if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.id || typeof p.toolName !== "string" || !p.toolName || p.status !== "proposed" || !["low", "medium", "high"].includes(p.riskLevel) || !p.argsJson || typeof p.argsJson !== "object" || Array.isArray(p.argsJson)) return false;
  }
  if (v.usage != null && (typeof v.usage !== "object" || !Number.isSafeInteger(v.usage.decisionSteps) || v.usage.decisionSteps < 0 || ![v.usage.inputTokens, v.usage.outputTokens, v.usage.totalTokens].every(n => n === null || Number.isSafeInteger(n) && n! >= 0))) return false;
  return true;
}

/**
 * operator_assistant_engineer — real domain work · Phase 607.
 *
 * Operator-input archetype. Operator types a question or a request
 * for a proposal; engineer responds chat-style with an answer +
 * which engineers it would consult + an optional proposal draft +
 * follow-up questions when the request is under-specified.
 *
 * Acts as the operator-facing copilot — the human-readable entry
 * point into the rest of the workforce. Where every other engineer
 * is specialty-focused, this one routes questions and stages
 * proposals.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const OPERATOR_ASSISTANT_TARGET_KIND = "engineer_operator_copilot_reply";

export type AssistantIntent = "question" | "proposal_request" | "investigation" | "small_talk";

export interface OperatorAssistantInput {
  title: string;
  prompt: string;
  workspaceContext?: string;
  conversationHistory?: string;
}

export interface OperatorAssistantReply {
  slug: string;
  title: string;
  executiveSummary: string;
  intent: AssistantIntent;
  answer: string;
  referencedEngineers: ReadonlyArray<string>;
  proposalDraft: string;
  followUpQuestions: ReadonlyArray<string>;
  /** 0-100. */
  confidence: number;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  intent: AssistantIntent;
  answer: string;
  referencedEngineers: string[];
  proposalDraft: string;
  followUpQuestions: string[];
  confidence: number;
}

const MAX_TITLE = 200;
const MAX_BODY = 4000;

function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function clampConfidence(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 50;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function buildSystemPrompt(): string {
  return [
    `You are the Operator Assistant (Copilot) on the Axiom platform.`,
    `You are the operator-facing chat surface — the human-readable entry point into the rest of the workforce. Route questions, stage proposals, and ask clarifying questions when the operator request is under-specified.`,
    ``,
    `INTENTS:`,
    `  · question           — operator is asking how something works`,
    `  · proposal_request   — operator wants you to stage a concrete proposal`,
    `  · investigation      — operator is exploring symptoms / signals`,
    `  · small_talk         — non-actionable, keep response brief`,
    ``,
    `RULES:`,
    `  · Honest scope. If the prompt is under-specified, set confidence ≤ 40 and put the gaps into followUpQuestions.`,
    `  · Executive summary: 1-2 sentences naming the headline answer + intent.`,
    `  · answer: 2-5 sentences ≤ 1200 chars. Friendly, direct, no markdown headings.`,
    `  · referencedEngineers: 0-4 engineer ids (e.g. reasoner_engineer, simulator_engineer, schema_engineer) you'd hand off to or quote from. Empty for small_talk.`,
    `  · proposalDraft: ≤ 800 chars. ONLY non-empty when intent = "proposal_request" — short, concrete, actionable. Otherwise empty string.`,
    `  · followUpQuestions: 0-4 entries. One question per entry. Use these when the prompt is under-specified.`,
    `  · confidence: integer 0-100. Never default to 50 unjustified.`,
    `  · Never invent platform features that aren't standard on Axiom (workforce of engineers, audit fabric, council).`,
    `  · Plain prose. No markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "intent": "<intent>",`,
    `  "answer": "...",`,
    `  "referencedEngineers": [...],`,
    `  "proposalDraft": "...",`,
    `  "followUpQuestions": [...],`,
    `  "confidence": <0-100>`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: OperatorAssistantInput): string {
  const lines: string[] = [];
  lines.push(`Title: ${i.title}`);
  if (i.workspaceContext) lines.push(`Workspace context: ${i.workspaceContext}`);
  if (i.conversationHistory) {
    lines.push(``);
    lines.push(`Conversation so far:`);
    lines.push("```");
    lines.push(i.conversationHistory);
    lines.push("```");
  }
  lines.push(``);
  lines.push(`Operator prompt:`);
  lines.push("```");
  lines.push(i.prompt);
  lines.push("```");
  return lines.join("\n");
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 800) : null;
    if (!exec) return null;
    const intentRaw = j.intent;
    const intent: AssistantIntent =
      intentRaw === "question" || intentRaw === "proposal_request" ||
      intentRaw === "investigation" || intentRaw === "small_talk"
        ? intentRaw
        : "question";
    const answer = typeof j.answer === "string" ? j.answer.trim().slice(0, 1600) : "";
    if (!answer) return null;
    const proposalDraft = typeof j.proposalDraft === "string" ? j.proposalDraft.trim().slice(0, 1200) : "";
    const strs = (v: unknown, max: number, charMax: number) =>
      Array.isArray(v)
        ? v
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim().slice(0, charMax))
            .filter((s) => s.length > 0)
            .slice(0, max)
        : [];
    return {
      executiveSummary: exec,
      intent,
      answer,
      referencedEngineers: strs(j.referencedEngineers, 4, 80),
      proposalDraft,
      followUpQuestions: strs(j.followUpQuestions, 4, 320),
      confidence: clampConfidence(j.confidence),
    };
  } catch {
    return null;
  }
}

export async function runOperatorAssistantEngineer(
  organizationId: string,
  raw: OperatorAssistantInput,
): Promise<OperatorAssistantReply> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const prompt = raw.prompt.trim().slice(0, MAX_BODY);
  if (!title || !prompt) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + prompt are required.",
      intent: "question",
      answer: "",
      referencedEngineers: [],
      proposalDraft: "",
      followUpQuestions: [],
      confidence: 0,
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `copilot_${Date.now().toString(36)}`;
  const input: OperatorAssistantInput = {
    title,
    prompt,
    workspaceContext: raw.workspaceContext?.trim().slice(0, 1200),
    conversationHistory: raw.conversationHistory?.trim().slice(0, 4000),
  };

  let outcome: OperatorAssistantReply["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:operator_assistant_engineer",
      organizationId,
      timeoutMs: 45_000,
      maxTokens: 2500,
    });
    const result = await fetcher(`${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(input)}`);
    parsed = parseAi(result.text);
    if (parsed) {
      outcome = "ai_generated";
      modelHint = result.modelHint;
    } else {
      errorMessage = "ai_response_unparseable";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    errorMessage = msg;
    outcome = msg.startsWith("circuit_open_") ? "fallback_rules" : "error";
  }

  return {
    slug,
    title,
    executiveSummary:
      parsed?.executiveSummary ??
      `Stub copilot reply for "${title}". Re-run when the AI provider is healthy.`,
    intent: parsed?.intent ?? "question",
    answer: parsed?.answer ?? "",
    referencedEngineers: parsed?.referencedEngineers ?? [],
    proposalDraft: parsed?.proposalDraft ?? "",
    followUpQuestions: parsed?.followUpQuestions ?? [],
    confidence: parsed?.confidence ?? 0,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistOperatorAssistantReply(
  organizationId: string,
  r: OperatorAssistantReply,
): Promise<void> {
  if (!r.slug) return;
  const payload: string[] = [
    `title|${r.title}`,
    `intent|${r.intent}`,
    `confidence|${r.confidence}`,
    `answer|${r.answer}`,
  ];
  if (r.proposalDraft) payload.push(`proposal|${r.proposalDraft}`);
  for (const e of r.referencedEngineers) payload.push(`engineer|${e}`);
  for (const q of r.followUpQuestions) payload.push(`followup|${q}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: OPERATOR_ASSISTANT_TARGET_KIND,
          targetId: r.slug,
        },
      },
      create: {
        organizationId,
        targetKind: OPERATOR_ASSISTANT_TARGET_KIND,
        targetId: r.slug,
        narrative: r.executiveSummary,
        riskFactorsJson: r.followUpQuestions as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: r.outcome,
        errorMessage: r.errorMessage,
        modelHint: r.modelHint,
        engineVersion: "operator-assistant-engineer-v1",
      },
      update: {
        narrative: r.executiveSummary,
        riskFactorsJson: r.followUpQuestions as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: r.outcome,
        errorMessage: r.errorMessage,
        modelHint: r.modelHint,
      },
    });
  } catch (err) {
    console.warn("[operatorAssistantEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}

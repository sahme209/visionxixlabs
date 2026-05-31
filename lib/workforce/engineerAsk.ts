/**
 * Engineer Q&A engine — Phase 564.
 *
 * Lets operators ask any client engineer a free-form question and get
 * a Claude-powered answer in that engineer's voice. Sits next to the
 * Phase 557 specialty rationale flow:
 *
 *   · runEngineerAgi(engineer, org)            — autonomous "speak for yourself"
 *   · askEngineer(engineer, org, question)     — operator-prompted Q&A
 *
 * Same instrumented fetcher, same circuit breaker, same AiCallLog
 * tracking — Q&A inherits the AGI fabric's safety contract for free.
 *
 * Each answer persists as one AiRationaleEnrichment row at
 *   targetKind="engineer_qa"
 *   targetId=`<engineer.id>:<timestamp>`
 *
 * so the existing AGI memory permalink page (Phase 539) and CSV
 * exporter (Phase 540) surface Q&A without any UI changes.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import type { AgentEngineer } from "./agentWorkforceRegistry";

export interface EngineerAskResult {
  question: string;
  answer: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
  /** Stable id assigned to the persisted row so the caller can deep-link. */
  rowId: string;
}

const ENGINE_NAME_PREFIX = "engineer_qa";
const MAX_QUESTION_LEN = 1500;
const MAX_ANSWER_LEN = 4000;

function buildSystemPrompt(engineer: AgentEngineer): string {
  return [
    `You ARE the ${engineer.displayName} on the Axiom platform.`,
    `Your role: ${engineer.role}`,
    `Your department: ${engineer.department}`,
    `Your highest-risk action: ${engineer.highestRiskAction}`,
    `Your approval rule: ${engineer.approvalRule}`,
    engineer.requiredConnectors.length > 0
      ? `Connectors you depend on: ${engineer.requiredConnectors.join(", ")}`
      : `You operate without external connectors.`,
    engineer.requiredTools.length > 0
      ? `Tools you exercise: ${engineer.requiredTools.join(", ")}`
      : ``,
    ``,
    `An operator is asking you a direct question. Answer in the first`,
    `person AS this engineer. Be concrete and specific. If the question`,
    `is outside your specialty, say so plainly and name the engineer or`,
    `team that would be a better fit. Refuse to invent data — if the`,
    `operator asks about something you can't see, say what you'd need`,
    `to see to answer well.`,
    ``,
    `Cap your answer at ~600 characters. No JSON, no markdown formatting`,
    `— plain prose only, like a Slack reply.`,
  ].filter(Boolean).join("\n");
}

function fallback(engineer: AgentEngineer, question: string): { answer: string } {
  return {
    answer: `I'm the ${engineer.displayName} — I'd normally answer "${question.slice(0, 80)}" in detail, but the AI provider isn't reachable right now. Try again in a minute, or check /dashboard/ai-call-log for the current circuit state.`,
  };
}

export async function askEngineer(
  engineer: AgentEngineer,
  organizationId: string,
  rawQuestion: string,
): Promise<EngineerAskResult> {
  const question = rawQuestion.trim().slice(0, MAX_QUESTION_LEN);
  if (!question) {
    return {
      question: "",
      answer: "",
      outcome: "error",
      modelHint: null,
      errorMessage: "empty_question",
      rowId: "",
    };
  }

  const fetcher = makeInstrumentedFetcher({
    engineName: `${ENGINE_NAME_PREFIX}:${engineer.id}`,
    organizationId,
    timeoutMs: 30_000,
  });

  let outcome: EngineerAskResult["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let answer: string;

  try {
    const system = buildSystemPrompt(engineer);
    const prompt = `${system}\n\n---\n\nQuestion from the operator:\n${question}`;
    const result = await fetcher(prompt);
    answer = (result.text ?? "").trim().slice(0, MAX_ANSWER_LEN);
    if (!answer) {
      const fb = fallback(engineer, question);
      answer = fb.answer;
      outcome = "fallback_rules";
      errorMessage = "ai_empty_response";
    } else {
      outcome = "ai_generated";
      modelHint = result.modelHint;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    const fb = fallback(engineer, question);
    answer = fb.answer;
    outcome = msg.startsWith("circuit_open_") ? "fallback_rules" : "error";
    errorMessage = msg;
  }

  // Stable per-row id — engineerId + timestamp gives ordering AND
  // uniqueness without a UUID generator dep.
  const rowId = `${engineer.id}:${Date.now().toString(36)}`;
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: "engineer_qa",
          targetId: rowId,
        },
      },
      create: {
        organizationId,
        targetKind: "engineer_qa",
        targetId: rowId,
        narrative: answer,
        // We stash the question on riskFactorsJson as a single-element
        // array — the existing memory surfaces already render that
        // array, so the operator sees the question without a schema
        // change. nextActionsJson stays empty for Q&A rows.
        riskFactorsJson: [question] as unknown as string[],
        nextActionsJson: [] as unknown as string[],
        outcome,
        errorMessage,
        modelHint,
        engineVersion: "engineer-qa-v1",
      },
      update: {
        narrative: answer,
        riskFactorsJson: [question] as unknown as string[],
        outcome,
        errorMessage,
        modelHint,
      },
    });
  } catch (err) {
    console.warn("[engineerAsk] persist failed:", err instanceof Error ? err.message : err);
  }

  return { question, answer, outcome, modelHint, errorMessage, rowId };
}

/**
 * AI approval-packet narrator.
 *
 * Approval packets currently render a fixed template: candidate name,
 * what would change, who voted what. This module wraps the AI manager
 * to produce a 1-paragraph operator-facing executive summary suitable
 * for Slack/Teams pre-text or the top of the approval page.
 *
 * Best-effort. NEVER throws. Falls back to a deterministic template.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface ApprovalPacketSeed {
  candidateLabel: string;
  candidateKind: string;       // e.g. "tighten_s3_pab"
  blastRadius: "single_resource" | "service" | "account" | "org";
  agentSupport: number;        // 0..n
  agentOppose: number;
  policyVerdict: "pass" | "fail" | "unknown";
  boundaryVerdict: "pass" | "fail" | "unknown";
  evidenceCount: number;       // attached evidence rows
  estimatedDurationMins: number;
}

export interface ApprovalNarrative {
  paragraph: string;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You summarize an approval packet for an AGI ops operator.",
  "2-4 sentences. Plain English. No emojis.",
  "Mention the candidate, blast radius, council support vs oppose, policy + boundary verdicts, and that nothing is applied without operator approval.",
  "Never invent numbers beyond the input.",
].join(" ");

const MAX_OUT = 600;

function templateFallback(s: ApprovalPacketSeed): string {
  const pol = s.policyVerdict === "pass" ? "policy passed" : s.policyVerdict === "fail" ? "policy blocked" : "policy unknown";
  const bnd = s.boundaryVerdict === "pass" ? "boundary passed" : s.boundaryVerdict === "fail" ? "boundary blocked" : "boundary unknown";
  return [
    `${s.candidateKind} on "${s.candidateLabel}" (${s.blastRadius.replace("_", " ")} blast radius).`,
    `Council: ${s.agentSupport} support / ${s.agentOppose} oppose.`,
    `${pol}; ${bnd}.`,
    `${s.evidenceCount} evidence row(s); est. ${s.estimatedDurationMins} min if approved.`,
    `Approval-only-no-execution — nothing runs without your sign-off.`,
  ].join(" ");
}

export async function narrateApprovalPacket(seed: ApprovalPacketSeed): Promise<ApprovalNarrative> {
  const fallback = templateFallback(seed);
  try {
    const mgr = getAIProviderManager();
    const prompt = [
      `Candidate label: ${seed.candidateLabel}`,
      `Candidate kind: ${seed.candidateKind}`,
      `Blast radius: ${seed.blastRadius}`,
      `Agent support weight: ${seed.agentSupport}`,
      `Agent oppose weight: ${seed.agentOppose}`,
      `Policy gate: ${seed.policyVerdict}`,
      `Boundary gate: ${seed.boundaryVerdict}`,
      `Evidence count: ${seed.evidenceCount}`,
      `Estimated duration mins: ${seed.estimatedDurationMins}`,
    ].join("\n");
    const r = await mgr.generateText(prompt, {
      system: SYSTEM,
      maxTokens: 4096,
      temperature: 0.3,
      timeoutMs: 12_000,
    });
    const text = (r.text ?? "").trim();
    if (!text || r.provider === "mock") {
      return { paragraph: fallback, aiUsed: false, provider: null, model: null, latencyMs: r.latencyMs };
    }
    const paragraph = text.length > MAX_OUT ? `${text.slice(0, MAX_OUT - 3)}...` : text;
    return { paragraph, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { paragraph: fallback, aiUsed: false, provider: null, model: null, latencyMs: 0 };
  }
}

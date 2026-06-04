/**
 * approver_engineer — real domain work · Phase 608.
 *
 * Operator-input archetype. Operator pastes a proposal + risk
 * context; engineer assembles the structured approval packet the
 * operator (or council) needs to make a binding decision.
 *
 * This is the only engineer in the "safety" department doing
 * domain-output work today — policy_gate and boundary_gate run
 * inline in the action pipeline; approver_engineer is the surface
 * where the human-readable packet lives.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const APPROVER_TARGET_KIND = "engineer_approval_packet";

export type ImpactRadius = "workspace" | "tenant" | "org" | "global";
export type DecisionAuthority = "operator" | "admin" | "council" | "board";
export type Reversibility = "fully" | "partially" | "irreversible";
export type RecommendedDecision = "approve" | "reject" | "revise" | "escalate";

export interface ApproverInput {
  title: string;
  proposalDescription: string;
  riskContext: string;
  requestedAuthority?: string;
  knownDependencies?: string;
}

export interface ApprovalPacket {
  slug: string;
  title: string;
  executiveSummary: string;
  proposalSummary: string;
  impactRadius: ImpactRadius;
  decisionAuthority: DecisionAuthority;
  reversibility: Reversibility;
  recommendedDecision: RecommendedDecision;
  mustReviewArtifacts: ReadonlyArray<string>;
  approvalChecklist: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  proposalSummary: string;
  impactRadius: ImpactRadius;
  decisionAuthority: DecisionAuthority;
  reversibility: Reversibility;
  recommendedDecision: RecommendedDecision;
  mustReviewArtifacts: string[];
  approvalChecklist: string[];
}

const MAX_TITLE = 200;
const MAX_BODY = 6000;

function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function buildSystemPrompt(): string {
  return [
    `You are the Approver Engineer on the Axiom platform.`,
    `Your job: assemble the structured approval packet a decision-maker needs to sign or refuse the proposal. This packet is the only gate that lets autonomy act.`,
    ``,
    `IMPACT RADIUS:`,
    `  · workspace   — affects one workspace only`,
    `  · tenant      — affects a single tenant across workspaces`,
    `  · org         — affects the deployment org's posture`,
    `  · global      — affects every tenant / cross-cutting`,
    ``,
    `DECISION AUTHORITY:`,
    `  · operator    — workspace operator can sign`,
    `  · admin       — workspace admin role required`,
    `  · council     — needs council_engineer verdict + admin co-sign`,
    `  · board       — escalates beyond the platform (legal / exec)`,
    ``,
    `REVERSIBILITY:`,
    `  · fully         — clean rollback path exists`,
    `  · partially     — rollback exists but partial data loss possible`,
    `  · irreversible  — landing this proposal is a one-way door`,
    ``,
    `RECOMMENDED DECISION:`,
    `  · approve   — packet is complete, action is safe, sign`,
    `  · reject    — risk outweighs benefit, refuse`,
    `  · revise    — proposal needs scope reduction or guardrails before sign`,
    `  · escalate  — packet exceeds operator authority, push up to admin/council/board`,
    ``,
    `RULES:`,
    `  · Pick the SMALLEST authority that legitimately owns the decision. Don't over-escalate.`,
    `  · Pick the recommended decision honestly. If risk outweighs benefit, "reject" — don't soften to "revise".`,
    `  · Irreversible proposals require council authority at minimum.`,
    `  · Executive summary: 2-3 sentences naming the proposal, the impact radius, and the recommended decision.`,
    `  · proposalSummary: 1-3 sentences ≤ 600 chars restating the proposal in approval-packet language (no operator slang).`,
    `  · mustReviewArtifacts: 1-5 entries naming docs / dashboards / logs the decision-maker should open before signing.`,
    `  · approvalChecklist: 2-6 entries naming questions the decision-maker should be able to say yes to before signing.`,
    `  · Never invent platform components that aren't in the input.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "proposalSummary": "...",`,
    `  "impactRadius": "<radius>",`,
    `  "decisionAuthority": "<authority>",`,
    `  "reversibility": "<reversibility>",`,
    `  "recommendedDecision": "<decision>",`,
    `  "mustReviewArtifacts": [...],`,
    `  "approvalChecklist": [...]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: ApproverInput): string {
  const lines: string[] = [];
  lines.push(`Title: ${i.title}`);
  if (i.requestedAuthority) lines.push(`Requested authority: ${i.requestedAuthority}`);
  if (i.knownDependencies) lines.push(`Known dependencies: ${i.knownDependencies}`);
  lines.push(``);
  lines.push(`Proposal:`);
  lines.push("```");
  lines.push(i.proposalDescription);
  lines.push("```");
  lines.push(``);
  lines.push(`Risk context:`);
  lines.push("```");
  lines.push(i.riskContext);
  lines.push("```");
  return lines.join("\n");
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1500) : null;
    if (!exec) return null;
    const proposalSummary = typeof j.proposalSummary === "string" ? j.proposalSummary.trim().slice(0, 800) : "";
    if (!proposalSummary) return null;
    const r = j.impactRadius;
    const impactRadius: ImpactRadius =
      r === "workspace" || r === "tenant" || r === "org" || r === "global" ? r : "workspace";
    const a = j.decisionAuthority;
    const decisionAuthority: DecisionAuthority =
      a === "operator" || a === "admin" || a === "council" || a === "board" ? a : "operator";
    const rev = j.reversibility;
    const reversibility: Reversibility =
      rev === "fully" || rev === "partially" || rev === "irreversible" ? rev : "partially";
    const d = j.recommendedDecision;
    const recommendedDecision: RecommendedDecision =
      d === "approve" || d === "reject" || d === "revise" || d === "escalate" ? d : "revise";
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
      proposalSummary,
      impactRadius,
      decisionAuthority,
      reversibility,
      recommendedDecision,
      mustReviewArtifacts: strs(j.mustReviewArtifacts, 5, 280),
      approvalChecklist: strs(j.approvalChecklist, 6, 320),
    };
  } catch {
    return null;
  }
}

export async function runApproverEngineer(organizationId: string, raw: ApproverInput): Promise<ApprovalPacket> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const proposalDescription = raw.proposalDescription.trim().slice(0, MAX_BODY);
  const riskContext = raw.riskContext.trim().slice(0, MAX_BODY);
  if (!title || !proposalDescription || !riskContext) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + proposal description + risk context are required.",
      proposalSummary: "",
      impactRadius: "workspace",
      decisionAuthority: "operator",
      reversibility: "partially",
      recommendedDecision: "revise",
      mustReviewArtifacts: [],
      approvalChecklist: [],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `approval_${Date.now().toString(36)}`;
  const input: ApproverInput = {
    title,
    proposalDescription,
    riskContext,
    requestedAuthority: raw.requestedAuthority?.trim().slice(0, 200),
    knownDependencies: raw.knownDependencies?.trim().slice(0, 1000),
  };

  let outcome: ApprovalPacket["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:approver_engineer",
      organizationId,
      timeoutMs: 60_000,
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
    executiveSummary: parsed?.executiveSummary ?? `Stub approval packet for "${title}". Re-run when the AI provider is healthy.`,
    proposalSummary: parsed?.proposalSummary ?? "",
    impactRadius: parsed?.impactRadius ?? "workspace",
    decisionAuthority: parsed?.decisionAuthority ?? "operator",
    reversibility: parsed?.reversibility ?? "partially",
    recommendedDecision: parsed?.recommendedDecision ?? "revise",
    mustReviewArtifacts: parsed?.mustReviewArtifacts ?? [],
    approvalChecklist: parsed?.approvalChecklist ?? [],
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistApprovalPacket(organizationId: string, p: ApprovalPacket): Promise<void> {
  if (!p.slug) return;
  const payload: string[] = [
    `title|${p.title}`,
    `proposal_summary|${p.proposalSummary}`,
    `impact|${p.impactRadius}`,
    `authority|${p.decisionAuthority}`,
    `reversibility|${p.reversibility}`,
    `decision|${p.recommendedDecision}`,
  ];
  for (const a of p.mustReviewArtifacts) payload.push(`artifact|${a}`);
  for (const c of p.approvalChecklist) payload.push(`checklist|${c}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: APPROVER_TARGET_KIND,
          targetId: p.slug,
        },
      },
      create: {
        organizationId,
        targetKind: APPROVER_TARGET_KIND,
        targetId: p.slug,
        narrative: p.executiveSummary,
        riskFactorsJson: p.approvalChecklist as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome,
        errorMessage: p.errorMessage,
        modelHint: p.modelHint,
        engineVersion: "approver-engineer-v1",
      },
      update: {
        narrative: p.executiveSummary,
        riskFactorsJson: p.approvalChecklist as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome,
        errorMessage: p.errorMessage,
        modelHint: p.modelHint,
      },
    });
  } catch (err) {
    console.warn("[approverEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}

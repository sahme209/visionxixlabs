/**
 * workflow_orchestrator_engineer — real domain work · Phase 606.
 *
 * Operator-input archetype. Operator pastes a workflow description
 * (or a list of engineer outputs to chain); engineer composes them
 * into a runnable execution plan with ordering, parallel groups,
 * per-step approval gates, and retry policy.
 *
 * Distinct from intent_parser_engineer: intent_parser turns prose
 * into typed steps. workflow_orchestrator_engineer turns typed
 * steps into a DAG with concurrency + approval semantics ready for
 * the runtime to execute.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const WORKFLOW_ORCHESTRATOR_TARGET_KIND = "engineer_workflow_plan";

export type ApprovalGate = "auto" | "operator" | "council" | "terminal";
export type RetryPolicy = "none" | "exponential_3" | "exponential_5" | "manual";
export type ApprovalPolicy = "auto" | "per_step" | "terminal";

export interface WorkflowInput {
  title: string;
  workflowSpec: string;
  approvalPolicy?: ApprovalPolicy;
  guardrailRequirements?: string;
}

export interface OrchestrationStep {
  stepId: string;
  parallelGroup: number;
  label: string;
  description: string;
  requiredEngineers: ReadonlyArray<string>;
  approvalGate: ApprovalGate;
  retryPolicy: RetryPolicy;
}

export interface WorkflowPlan {
  slug: string;
  title: string;
  executiveSummary: string;
  steps: ReadonlyArray<OrchestrationStep>;
  guardrails: ReadonlyArray<string>;
  estimatedDuration: string;
  estimatedCostBand: string;
  rollbackPlan: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  steps: Array<{
    stepId: string;
    parallelGroup: number;
    label: string;
    description: string;
    requiredEngineers: string[];
    approvalGate: ApprovalGate;
    retryPolicy: RetryPolicy;
  }>;
  guardrails: string[];
  estimatedDuration: string;
  estimatedCostBand: string;
  rollbackPlan: string;
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
    `You are the Workflow Orchestrator Engineer on the Axiom platform.`,
    `Your job: compose the operator's workflow spec into a runnable execution plan a runtime can pick up and execute with full concurrency + approval semantics.`,
    ``,
    `APPROVAL GATES:`,
    `  · auto      — runtime advances without human review`,
    `  · operator  — operator must click through before this step runs`,
    `  · council   — council_engineer must cast a verdict (use for verdict-bearing branches)`,
    `  · terminal  — final-state gate: confirmation that the workflow landed safely`,
    ``,
    `RETRY POLICIES:`,
    `  · none           — failure stops the workflow`,
    `  · exponential_3  — 3 retries with backoff`,
    `  · exponential_5  — 5 retries with backoff (use for flaky upstream)`,
    `  · manual         — operator retries by hand`,
    ``,
    `RULES:`,
    `  · stepId: short kebab-case unique identifier (≤ 32 chars, e.g. "snapshot-state", "apply-migration").`,
    `  · parallelGroup: integer ≥ 1. Steps in the same group run concurrently; greater numbers run after lower numbers.`,
    `  · label: ≤ 80 chars human-friendly.`,
    `  · description: ≤ 320 chars naming what the step actually does.`,
    `  · requiredEngineers: 0-4 engineer ids (verifier_engineer, schema_engineer, etc.) the runtime needs at this step.`,
    `  · approvalGate: respect the operator's approvalPolicy. "auto" → all steps "auto" unless step is destructive. "per_step" → every step gets "operator". "terminal" → all steps "auto" except the last which is "terminal".`,
    `  · Honest scope. If the workflow can't be safely auto-orchestrated, surface the gap in guardrails.`,
    `  · steps: 2-10 entries.`,
    `  · guardrails: 1-5 entries naming preconditions or invariants the runtime must enforce throughout.`,
    `  · estimatedDuration: human band ("S: < 10 min", "M: 10-60 min", "L: 1-4 hours", "XL: > 4 hours").`,
    `  · estimatedCostBand: human band ("S", "M", "L", "XL") naming the rough AI + provider cost class.`,
    `  · rollbackPlan: 1-3 sentences ≤ 480 chars naming how to unwind if the workflow misbehaves mid-run.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "steps": [ { "stepId": "...", "parallelGroup": 1, "label": "...", "description": "...", "requiredEngineers": ["..."], "approvalGate": "<gate>", "retryPolicy": "<policy>" } ],`,
    `  "guardrails": [...],`,
    `  "estimatedDuration": "...",`,
    `  "estimatedCostBand": "...",`,
    `  "rollbackPlan": "..."`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: WorkflowInput): string {
  const lines: string[] = [];
  lines.push(`Title: ${i.title}`);
  lines.push(`Approval policy: ${i.approvalPolicy ?? "per_step"}`);
  if (i.guardrailRequirements) lines.push(`Guardrail requirements: ${i.guardrailRequirements}`);
  lines.push(``);
  lines.push(`Workflow spec:`);
  lines.push("```");
  lines.push(i.workflowSpec);
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
    const stepsRaw = Array.isArray(j.steps) ? (j.steps as unknown[]) : [];
    const steps: ParsedAi["steps"] = [];
    for (let i = 0; i < stepsRaw.length && steps.length < 10; i += 1) {
      const item = stepsRaw[i];
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const stepId = typeof obj.stepId === "string" ? obj.stepId.trim().slice(0, 40) : "";
      const label = typeof obj.label === "string" ? obj.label.trim().slice(0, 120) : "";
      const description = typeof obj.description === "string" ? obj.description.trim().slice(0, 400) : "";
      const parallelGroup = Number.isInteger(obj.parallelGroup) ? Math.max(1, Math.min(10, obj.parallelGroup as number)) : 1;
      const engineers = Array.isArray(obj.requiredEngineers)
        ? (obj.requiredEngineers as unknown[])
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim().slice(0, 60))
            .filter((s) => s.length > 0)
            .slice(0, 4)
        : [];
      const g = obj.approvalGate;
      const approvalGate: ApprovalGate =
        g === "auto" || g === "operator" || g === "council" || g === "terminal" ? g : "operator";
      const r = obj.retryPolicy;
      const retryPolicy: RetryPolicy =
        r === "none" || r === "exponential_3" || r === "exponential_5" || r === "manual" ? r : "none";
      if (stepId && label && description) {
        steps.push({ stepId, parallelGroup, label, description, requiredEngineers: engineers, approvalGate, retryPolicy });
      }
    }
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
      steps,
      guardrails: strs(j.guardrails, 5, 280),
      estimatedDuration: typeof j.estimatedDuration === "string" ? j.estimatedDuration.trim().slice(0, 80) : "",
      estimatedCostBand: typeof j.estimatedCostBand === "string" ? j.estimatedCostBand.trim().slice(0, 40) : "",
      rollbackPlan: typeof j.rollbackPlan === "string" ? j.rollbackPlan.trim().slice(0, 600) : "",
    };
  } catch {
    return null;
  }
}

export async function runWorkflowOrchestratorEngineer(organizationId: string, raw: WorkflowInput): Promise<WorkflowPlan> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const workflowSpec = raw.workflowSpec.trim().slice(0, MAX_BODY);
  if (!title || !workflowSpec) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + workflow spec are required.",
      steps: [],
      guardrails: [],
      estimatedDuration: "",
      estimatedCostBand: "",
      rollbackPlan: "",
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `workflow_${Date.now().toString(36)}`;
  const input: WorkflowInput = {
    title,
    workflowSpec,
    approvalPolicy: raw.approvalPolicy,
    guardrailRequirements: raw.guardrailRequirements?.trim().slice(0, 1000),
  };

  let outcome: WorkflowPlan["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:workflow_orchestrator_engineer",
      organizationId,
      timeoutMs: 60_000,
      maxTokens: 3500,
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
    executiveSummary: parsed?.executiveSummary ?? `Stub workflow plan for "${title}". Re-run when the AI provider is healthy.`,
    steps: parsed?.steps ?? [],
    guardrails: parsed?.guardrails ?? [],
    estimatedDuration: parsed?.estimatedDuration ?? "",
    estimatedCostBand: parsed?.estimatedCostBand ?? "",
    rollbackPlan: parsed?.rollbackPlan ?? "",
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistWorkflowPlan(organizationId: string, w: WorkflowPlan): Promise<void> {
  if (!w.slug) return;
  const payload: string[] = [
    `title|${w.title}`,
    `duration|${w.estimatedDuration}`,
    `cost_band|${w.estimatedCostBand}`,
  ];
  if (w.rollbackPlan) payload.push(`rollback|${w.rollbackPlan}`);
  for (const g of w.guardrails) payload.push(`guardrail|${g}`);
  for (const s of w.steps) {
    payload.push(`step|${s.stepId}|${s.parallelGroup}|${s.approvalGate}|${s.retryPolicy}|${s.label}|${s.description}`);
    if (s.requiredEngineers.length > 0) {
      payload.push(`engineers|${s.stepId}|${s.requiredEngineers.join(",")}`);
    }
  }
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: WORKFLOW_ORCHESTRATOR_TARGET_KIND,
          targetId: w.slug,
        },
      },
      create: {
        organizationId,
        targetKind: WORKFLOW_ORCHESTRATOR_TARGET_KIND,
        targetId: w.slug,
        narrative: w.executiveSummary,
        riskFactorsJson: w.guardrails as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: w.outcome,
        errorMessage: w.errorMessage,
        modelHint: w.modelHint,
        engineVersion: "workflow-orchestrator-engineer-v1",
      },
      update: {
        narrative: w.executiveSummary,
        riskFactorsJson: w.guardrails as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: w.outcome,
        errorMessage: w.errorMessage,
        modelHint: w.modelHint,
      },
    });
  } catch (err) {
    console.warn("[workflowOrchestratorEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Cloud Automation: Cost Idle Resources playbook.
 * Observe: Read idle resource signals from Axiom detections.
 * Plan: AI generates Terraform/script or recommendations.
 * Act: Create GitHub PR with fix.
 */

import type { AgentContext, ObserveResult, PlanResult } from "../agentLoop";
import { generateCompletion } from "@/lib/ai/provider";

export async function observeCostIdleResources(ctx: AgentContext): Promise<ObserveResult> {
  const payload = ctx.fullPayload ?? {};
  const axiomResult = payload.axiomResult as {
    detections?: { idleResources?: string[]; overprovisioningSignals?: string[] };
    scores?: { estimatedAnnualSavings?: number | null };
  } | undefined;
  const detections = axiomResult?.detections ?? {};
  const idleResources = (detections.idleResources ?? []) as string[];
  const overProv = (detections.overprovisioningSignals ?? []) as string[];
  const savings = axiomResult?.scores?.estimatedAnnualSavings ?? 0;

  const signals = [...idleResources, ...overProv];
  const detectedIssues = signals.map((s, i) => ({
    id: `idle-${i}`,
    type: "cost_idle",
    severity: (savings && savings > 500 ? "high" : "medium") as "low" | "medium" | "high" | "critical",
    description: s,
    estimatedImpact: savings ? `~$${savings}/yr potential savings` : undefined,
  }));

  return {
    signals,
    rawData: { idleResources, overprovisioningSignals: overProv, estimatedAnnualSavings: savings },
    detectedIssues,
  };
}

export async function planCostIdleResources(
  ctx: AgentContext,
  observeResult: ObserveResult
): Promise<PlanResult> {
  if (observeResult.detectedIssues.length === 0) {
    return { actions: [] };
  }

  const payload = ctx.fullPayload ?? {};
  const profile = payload.operatorProfile as { hostingProvider?: string; gitProvider?: string } | undefined;
  const provider = profile?.hostingProvider ?? "AWS";
  const gitProvider = profile?.gitProvider ?? "GitHub";

  const { text } = await generateCompletion({
    systemPrompt: `You are a cloud cost optimization expert. Given idle resource signals, generate an actionable remediation.

Output a JSON object with exactly this structure (no other text):
{
  "actions": [
    {
      "id": "action-1",
      "actionType": "github_pr",
      "title": "short title",
      "description": "1-2 sentence description",
      "approvalRequired": true,
      "files": [
        { "path": "path/from/repo/root", "content": "full file content" }
      ]
    }
  ],
  "rollbackPlan": ["step 1", "step 2"]
}

Rules:
- For ${provider}: generate Terraform or AWS CLI script to stop/terminate idle resources, or move to cheaper storage tier.
- Put files in a folder like "visionxix-remediation/` + new Date().toISOString().slice(0, 10) + `" or "scripts/cost-optimization".
- Include a README.md in the same folder explaining the changes and how to apply/rollback.
- approvalRequired must be true for any destructive action.
- If signals are vague, generate a generic "idle-resources-review.md" with manual steps instead of automated script.
- Output ONLY valid JSON.`,
    userPrompt: `Idle/overprovisioning signals:\n${observeResult.signals.join("\n")}\n\nEstimated savings: ${observeResult.rawData?.estimatedAnnualSavings ?? "unknown"}\n\nGenerate remediation as JSON.`,
    temperature: 0.3,
    maxTokens: 4096,
    responseFormat: "json",
  });

  try {
    const parsed = JSON.parse(
      (text ?? "{}").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    ) as { actions?: PlanResult["actions"]; rollbackPlan?: string[] };
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const rollbackPlan = Array.isArray(parsed.rollbackPlan) ? parsed.rollbackPlan : undefined;

    return {
      actions: actions.map((a) => ({
        ...a,
        actionType: (a.actionType === "github_pr" ? "github_pr" : "manual") as "github_pr" | "cloud_api" | "manual",
        approvalRequired: a.approvalRequired !== false,
      })),
      rollbackPlan,
    };
  } catch {
    return {
      actions: [
        {
          id: "fallback",
          actionType: "manual",
          title: "Manual review required",
          description: "AI could not generate automated fix. Review idle resource signals manually.",
          approvalRequired: true,
        },
      ],
    };
  }
}

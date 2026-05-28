/**
 * Phase 520 — AI rationale enricher for remediation proposals.
 *
 * Each remediation proposal already carries description + prerequisites
 * + rollbackPlan. This enricher adds a Claude-generated narrative +
 * risk factors + suggested concrete next actions that synthesize the
 * proposal against the surrounding incident and release context.
 *
 * Reuses parseRationaleResponse from the council enricher for
 * consistent list trimming.
 */

import { parseRationaleResponse, type RationaleAiFetcher, type RationaleEnrichment } from "./aiRationaleEnricherEngine";
import type { RemediationInputs, RemediationProposal } from "./remediationProposalEngine";

export const REMEDIATION_RATIONALE_ENGINE_VERSION = "ai-remediation-rationale-v1.0.0";

/* ──────────────────────────────────────────────────────────────────
   Prompt.
   ────────────────────────────────────────────────────────────── */

export function buildRemediationRationalePrompt(proposal: RemediationProposal, inputs: RemediationInputs): string {
  const lines: string[] = [
    "You are an SRE explaining a proposed remediation action to an on-call operator.",
    "Reply with a JSON object of shape { narrative, riskFactors, nextActions } where:",
    `  - narrative is a SINGLE plain-English paragraph (2-4 sentences) explaining the proposal in context.`,
    `  - riskFactors is an array of 1-5 short strings, each one concrete risk worth flagging.`,
    `  - nextActions is an array of 1-5 short imperative strings, each a concrete operator action.`,
    `  - Each string in the arrays MUST be under 140 characters.`,
    "",
    `Proposal kind: ${proposal.kind}`,
    `Proposal title: ${proposal.title}`,
    `Description: ${truncate(proposal.description, 240)}`,
    `Confidence: ${proposal.confidence}%`,
    `Severity: ${proposal.severity}`,
    `Reversible: ${proposal.reversible}`,
    `Estimated minutes: ${proposal.estimatedMinutes}`,
    `Prerequisites: ${proposal.prerequisites.length === 0 ? "(none)" : proposal.prerequisites.join("; ")}`,
    `Expected impact: ${proposal.expectedImpact}`,
    `Rollback plan: ${proposal.rollbackPlan}`,
    `Engine rationale: ${truncate(proposal.rationale, 240)}`,
    "",
    "Incident context:",
    `  title: ${inputs.incident.title}`,
    `  summary: ${inputs.incident.summary ?? "(no summary)"}`,
    `  severity: ${inputs.incident.severity}`,
    `  triage priority: ${inputs.triage.priority}`,
    `  triage owner team: ${inputs.triage.suggestedOwnerTeam}`,
    "",
    "Release context:",
    `  status: ${inputs.release.status}`,
    `  releaseTag: ${inputs.release.releaseTag ?? "(none)"}`,
    `  previousSuccessfulTag: ${inputs.release.previousSuccessfulTag ?? "(none)"}`,
    `  minutesSinceDeploy: ${inputs.release.minutesSinceDeploy}`,
    `  isProduction: ${inputs.release.isProduction}`,
    `  featureFlags: ${inputs.releaseFeatureFlags.length === 0 ? "(none)" : inputs.releaseFeatureFlags.join(", ")}`,
    "",
    "Surrounding signals:",
    `  capacity saturated: ${inputs.isCapacitySaturated}`,
    `  third-party dependency hint: ${inputs.thirdPartyDependencyHint}`,
    `  high error rate: ${inputs.highErrorRate}`,
    `  available runbooks: ${inputs.availableRunbookKeys.length === 0 ? "(none)" : inputs.availableRunbookKeys.join(", ")}`,
    "",
    "Respond with ONLY the JSON object. No prose before or after.",
  ];
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────
   Fallback.
   ────────────────────────────────────────────────────────────── */

export function buildRemediationFallbackRationale(proposal: RemediationProposal, inputs: RemediationInputs, reason: string): RationaleEnrichment {
  const parts: string[] = [];
  parts.push(`Proposes "${proposal.title}" (${proposal.kind}) with ${proposal.confidence}% confidence.`);
  if (proposal.reversible) {
    parts.push("Action is reversible — rollback path is defined.");
  } else {
    parts.push("Action is NOT reversible — requires explicit operator confirmation.");
  }
  parts.push(`Estimated ${proposal.estimatedMinutes} minute${proposal.estimatedMinutes === 1 ? "" : "s"} to execute.`);
  const narrative = parts.join(" ");

  const riskFactors = listFallbackRisks(proposal, inputs);
  const nextActions = listFallbackActions(proposal, inputs);

  return {
    outcome: "fallback_rules",
    narrative,
    riskFactors,
    nextActions,
    modelHint: null,
    errorMessage: reason,
    engineVersion: REMEDIATION_RATIONALE_ENGINE_VERSION,
  };
}

function listFallbackRisks(proposal: RemediationProposal, inputs: RemediationInputs): string[] {
  const out: string[] = [];
  if (!proposal.reversible) {
    out.push("Action is NOT reversible — verify rollback plan before executing.");
  }
  if (proposal.severity === "critical" && inputs.release.isProduction) {
    out.push("Critical-severity action against a production release — customer-visible impact possible.");
  }
  if (proposal.kind === "rollback_release" && !inputs.release.previousSuccessfulTag) {
    out.push("No previous successful release tag captured — rollback path may not be clean.");
  }
  if (proposal.kind === "rollback_release" && inputs.release.minutesSinceDeploy > 60) {
    out.push(`Release deployed ${inputs.release.minutesSinceDeploy}m ago — schema/state drift increases rollback risk.`);
  }
  if (proposal.prerequisites.length > 0) {
    out.push(`Has ${proposal.prerequisites.length} prerequisite${proposal.prerequisites.length === 1 ? "" : "s"} that must complete first.`);
  }
  if (inputs.isCapacitySaturated && proposal.kind !== "increase_replicas") {
    out.push("Capacity already saturated — adjacent capacity actions may compound.");
  }
  if (inputs.thirdPartyDependencyHint && proposal.kind !== "escalate_to_vendor") {
    out.push("Symptoms suggest third-party fault — proposal may not fix the root cause.");
  }
  if (out.length === 0) {
    out.push("No surfaced risk factors above the alert threshold.");
  }
  return out.slice(0, 5);
}

function listFallbackActions(proposal: RemediationProposal, inputs: RemediationInputs): string[] {
  const out: string[] = [];
  if (proposal.prerequisites.length > 0) {
    out.push(`Verify prerequisites: ${truncate(proposal.prerequisites[0], 100)}`);
  }
  switch (proposal.kind) {
    case "rollback_release":
      out.push(`Confirm previous successful tag ${inputs.release.previousSuccessfulTag ?? "(unknown)"} is rollback-safe.`);
      out.push("Run the deployment system's rollback automation against the captured tag.");
      break;
    case "disable_feature_flag":
      out.push("Identify the flag(s) shipped with this release and flip off via the flag system.");
      out.push("Re-test the failing user flow after the flag is off.");
      break;
    case "increase_replicas":
      out.push("Scale via the deployment manifest or HPA override.");
      out.push("Watch error rate + CPU/mem for 10 minutes after scale-out.");
      break;
    case "restart_service":
      out.push("Restart in a rolling fashion to avoid cold-cache thundering herd.");
      out.push("Watch the health-check + dependency graphs post-restart.");
      break;
    case "redirect_traffic":
      out.push("Confirm the alternate region/zone is healthy before redirecting.");
      out.push("Update DNS / load-balancer weights and watch latency.");
      break;
    case "throttle_requests":
      out.push("Apply rate limit at the API gateway, not at app layer.");
      out.push("Communicate the throttle to dependent services + customers.");
      break;
    case "escalate_to_vendor":
      out.push("Open the vendor support ticket with full incident timeline + error samples.");
      out.push("Subscribe vendor's status page + post the link in the incident channel.");
      break;
    case "no_action_recommended":
      out.push("Continue observing — escalate only if signals worsen.");
      break;
  }
  out.push(`Notify ${inputs.triage.suggestedOwnerTeam} when execution begins.`);
  return out.slice(0, 5);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/* ──────────────────────────────────────────────────────────────────
   Engine entrypoint.
   ────────────────────────────────────────────────────────────── */

export async function enrichRemediationRationale(
  proposal: RemediationProposal,
  inputs: RemediationInputs,
  fetcher: RationaleAiFetcher | null,
): Promise<RationaleEnrichment> {
  if (!fetcher) {
    return buildRemediationFallbackRationale(proposal, inputs, "no_ai_fetcher_configured");
  }

  let raw: string;
  let modelHint: string | null = null;
  try {
    const result = await fetcher(buildRemediationRationalePrompt(proposal, inputs));
    raw = result.text ?? "";
    modelHint = result.modelHint ?? null;
  } catch (err) {
    return {
      ...buildRemediationFallbackRationale(proposal, inputs, err instanceof Error ? err.message : "ai_fetcher_threw"),
      outcome: "error",
    };
  }

  if (!raw.trim()) {
    return buildRemediationFallbackRationale(proposal, inputs, "empty_ai_response");
  }
  const parsed = parseRationaleResponse(raw);
  if (!parsed) {
    return buildRemediationFallbackRationale(proposal, inputs, "unparseable_ai_response");
  }

  return {
    outcome: "ai_generated",
    narrative: parsed.narrative,
    riskFactors: parsed.riskFactors,
    nextActions: parsed.nextActions,
    modelHint,
    errorMessage: null,
    engineVersion: REMEDIATION_RATIONALE_ENGINE_VERSION,
  };
}

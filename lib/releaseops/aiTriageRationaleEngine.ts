/**
 * Phase 519 — AI rationale enricher for incident triage decisions.
 *
 * Triage-specific sibling of aiRationaleEnricherEngine. Takes a triage
 * output + the inputs the engine saw and produces:
 *
 *   • narrative — short paragraph in plain English
 *   • riskFactors[] — incident-specific risks (e.g. "no rollback path",
 *     "vendor dependency outage suspected")
 *   • nextActions[] — operator next-steps (page on-call, run runbook,
 *     check related releases)
 *
 * Reuses the JSON parser from the council engine so list-cap + truncation
 * stay consistent across surfaces. Engine version pinned in output.
 */

import { parseRationaleResponse, type RationaleAiFetcher, type RationaleEnrichment } from "./aiRationaleEnricherEngine";
import type { IncidentTriageInputs, IncidentTriageOutput } from "./incidentTriageEngine";

/** Local alias for the triage output the AI is asked to explain. */
type TriageDecision = IncidentTriageOutput;

export const TRIAGE_RATIONALE_ENGINE_VERSION = "ai-triage-rationale-v1.0.0";

/* ──────────────────────────────────────────────────────────────────
   Prompt.
   ────────────────────────────────────────────────────────────── */

export function buildTriageRationalePrompt(decision: TriageDecision, inputs: IncidentTriageInputs): string {
  const lines: string[] = [
    "You are an SRE explaining an incident-triage decision to an operator.",
    "Reply with a JSON object of shape { narrative, riskFactors, nextActions } where:",
    `  - narrative is a SINGLE plain-English paragraph (2-4 sentences) explaining the triage.`,
    `  - riskFactors is an array of 1-5 short strings, each one concrete risk worth flagging.`,
    `  - nextActions is an array of 1-5 short imperative strings, each a concrete operator action.`,
    `  - Each string in the arrays MUST be under 140 characters.`,
    "",
    `Triage priority: ${decision.priority}`,
    `Suggested owner team: ${decision.suggestedOwnerTeam}`,
    `Estimated time-to-mitigate (min): ${decision.estimatedTimeToMitigateMinutes}`,
    `Recommended runbook: ${decision.recommendedRunbook ?? "(none)"}`,
    `Auto-escalate: ${decision.autoEscalate}`,
    `Engine confidence: ${decision.confidence}%`,
    `Engine rationale: ${truncate(decision.rationale, 240)}`,
    "",
    "Incident state:",
    `  title: ${inputs.incident.title}`,
    `  summary: ${inputs.incident.summary ?? "(no summary)"}`,
    `  operator severity: ${inputs.incident.severity}`,
    `  reportedAt: ${inputs.incident.reportedAtIso}`,
    `  businessImpactHint: ${inputs.businessImpactHint ?? "(none)"}`,
    "",
    "Release context:",
    `  status: ${inputs.release.status}`,
    `  releaseTag: ${inputs.release.releaseTag ?? "(none)"}`,
    `  isProduction: ${inputs.release.isProduction}`,
    `  deployedAt: ${inputs.release.deployedAtIso ?? "(not deployed)"}`,
    `  isInPlannedFreeze: ${inputs.isInPlannedFreeze}`,
    "",
    "Surrounding signals:",
    `  open critical incidents on same release: ${inputs.openCriticalIncidentsOnThisRelease}`,
    `  pending advisor block kinds: ${inputs.pendingAdvisorBlockKinds.join(", ") || "(none)"}`,
    `  similar historical incidents (30d): ${inputs.similarHistoricalIncidents}`,
    `  median historical mitigation min: ${inputs.medianHistoricalMitigationMinutes}`,
    "",
    "Respond with ONLY the JSON object. No prose before or after.",
  ];
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────
   Fallback.
   ────────────────────────────────────────────────────────────── */

export function buildTriageFallbackRationale(decision: TriageDecision, inputs: IncidentTriageInputs, reason: string): RationaleEnrichment {
  const narrativeParts: string[] = [];
  narrativeParts.push(`Engine triaged this incident at ${decision.priority} with ${decision.confidence}% confidence, routed to ${decision.suggestedOwnerTeam}.`);
  if (decision.autoEscalate) {
    narrativeParts.push("Auto-escalate is on — the on-call rotation will be paged.");
  } else {
    narrativeParts.push("Auto-escalate is off — operator must acknowledge.");
  }
  if (decision.recommendedRunbook) {
    narrativeParts.push(`Recommended runbook: ${decision.recommendedRunbook}.`);
  }
  const narrative = narrativeParts.join(" ");

  const riskFactors = listFallbackRisks(decision, inputs);
  const nextActions = listFallbackActions(decision, inputs);

  return {
    outcome: "fallback_rules",
    narrative,
    riskFactors,
    nextActions,
    modelHint: null,
    errorMessage: reason,
    engineVersion: TRIAGE_RATIONALE_ENGINE_VERSION,
  };
}

function listFallbackRisks(decision: TriageDecision, inputs: IncidentTriageInputs): string[] {
  const out: string[] = [];
  if (inputs.openCriticalIncidentsOnThisRelease > 0) {
    out.push(`${inputs.openCriticalIncidentsOnThisRelease} other open critical incident${inputs.openCriticalIncidentsOnThisRelease === 1 ? "" : "s"} on the same release.`);
  }
  if (inputs.pendingAdvisorBlockKinds.length > 0) {
    out.push(`Advisor already recommends ${inputs.pendingAdvisorBlockKinds.join(" + ")} — incident overlaps a known regression signal.`);
  }
  if (inputs.similarHistoricalIncidents >= 3) {
    out.push(`${inputs.similarHistoricalIncidents} similar incidents in the last 30 days — recurring failure mode.`);
  }
  if (inputs.businessImpactHint && inputs.businessImpactHint.length > 0) {
    out.push(`Reported business impact: ${truncate(inputs.businessImpactHint, 120)}`);
  }
  if (inputs.release.isProduction && inputs.release.status !== "rolled_back" && decision.priority === "P0") {
    out.push("P0 against a production release — customer-visible.");
  }
  if (inputs.isInPlannedFreeze) {
    out.push("Incident fired during a planned release freeze — additional review window applies.");
  }
  if (out.length === 0) {
    out.push("No surrounding-signal risks beyond the incident's own severity.");
  }
  return out.slice(0, 5);
}

function listFallbackActions(decision: TriageDecision, inputs: IncidentTriageInputs): string[] {
  const out: string[] = [];
  if (decision.autoEscalate) {
    out.push(`Page on-call for ${decision.suggestedOwnerTeam} immediately.`);
  } else {
    out.push(`Notify ${decision.suggestedOwnerTeam} via the standard channel.`);
  }
  if (decision.recommendedRunbook) {
    out.push(`Run the ${decision.recommendedRunbook} runbook from the response library.`);
  }
  if (inputs.pendingAdvisorBlockKinds.includes("rollback") || inputs.pendingAdvisorBlockKinds.includes("block_deploy")) {
    out.push("Coordinate with release advisor — pending block / rollback signals overlap.");
  }
  if (inputs.openCriticalIncidentsOnThisRelease >= 2) {
    out.push("Consider rollback or freeze: multiple open critical incidents on the same release.");
  }
  if (decision.priority === "P0" || decision.priority === "P1") {
    out.push("Open a customer-comms thread within the first 30 minutes of mitigation.");
  } else {
    out.push("Update the incident timeline every 30 minutes until mitigation lands.");
  }
  return out.slice(0, 5);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/* ──────────────────────────────────────────────────────────────────
   Engine entrypoint.
   ────────────────────────────────────────────────────────────── */

export async function enrichTriageRationale(
  decision: TriageDecision,
  inputs: IncidentTriageInputs,
  fetcher: RationaleAiFetcher | null,
): Promise<RationaleEnrichment> {
  if (!fetcher) {
    return buildTriageFallbackRationale(decision, inputs, "no_ai_fetcher_configured");
  }

  let raw: string;
  let modelHint: string | null = null;
  try {
    const result = await fetcher(buildTriageRationalePrompt(decision, inputs));
    raw = result.text ?? "";
    modelHint = result.modelHint ?? null;
  } catch (err) {
    return {
      ...buildTriageFallbackRationale(decision, inputs, err instanceof Error ? err.message : "ai_fetcher_threw"),
      outcome: "error",
    };
  }

  if (!raw.trim()) {
    return buildTriageFallbackRationale(decision, inputs, "empty_ai_response");
  }
  const parsed = parseRationaleResponse(raw);
  if (!parsed) {
    return buildTriageFallbackRationale(decision, inputs, "unparseable_ai_response");
  }

  return {
    outcome: "ai_generated",
    narrative: parsed.narrative,
    riskFactors: parsed.riskFactors,
    nextActions: parsed.nextActions,
    modelHint,
    errorMessage: null,
    engineVersion: TRIAGE_RATIONALE_ENGINE_VERSION,
  };
}

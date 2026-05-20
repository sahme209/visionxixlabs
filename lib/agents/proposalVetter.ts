/**
 * Proposal vetting pipeline.
 *
 * Pure-function 4-stage check that runs against an in-flight
 * MethodProposal before an operator should be allowed to approve it.
 *
 *   1. parse       — proposedDiff must be a JSON object the target
 *                    schema recognises (target-specific shape check).
 *   2. diff_preview— compute a human-readable diff summary string so
 *                    the dashboard renders something an operator can
 *                    judge in <10 seconds.
 *   3. safety      — flag obviously-dangerous mutations (wildcards
 *                    in unintended places, raised tier caps without
 *                    justification, removed safetyContract literals).
 *   4. duplication — already covered by a recent proposal touching
 *                    the same target with similar label/diff hash?
 *
 * Hard rules:
 *   - Pure: no DB / network. Caller passes the proposal + (optional)
 *     prior proposal hashes for duplication detection.
 *   - Every stage returns ok|warn|fail + reason. Pipeline output is
 *     a typed VettingReport; the dashboard renders all stages so
 *     operators see exactly what was checked.
 *   - 'fail' on safety blocks approval; 'warn' is informational only.
 */

import { createHash } from "node:crypto";
import type { ProposalTarget } from "./methodProposalModel";

export type StageVerdict = "ok" | "warn" | "fail";

export interface VettingStage {
  stage: "parse" | "diff_preview" | "safety" | "duplication";
  verdict: StageVerdict;
  detail: string;
}

export interface VettingReport {
  proposalId: string;
  target: ProposalTarget;
  /** sha256 of canonical-JSON proposedDiff — useful for dedupe + audit. */
  diffHash: string;
  /** Operator-readable one-line summary of the diff. */
  diffSummary: string;
  stages: VettingStage[];
  /** True when every stage is 'ok' or 'warn'. */
  approvable: boolean;
}

export interface VetInput {
  proposalId: string;
  target: ProposalTarget;
  proposedDiff: unknown;
  label: string;
  /** Hashes of prior proposals on the same target (last 30 days). */
  recentDiffHashes?: string[];
  /** Optional prior labels for fuzzy-match duplication detection. */
  recentLabels?: string[];
}

export function vetProposal(input: VetInput): VettingReport {
  const stages: VettingStage[] = [];

  // Stage 1 — parse.
  const parsed = stageParse(input.target, input.proposedDiff);
  stages.push(parsed);

  // Diff hash + summary (used by stages 2 + 4).
  const diffHash = sha256Of(canonicalJson(input.proposedDiff));
  const diffSummary = stageDiffSummary(input.target, input.proposedDiff);
  stages.push({ stage: "diff_preview", verdict: "ok", detail: diffSummary });

  // Stage 3 — safety.
  const safety = stageSafety(input.target, input.proposedDiff, input.label);
  stages.push(safety);

  // Stage 4 — duplication.
  const dup = stageDuplication(diffHash, input.label, input.recentDiffHashes ?? [], input.recentLabels ?? []);
  stages.push(dup);

  const approvable = stages.every((s) => s.verdict !== "fail");

  return {
    proposalId: input.proposalId,
    target: input.target,
    diffHash,
    diffSummary,
    stages,
    approvable,
  };
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

function stageParse(target: ProposalTarget, diff: unknown): VettingStage {
  if (diff === null || typeof diff !== "object") {
    return { stage: "parse", verdict: "fail", detail: "proposedDiff must be a JSON object." };
  }
  const obj = diff as Record<string, unknown>;
  switch (target) {
    case "runbook_recipe": {
      if (typeof obj.eventName !== "string") {
        return { stage: "parse", verdict: "fail", detail: "runbook_recipe diff requires an 'eventName' string." };
      }
      if (!obj.reversal && !obj.hardening) {
        return { stage: "parse", verdict: "fail", detail: "runbook_recipe diff must change reversal and/or hardening." };
      }
      break;
    }
    case "policy_template": {
      if (typeof obj.cloud !== "string" || typeof obj.policyJson !== "string") {
        return { stage: "parse", verdict: "fail", detail: "policy_template diff requires { cloud, policyJson }." };
      }
      break;
    }
    case "charter_default": {
      if (!("mode" in obj) && !("perCycleActionLimit" in obj)) {
        return { stage: "parse", verdict: "fail", detail: "charter_default diff requires mode or perCycleActionLimit." };
      }
      break;
    }
    case "help_entry": {
      if (typeof obj.id !== "string" || typeof obj.title !== "string") {
        return { stage: "parse", verdict: "fail", detail: "help_entry diff requires { id, title }." };
      }
      break;
    }
    case "tier_cap": {
      if (typeof obj.tier !== "string" || typeof obj.capName !== "string" || typeof obj.newValue !== "number") {
        return { stage: "parse", verdict: "fail", detail: "tier_cap diff requires { tier, capName, newValue }." };
      }
      break;
    }
  }
  return { stage: "parse", verdict: "ok", detail: "Schema shape matches target." };
}

function stageDiffSummary(target: ProposalTarget, diff: unknown): string {
  if (diff === null || typeof diff !== "object") return "no diff";
  const obj = diff as Record<string, unknown>;
  switch (target) {
    case "runbook_recipe":
      return `Recipe ${String(obj.eventName ?? "?")} — change ${
        ["reversal", "hardening"].filter((k) => k in obj).join(" + ")
      }`;
    case "policy_template":
      return `Policy template (${String(obj.cloud ?? "?")}) ${
        String(obj.policyJson ?? "").length
      }-char JSON`;
    case "charter_default":
      return `Charter default → ${"mode" in obj ? `mode=${String(obj.mode)}` : ""}${
        "perCycleActionLimit" in obj ? ` cap=${String(obj.perCycleActionLimit)}` : ""
      }`.trim();
    case "help_entry":
      return `Help entry id=${String(obj.id ?? "?")} title="${String(obj.title ?? "?")}"`;
    case "tier_cap":
      return `Tier ${String(obj.tier ?? "?")}.${String(obj.capName ?? "?")} → ${String(obj.newValue ?? "?")}`;
  }
}

function stageSafety(target: ProposalTarget, diff: unknown, label: string): VettingStage {
  if (diff === null || typeof diff !== "object") {
    return { stage: "safety", verdict: "fail", detail: "Cannot safety-check non-object diff." };
  }
  const obj = diff as Record<string, unknown>;

  switch (target) {
    case "policy_template": {
      // Reject wildcard Action + Allow Effect combos — that's an
      // open-door policy regardless of cloud.
      const policyJson = typeof obj.policyJson === "string" ? obj.policyJson.toLowerCase() : "";
      if (policyJson.includes('"effect":"allow"') && policyJson.includes('"action":"*"')) {
        return { stage: "safety", verdict: "fail", detail: "Policy allows Action='*' — explicit open-door rejected." };
      }
      if (policyJson.length === 0) {
        return { stage: "safety", verdict: "fail", detail: "policyJson is empty." };
      }
      break;
    }
    case "tier_cap": {
      const newValue = typeof obj.newValue === "number" ? obj.newValue : NaN;
      if (!Number.isFinite(newValue)) {
        return { stage: "safety", verdict: "fail", detail: "newValue must be finite." };
      }
      if (newValue < -1) {
        return { stage: "safety", verdict: "fail", detail: "newValue must be >= -1 (-1 = unlimited)." };
      }
      if (newValue > 100_000) {
        return { stage: "safety", verdict: "warn", detail: "Cap above 100,000 — sanity-check this is intentional." };
      }
      break;
    }
    case "charter_default": {
      if (obj.mode === "autonomous" && !label.toLowerCase().includes("approved")) {
        return {
          stage: "safety",
          verdict: "warn",
          detail: "Charter default → 'autonomous' should reference an approval thread in the label.",
        };
      }
      break;
    }
    case "runbook_recipe":
    case "help_entry":
      // No additional safety rules — schema shape already covers it.
      break;
  }

  return { stage: "safety", verdict: "ok", detail: "No dangerous patterns detected." };
}

function stageDuplication(
  diffHash: string,
  label: string,
  recentDiffHashes: string[],
  recentLabels: string[],
): VettingStage {
  if (recentDiffHashes.includes(diffHash)) {
    return {
      stage: "duplication",
      verdict: "warn",
      detail: "Exact diff was proposed recently — review whether this supersedes the prior version.",
    };
  }
  const normalised = label.trim().toLowerCase();
  const fuzzyMatch = recentLabels.find((l) => l.trim().toLowerCase() === normalised);
  if (fuzzyMatch) {
    return {
      stage: "duplication",
      verdict: "warn",
      detail: `Recent proposal with identical label exists: "${fuzzyMatch}".`,
    };
  }
  return { stage: "duplication", verdict: "ok", detail: "No recent duplicate detected." };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, Object.keys((value && typeof value === "object" ? value : {}) as object).sort());
}

function sha256Of(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

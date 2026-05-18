/**
 * Autonomy charter resolver.
 *
 * Returns the active AutonomyCharter for a tenant. The charter is the
 * single source of truth controlling how far the loop can advance on
 * its own. Until persistence is wired, every tenant gets the same
 * conservative default — operator must explicitly upgrade.
 */

import "server-only";

import type { AutonomyCharter, AutonomyMode } from "./autonomousLoopModel";

export function defaultCharter(): AutonomyCharter {
  return {
    mode: "observer",
    allowedClasses: [
      "readonly_allowed",
      "preview_allowed",
      "simulation_allowed",
    ],
    perCycleActionLimit: 5,
    rationale: "Default — observer mode. Loop runs to surface decisions but never auto-approves; operator drives every transition.",
  };
}

export function reviewCharter(): AutonomyCharter {
  return {
    mode: "review",
    allowedClasses: [
      "readonly_allowed",
      "preview_allowed",
      "simulation_allowed",
    ],
    perCycleActionLimit: 8,
    rationale: "Review mode — loop auto-approves read-only / preview / simulation classes; everything else halts for human review.",
  };
}

export function assistedCharter(): AutonomyCharter {
  return {
    mode: "assisted",
    allowedClasses: [
      "readonly_allowed",
      "preview_allowed",
      "simulation_allowed",
      "desktop_review_allowed",
    ],
    perCycleActionLimit: 10,
    rationale: "Assisted mode — loop auto-approves and hands desktop-reviewable actions to the paired runtime; mutations remain halted.",
  };
}

export function autonomousCharter(): AutonomyCharter {
  return {
    mode: "autonomous",
    allowedClasses: [
      "readonly_allowed",
      "preview_allowed",
      "simulation_allowed",
      "desktop_review_allowed",
      "approval_required",
    ],
    perCycleActionLimit: 15,
    rationale: "Autonomous mode — loop drives policy-gated executions end-to-end. Unsafe + credentialed-disabled classes always halt regardless of mode.",
  };
}

export function charterForMode(mode: AutonomyMode): AutonomyCharter {
  switch (mode) {
    case "observer":   return defaultCharter();
    case "review":     return reviewCharter();
    case "assisted":   return assistedCharter();
    case "autonomous": return autonomousCharter();
  }
}

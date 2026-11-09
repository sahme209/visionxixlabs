/**
 * Execution families with no Governance admission or enrollment refusal yet
 * (docs/recovery/2026-11-02/governance-execution-coverage-current.md; F15 and
 * F16 have since gained refusal; F17, F18 and M01 gained enrolled refusal on
 * 2026-11-09, see enrolledRefusalPolicy.ts). Pure and static: this list can only make the
 * readiness report stricter. It is never a coverage receipt, and removing an
 * entry requires the reviewed coverage work, not an edit here.
 */
export const UNCOVERED_FAMILIES = [
  // Autonomy loosening is refused while enrolled; provider and branch policy are not yet classified.
  { id: "M02", name: "AI provider policy and branch policy", scope: "scope_decision_pending" },
  { id: "M03", name: "Consent and OAuth connections", scope: "scope_decision_pending" },
  { id: "M04", name: "API keys and webhook configuration", scope: "scope_decision_pending" },
  { id: "P01", name: "Platform deploy, template hosting and growth publishing", scope: "platform_scope_question" },
] as const;

export type UncoveredFamilyId = (typeof UNCOVERED_FAMILIES)[number]["id"];

/** Readiness stays blocked while any family is uncovered; nothing here can report ready. */
export function readinessBlockers(): { status: "blocked"; executionAuthorized: false; uncoveredFamilies: typeof UNCOVERED_FAMILIES } {
  return { status: "blocked", executionAuthorized: false, uncoveredFamilies: UNCOVERED_FAMILIES };
}

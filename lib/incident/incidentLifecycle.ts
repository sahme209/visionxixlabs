/**
 * Incident-response lifecycle — pure kernel, no I/O.
 *
 * Closes the named gap in docs/COMPLIANCE_CONTROL_MAPPING.md: there was
 * no incident-response evidence model distinct from general audit
 * events. This module is the decision logic only; the IO boundary
 * (Prisma reads/writes against IncidentRecord) is a separate, narrow
 * file that composes this kernel with the database — not built yet,
 * intentionally, per the "pure kernels for every decision" principle.
 *
 * Terminal state: postmortem_complete never transitions anywhere —
 * completed postmortems are immutable evidence, not something to be
 * silently reopened.
 */

export type IncidentStatus =
  | "detected"
  | "investigating"
  | "mitigated"
  | "resolved"
  | "postmortem_complete";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export function isIncidentStatus(value: unknown): value is IncidentStatus {
  return value === "detected" || value === "investigating" || value === "mitigated"
    || value === "resolved" || value === "postmortem_complete";
}

export function isIncidentSeverity(value: unknown): value is IncidentSeverity {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

/**
 * Forward progression requires passing through each stage explicitly —
 * an incident can't jump from "detected" straight to "resolved" even if
 * the fix was trivial, because skipping "investigating"/"mitigated"
 * would mean no evidence was ever recorded for those stages. Regression
 * paths (caught after a premature mitigation/resolution) reopen back to
 * "investigating", never silently back to "detected".
 */
const VALID_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  detected: ["investigating"],
  investigating: ["mitigated"],
  mitigated: ["resolved", "investigating"],
  resolved: ["postmortem_complete", "investigating"],
  postmortem_complete: [],
};

export function validTransitionsFrom(current: IncidentStatus): readonly IncidentStatus[] {
  return VALID_TRANSITIONS[current];
}

export function canTransition(current: IncidentStatus, target: IncidentStatus): boolean {
  return VALID_TRANSITIONS[current].includes(target);
}

export interface IncidentTransitionInput {
  currentStatus: IncidentStatus;
  targetStatus: IncidentStatus;
  now: Date;
}

export type IncidentTransitionResult =
  | {
    ok: true;
    patch: {
      status: IncidentStatus;
      mitigatedAt?: Date | null;
      resolvedAt?: Date | null;
      postmortemCompletedAt?: Date | null;
    };
  }
  | { ok: false; reason: "invalid_transition" | "already_terminal" };

/**
 * Computes the exact field patch a caller should persist for a given
 * transition — never does the write itself. A reopen transition clears
 * the timestamp(s) for stages being walked back past, so the record
 * never claims a resolution/postmortem timestamp for a state it's no
 * longer in.
 */
export function planIncidentTransition(input: IncidentTransitionInput): IncidentTransitionResult {
  if (input.currentStatus === "postmortem_complete") {
    return { ok: false, reason: "already_terminal" };
  }
  if (!canTransition(input.currentStatus, input.targetStatus)) {
    return { ok: false, reason: "invalid_transition" };
  }

  switch (input.targetStatus) {
    case "mitigated":
      return { ok: true, patch: { status: "mitigated", mitigatedAt: input.now } };
    case "resolved":
      return { ok: true, patch: { status: "resolved", resolvedAt: input.now } };
    case "postmortem_complete":
      return { ok: true, patch: { status: "postmortem_complete", postmortemCompletedAt: input.now } };
    case "investigating":
      // Reopen: clear downstream timestamps so the record never shows a
      // resolvedAt/mitigatedAt for a stage the incident has walked back
      // out of.
      return {
        ok: true,
        patch: { status: "investigating", mitigatedAt: null, resolvedAt: null, postmortemCompletedAt: null },
      };
    case "detected":
      return { ok: false, reason: "invalid_transition" };
  }
}

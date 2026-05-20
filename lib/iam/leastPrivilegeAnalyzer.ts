/**
 * Pure IAM least-privilege analyzer.
 *
 * Given a role's currently-attached policy actions and a window of
 * observed-used actions (from CloudTrail or similar), report:
 *   - unusedActions: granted but not used in the window
 *   - missingActions: used but not granted (privilege escalation hint)
 *   - overGrantRatio: 0..1 share of attached actions never used
 *   - severity ladder + suggested tightened action list
 *
 * Pure / deterministic. No DB.
 */

export interface LeastPrivilegeInput {
  attachedActions: readonly string[];
  observedActions: readonly string[];
  /** Optional: treat these prefixes (e.g. "iam:") as never to recommend removing. */
  alwaysKeepPrefixes?: readonly string[];
}

export interface LeastPrivilegeReport {
  attachedCount: number;
  observedCount: number;
  unusedActions: string[];
  missingActions: string[];
  /** unused / attached (0..1). NaN-safe (0 when attachedCount is 0). */
  overGrantRatio: number;
  /** Suggested action set = (attached ∪ observed) − unused (minus alwaysKeep). */
  tightenedActions: string[];
  severity: "ok" | "low" | "medium" | "high";
}

const normalize = (xs: readonly string[]): Set<string> => new Set(xs.map((x) => x.trim()).filter((x) => x.length > 0));

const startsWithAny = (action: string, prefixes: readonly string[]): boolean => {
  for (const p of prefixes) if (action === p || action.startsWith(p)) return true;
  return false;
};

const rankSeverity = (ratio: number, missing: number): LeastPrivilegeReport["severity"] => {
  if (missing > 0) return "high";
  if (ratio >= 0.5) return "high";
  if (ratio >= 0.25) return "medium";
  if (ratio > 0) return "low";
  return "ok";
};

export function analyzeLeastPrivilege(input: LeastPrivilegeInput): LeastPrivilegeReport {
  const attached = normalize(input.attachedActions);
  const observed = normalize(input.observedActions);
  const alwaysKeep = input.alwaysKeepPrefixes ?? [];

  const unused: string[] = [];
  for (const a of attached) {
    if (observed.has(a)) continue;
    if (startsWithAny(a, alwaysKeep)) continue;
    unused.push(a);
  }
  unused.sort();

  const missing: string[] = [];
  for (const a of observed) if (!attached.has(a)) missing.push(a);
  missing.sort();

  const overGrantRatio = attached.size === 0 ? 0 : unused.length / attached.size;

  const tightened = new Set<string>([...observed, ...[...attached].filter((a) => startsWithAny(a, alwaysKeep))]);
  // We don't add `missing` here automatically — those are signals for the
  // operator to investigate, not auto-grants.

  return {
    attachedCount: attached.size,
    observedCount: observed.size,
    unusedActions: unused,
    missingActions: missing,
    overGrantRatio,
    tightenedActions: [...tightened].sort(),
    severity: rankSeverity(overGrantRatio, missing.length),
  };
}

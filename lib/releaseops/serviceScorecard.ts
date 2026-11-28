/**
 * Service scorecards (pure). One card per repository from recorded data: ownership, guardrails,
 * delivery and open incidents. Each check passes, fails or is unknown (not enough data); unknown never
 * counts as a pass. The grade is the share of known checks that pass. It describes recorded delivery
 * practice, not the live health of the customer's systems.
 */
import type { CatalogRow } from "./serviceCatalog";

export type ScoreState = "pass" | "fail" | "unknown";
export interface ScoreCheck { id: ScoreCheckId; label: string; state: ScoreState; detail: string }
export type ScoreCheckId = "owner" | "codeowners" | "branch_protection" | "recent_delivery" | "success_rate" | "open_incidents";
export type ScoreGrade = "strong" | "fair" | "weak" | "unknown";
export interface ServiceScorecard { repository: string; checks: ScoreCheck[]; passed: number; known: number; grade: ScoreGrade; nextStep: string | null }

export const RECENT_DELIVERY_DAYS = 30;
export const SUCCESS_TARGET_PCT = 80;

const NEXT_STEP: Record<ScoreCheckId, string> = {
  owner: "Record an owning team on a component of this repository.",
  codeowners: "Add a CODEOWNERS file so changes get a named reviewer.",
  branch_protection: "Protect the default branch in your Git provider.",
  recent_delivery: "Ship a change through V19 so delivery is recorded.",
  success_rate: "Look at the failed runs; a check at an earlier stage may catch them sooner.",
  open_incidents: "Resolve or mitigate the open incidents linked to this repository's releases.",
};

export function scoreService(row: CatalogRow, openIncidents: number | null, now: Date): ServiceScorecard {
  const failureRate = row.recentFailureRate;
  const daysSince = row.lastDeployedAt ? (now.getTime() - Date.parse(row.lastDeployedAt)) / 86_400_000 : null;
  const checks: ScoreCheck[] = [
    { id: "owner", label: "Owner recorded", state: row.owners.length ? "pass" : "fail", detail: row.owners.length ? row.owners.join(", ") : "No owning team recorded." },
    { id: "codeowners", label: "CODEOWNERS", state: row.guardrails.codeowners ? "pass" : "fail", detail: row.guardrails.codeowners ? "Present at the last scan." : "Not found at the last scan." },
    { id: "branch_protection", label: "Default branch protected", state: row.guardrails.defaultBranchProtected ? "pass" : "fail", detail: row.guardrails.defaultBranchProtected ? "Protected at the last scan." : "Not protected at the last scan." },
    { id: "recent_delivery", label: `Delivered in the last ${RECENT_DELIVERY_DAYS} days`, state: daysSince === null ? "fail" : daysSince <= RECENT_DELIVERY_DAYS ? "pass" : "fail", detail: daysSince === null ? "No recorded run." : `Last run ${Math.max(0, Math.floor(daysSince))} day${Math.floor(daysSince) === 1 ? "" : "s"} ago.` },
    { id: "success_rate", label: `At least ${SUCCESS_TARGET_PCT}% of runs succeed`, state: failureRate === null ? "unknown" : 100 - failureRate >= SUCCESS_TARGET_PCT ? "pass" : "fail", detail: failureRate === null ? "No finished runs yet." : `${100 - failureRate}% of recent finished runs succeeded.` },
    { id: "open_incidents", label: "No open incidents", state: openIncidents === null ? "unknown" : openIncidents === 0 ? "pass" : "fail", detail: openIncidents === null ? "Incidents could not be read." : openIncidents === 0 ? "None open." : `${openIncidents} open or mitigated.` },
  ];
  const known = checks.filter((c) => c.state !== "unknown").length;
  const passed = checks.filter((c) => c.state === "pass").length;
  const grade: ScoreGrade = known < 3 ? "unknown" : passed === known ? "strong" : passed / known >= 0.6 ? "fair" : "weak";
  const firstFail = checks.find((c) => c.state === "fail");
  return { repository: row.repository, checks, passed, known, grade, nextStep: firstFail ? NEXT_STEP[firstFail.id] : null };
}

/** Weakest first, so attention goes where it is needed; ties by name. */
export function rankScorecards(cards: readonly ServiceScorecard[]): ServiceScorecard[] {
  const rank: Record<ScoreGrade, number> = { weak: 0, fair: 1, unknown: 2, strong: 3 };
  return [...cards].sort((a, b) => rank[a.grade] - rank[b.grade] || (a.known ? a.passed / a.known : 0) - (b.known ? b.passed / b.known : 0) || a.repository.localeCompare(b.repository));
}

/** Open incidents per repository id, from incidents and the repository each release is bound to. */
export function openIncidentsByRepository(incidents: ReadonlyArray<{ releaseId: string; status: string }>, releases: ReadonlyArray<{ id: string; evidenceRepositoryId: string | null }>): Map<string, number> {
  const repoOf = new Map(releases.map((r) => [r.id, r.evidenceRepositoryId]));
  const out = new Map<string, number>();
  for (const i of incidents) {
    if (i.status !== "open" && i.status !== "mitigated") continue;
    const repo = repoOf.get(i.releaseId);
    if (repo) out.set(repo, (out.get(repo) ?? 0) + 1);
  }
  return out;
}

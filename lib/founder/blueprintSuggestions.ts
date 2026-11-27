/**
 * Suggestions for the founder blueprint, worked out from the map and V19's live records (pure).
 * A suggestion only proposes an edit; nothing changes until the founder applies it and saves.
 */
import { departmentCost, type Blueprint, type BlueprintStep, type SignalKey } from "./blueprint";

export type Suggestion =
  | { id: string; kind: "mark_live"; stepId: string; title: string; reason: string }
  | { id: string; kind: "needs_attention"; stepId: string; title: string; reason: string }
  | { id: string; kind: "assign_owner"; stepId: string; title: string; reason: string }
  | { id: string; kind: "add_cost"; departmentId: string; title: string; reason: string };

const ATTENTION: ReadonlySet<SignalKey> = new Set(["deployments_failed_7d", "incidents_open", "freezes_active", "agent_requests_pending", "webhook_failures_7d", "unanswered_questions_30d", "at_risk_workspaces"]);

export function suggestBlueprintChanges(b: Blueprint, signals: Partial<Record<SignalKey, number | null>>, limit = 12): Suggestion[] {
  const out: Suggestion[] = [];
  const active = b.steps.filter((s) => s.status !== "archived");
  for (const s of active) {
    const v = s.signal ? signals[s.signal] : null;
    if (s.signal && typeof v === "number" && v > 0 && !ATTENTION.has(s.signal) && (s.status === "draft" || s.status === "in_progress")) {
      out.push({ id: `live:${s.id}`, kind: "mark_live", stepId: s.id, title: `Mark "${s.title}" as live`, reason: `V19 recorded ${v.toLocaleString()} for this step, so it is already running.` });
    }
    if (s.signal && ATTENTION.has(s.signal) && typeof v === "number" && v > 0) {
      out.push({ id: `attention:${s.id}`, kind: "needs_attention", stepId: s.id, title: `Look at "${s.title}"`, reason: `It watches a signal that is at ${v.toLocaleString()} now.` });
    }
  }
  for (const s of active.filter((x) => x.status === "live" && !x.owner.trim())) {
    out.push({ id: `owner:${s.id}`, kind: "assign_owner", stepId: s.id, title: `Give "${s.title}" an owner`, reason: "Live steps should say who is responsible." });
  }
  for (const d of b.departments) {
    const c = departmentCost(b, d.id);
    if (c.live > 0 && c.monthlyTotal === 0) out.push({ id: `cost:${d.id}`, kind: "add_cost", departmentId: d.id, title: `Add costs to ${d.name}`, reason: `${c.live} live ${c.live === 1 ? "step has" : "steps have"} no time or tool cost yet, so its monthly cost shows as $0.` });
  }
  const order = { needs_attention: 0, mark_live: 1, assign_owner: 2, add_cost: 3 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, limit);
}

/** Applies a suggestion that has a direct edit (marking a step live). Others open the step or department instead. */
export function applySuggestion(b: Blueprint, s: Suggestion): Blueprint {
  if (s.kind !== "mark_live") return b;
  return { ...b, steps: b.steps.map((x: BlueprintStep) => (x.id === s.stepId ? { ...x, status: "live" as const } : x)) };
}

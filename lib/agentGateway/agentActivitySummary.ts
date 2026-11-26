/** Agent gateway activity over a window, for Insights (pure). */
import { LANE_LABEL, type ReviewLane } from "./reviewTriage";

export interface AgentActivityRow { status: string; reviewTriage: unknown; agentName: string }
export interface AgentActivity { total: number; approved: number; rejected: number; pending: number; byLane: Array<{ lane: ReviewLane; label: string; count: number }>; agents: number }

export function summarizeAgentActivity(rows: readonly AgentActivityRow[]): AgentActivity {
  const lanes = new Map<ReviewLane, number>();
  for (const r of rows) {
    const t = r.reviewTriage && typeof r.reviewTriage === "object" ? (r.reviewTriage as { lane?: unknown }).lane : undefined;
    if (typeof t === "string" && t in LANE_LABEL) lanes.set(t as ReviewLane, (lanes.get(t as ReviewLane) ?? 0) + 1);
  }
  const order: ReviewLane[] = ["auto", "quick", "careful", "two_person", "refused"];
  return {
    total: rows.length,
    approved: rows.filter((r) => r.status === "approved" || r.status === "completed").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    pending: rows.filter((r) => r.status === "pending").length,
    byLane: order.filter((l) => lanes.has(l)).map((l) => ({ lane: l, label: LANE_LABEL[l], count: lanes.get(l)! })),
    agents: new Set(rows.map((r) => r.agentName)).size,
  };
}

/** Counts release-gate refusals by reason from recorded audit events (pure). */
export const GATE_REASON_LABEL: Record<string, string> = {
  outside_change_window: "Outside the change window",
  deployment_freeze_active: "During a freeze",
  change_window_unreadable: "Unreadable change window rule",
  stability_warning_active: "Stability warning without a reason",
  deployment_checks_blocking: "Blocking checks not passed",
  previous_ring_not_deployed: "Previous ring not deployed",
};
export function summarizeGateRefusals(events: ReadonlyArray<{ detailJson: unknown }>): { total: number; byReason: Array<{ reason: string; label: string; count: number }> } {
  const counts = new Map<string, number>();
  for (const e of events) {
    const d = e.detailJson && typeof e.detailJson === "object" && !Array.isArray(e.detailJson) ? (e.detailJson as Record<string, unknown>) : null;
    const reason = typeof d?.reason === "string" ? d.reason : "other";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const byReason = [...counts.entries()].map(([reason, count]) => ({ reason, label: GATE_REASON_LABEL[reason] ?? "Other", count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
  return { total: events.length, byReason };
}

/** Deployment freeze history from recorded audit events (pure). Newest first. */
export interface FreezeHistoryEntry { at: string; kind: "started" | "ended"; reason: string; environments: string[]; source: "cockpit" | "api_key" | "unknown"; endsAt: string | null }

export function summarizeFreezeHistory(events: ReadonlyArray<{ kind: string; createdAt: Date; detailJson: unknown }>, limit = 10): { started: number; ended: number; entries: FreezeHistoryEntry[] } {
  const entries: FreezeHistoryEntry[] = [];
  let started = 0, ended = 0;
  for (const e of [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    if (e.kind !== "environment.freeze" && e.kind !== "environment.freeze_end") continue;
    const d = e.detailJson && typeof e.detailJson === "object" && !Array.isArray(e.detailJson) ? (e.detailJson as Record<string, unknown>) : {};
    const kind = e.kind === "environment.freeze" ? "started" : "ended";
    if (kind === "started") started += 1; else ended += 1;
    if (entries.length >= limit) continue;
    entries.push({
      at: e.createdAt.toISOString(),
      kind,
      reason: typeof d.reason === "string" ? d.reason : "No reason recorded",
      environments: Array.isArray(d.environments) ? d.environments.filter((x): x is string => typeof x === "string") : [],
      source: d.source === "cockpit" || d.source === "api_key" ? d.source : "unknown",
      endsAt: typeof d.endsAt === "string" ? d.endsAt : null,
    });
  }
  return { started, ended, entries };
}

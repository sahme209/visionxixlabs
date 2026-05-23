/**
 * Connector-health transition detector — Phase 410.
 *
 * Pure decision: given the previous snapshot and the current snapshot
 * (both from `computeConnectorHealth()` — Phase 407), decide what
 * transition events should fire. The cron job calls this; tests pin
 * every branch.
 *
 * Why a separate kernel:
 *   - The cron must NOT fire on every poll (90 polls/day per
 *     connector). It fires only on actual status flips.
 *   - First-time-seen connectors emit `first_observed` rather than a
 *     misleading "healthy → degraded" transition.
 *   - Repeated identical statuses → no event (idempotency).
 */

import type { ConnectorHealthStatus } from "./connectorHealth";

export interface ConnectorStateRow {
  name: string;
  status: ConnectorHealthStatus;
  reason: string;
}

export type ConnectorTransitionKind =
  | "first_observed"
  | "recovered"        // anything-non-healthy → healthy
  | "degraded"         // healthy → anything-non-healthy
  | "status_changed";  // non-healthy → different non-healthy (e.g. degraded → stale)

export interface ConnectorTransition {
  connectorName: string;
  kind: ConnectorTransitionKind;
  previousStatus: ConnectorHealthStatus | null; // null only when kind=first_observed
  currentStatus: ConnectorHealthStatus;
  reason: string;
}

/**
 * Pure function.
 *
 * `previous` and `current` are matched by `name`. Connectors present in
 * one snapshot but not the other are handled:
 *   - present in current only → emits `first_observed`
 *   - present in previous only → ignored (caller decides whether to
 *     emit a removal event; we keep the transitions surface narrow).
 */
export function detectTransitions(
  previous: ReadonlyArray<ConnectorStateRow>,
  current: ReadonlyArray<ConnectorStateRow>,
): ReadonlyArray<ConnectorTransition> {
  const prevByName = new Map(previous.map((p) => [p.name, p]));
  const out: ConnectorTransition[] = [];

  for (const c of current) {
    const prev = prevByName.get(c.name);
    if (!prev) {
      out.push({
        connectorName: c.name,
        kind: "first_observed",
        previousStatus: null,
        currentStatus: c.status,
        reason: c.reason,
      });
      continue;
    }
    if (prev.status === c.status) continue; // idempotent — no event

    if (prev.status !== "healthy" && c.status === "healthy") {
      out.push({
        connectorName: c.name,
        kind: "recovered",
        previousStatus: prev.status,
        currentStatus: c.status,
        reason: c.reason,
      });
      continue;
    }
    if (prev.status === "healthy" && c.status !== "healthy") {
      out.push({
        connectorName: c.name,
        kind: "degraded",
        previousStatus: prev.status,
        currentStatus: c.status,
        reason: c.reason,
      });
      continue;
    }
    // Non-healthy → different non-healthy (degraded → stale, etc).
    out.push({
      connectorName: c.name,
      kind: "status_changed",
      previousStatus: prev.status,
      currentStatus: c.status,
      reason: c.reason,
    });
  }

  return out;
}

/**
 * Summary helpers used by the cron route to short-circuit the dispatch
 * when nothing changed (saves audit + webhook rows on the common case).
 */
export function hasMeaningfulTransitions(ts: ReadonlyArray<ConnectorTransition>): boolean {
  // first_observed of a healthy connector is genuinely-empty signal —
  // don't waste a webhook on it. Everything else is meaningful.
  return ts.some((t) => !(t.kind === "first_observed" && t.currentStatus === "healthy"));
}

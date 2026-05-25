/**
 * Phase 419 — bulk-apply for cron loops.
 *
 * Walks a batch of (session, probeOutcome) pairs, asks the Phase 416
 * decider what kernel event each one needs, and applies it via the
 * Phase 414 repo. Returns a per-row outcome + an aggregate tally so
 * the caller (cron handler, replay tool, debug CLI) can log a single
 * structured summary instead of N noisy lines.
 *
 * Why a dedicated bulk function: a cron loop that calls
 * `applyConnectorSetupEvent` in a per-session for-loop works, but it
 * doesn't have an obvious place to:
 *   - track which sessions were no-ops vs real transitions
 *   - collect errors without aborting the whole tick
 *   - apply a single actor label uniformly
 *
 * This module gives all three. Pure orchestration over the existing
 * decider + repo — no new I/O.
 */

import {
  decideHealthCheckEvent,
  type ProbeOutcome,
  type NoopReason,
} from "./healthCheckDecision";
import {
  applyConnectorSetupEvent,
  type ApplyEventResult,
  type ConnectorSetupRepo,
  type ConnectorSetupSessionRow,
} from "./connectorSetupRepo";

/* ──────────────────────────────────────────────────────────────────
   Input + output shapes.
   ────────────────────────────────────────────────────────────── */

export interface BulkApplyItem {
  session: Pick<ConnectorSetupSessionRow, "id" | "organizationId" | "provider" | "status">;
  probeOutcome: ProbeOutcome;
}

export type BulkApplyOutcome =
  | { kind: "noop"; sessionId: string; reason: NoopReason }
  | { kind: "applied"; sessionId: string; result: ApplyEventResult }
  | { kind: "errored"; sessionId: string; error: string };

export interface BulkApplyResult {
  perSession: BulkApplyOutcome[];
  summary: {
    total: number;
    applied: number;       // kernel emitted + persistence wrote a row
    appliedLegal: number;  // subset of applied with ok:true
    appliedIllegal: number;// subset of applied with ok:false (shouldn't happen if decider is correct)
    noop: number;
    errored: number;
  };
}

export interface BulkApplyOptions {
  /** Actor stamped on every emitted transition. Defaults to "cron:health-check". */
  actorLabel?: string;
  /** Override clock for tests / replay. */
  now?: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function bulkApplyHealthChecks(
  repo: ConnectorSetupRepo,
  items: ReadonlyArray<BulkApplyItem>,
  opts: BulkApplyOptions = {},
): Promise<BulkApplyResult> {
  const actorLabel = opts.actorLabel ?? "cron:health-check";
  const now = opts.now;

  const perSession: BulkApplyOutcome[] = [];

  for (const item of items) {
    const decision = decideHealthCheckEvent(item.session.status, item.probeOutcome);
    if (decision.kind === "noop") {
      perSession.push({ kind: "noop", sessionId: item.session.id, reason: decision.reason });
      continue;
    }
    try {
      const result = await applyConnectorSetupEvent(repo, {
        organizationId: item.session.organizationId,
        provider:       item.session.provider,
        event:          decision.event,
        actor:          { systemLabel: actorLabel },
        ...(now ? { now } : {}),
      });
      perSession.push({ kind: "applied", sessionId: item.session.id, result });
    } catch (err) {
      perSession.push({
        kind: "errored",
        sessionId: item.session.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { perSession, summary: tally(perSession) };
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function tally(perSession: ReadonlyArray<BulkApplyOutcome>): BulkApplyResult["summary"] {
  let applied = 0, appliedLegal = 0, appliedIllegal = 0, noop = 0, errored = 0;
  for (const o of perSession) {
    if (o.kind === "noop")    noop += 1;
    if (o.kind === "errored") errored += 1;
    if (o.kind === "applied") {
      applied += 1;
      if (o.result.ok)        appliedLegal += 1;
      else                    appliedIllegal += 1;
    }
  }
  return { total: perSession.length, applied, appliedLegal, appliedIllegal, noop, errored };
}

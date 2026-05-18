/**
 * Autonomy Scheduler.
 *
 * Runs the closed Autonomy Loop unattended on a fixed cadence. Each
 * cron tick:
 *
 *   1. Enumerates active tenants (server-only — never exposes the list).
 *   2. For each tenant, resolves the tenant's autonomy charter.
 *   3. Runs one declared cycle.
 *   4. Persists the per-cycle transcript to an in-memory ring buffer
 *      (cap 100 cycles) so the cockpit can render history.
 *
 * Hard rules:
 *   - The scheduler refuses to start unless AUTONOMY_SCHEDULER_ENABLED
 *     is set. Operators opt in deliberately.
 *   - The scheduler caps perCycleActionLimit at 5 regardless of charter
 *     when running unattended (extra hard guard — observer mode still
 *     applies if charter says so).
 *   - Every cycle emits a typed scheduler audit record (no fabricated
 *     entries).
 *   - The scheduler NEVER calls AWS/Azure/GCP SDKs directly. It runs
 *     the autonomy runner which itself reads canonical state only.
 */

import "server-only";

import { runAutonomousLoopCycle } from "./autonomousLoopRunner";
import { charterForMode } from "./autonomyCharter";
import { loadAppEnv } from "@/lib/config/env";
import type { OrganizationId } from "@/lib/domain/ids";
import type { AutonomyCycleReport, AutonomyMode } from "./autonomousLoopModel";

// ---------------------------------------------------------------------------
// In-memory cycle history (ephemeral until DATABASE_URL persistence)
// ---------------------------------------------------------------------------

const HISTORY: AutonomyCycleReport[] = [];
const MAX_HISTORY = 100;

export function readAutonomyHistory(): AutonomyCycleReport[] {
  return [...HISTORY].reverse();
}

export function clearAutonomyHistory(): number {
  const n = HISTORY.length;
  HISTORY.length = 0;
  return n;
}

// ---------------------------------------------------------------------------
// Scheduler tick — invoked by the cron endpoint
// ---------------------------------------------------------------------------

export interface SchedulerTickResult {
  /** Did we run anything this tick? */
  ran: boolean;
  /** Per-tenant cycle reports produced. */
  cycles: AutonomyCycleReport[];
  /** Operator-readable summary line. */
  summary: string;
  /** Honest list of why we skipped any tenants. */
  skipped: { tenantId: string; reason: string }[];
  /** Tick duration in ms. */
  durationMs: number;
}

export interface RunSchedulerTickInput {
  /** Tenant ids to run. Caller is responsible for the list — server-only. */
  tenantIds: OrganizationId[];
  /** Override the per-tenant charter mode. Defaults to "observer". */
  modeOverride?: AutonomyMode;
}

const UNATTENDED_HARD_CAP = 5; // per-cycle action limit when running on cron

export async function runSchedulerTick(input: RunSchedulerTickInput): Promise<SchedulerTickResult> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.autonomySchedulerEnabled) {
    return {
      ran: false,
      cycles: [],
      summary: "AUTONOMY_SCHEDULER_ENABLED is not set — scheduler refused to run.",
      skipped: input.tenantIds.map((t) => ({ tenantId: String(t), reason: "scheduler_disabled" })),
      durationMs: Date.now() - start,
    };
  }

  if (input.tenantIds.length === 0) {
    return {
      ran: false,
      cycles: [],
      summary: "No tenants supplied.",
      skipped: [],
      durationMs: Date.now() - start,
    };
  }

  const cycles: AutonomyCycleReport[] = [];
  const skipped: { tenantId: string; reason: string }[] = [];

  for (const tenantId of input.tenantIds) {
    const mode: AutonomyMode = input.modeOverride ?? "observer";
    try {
      const charter = charterForMode(mode);
      // Hard cap per-cycle actions when running unattended.
      const capped = {
        ...charter,
        perCycleActionLimit: Math.min(charter.perCycleActionLimit, UNATTENDED_HARD_CAP),
        rationale: `${charter.rationale} (unattended cap: ${UNATTENDED_HARD_CAP}/cycle)`,
      };
      const report = await runAutonomousLoopCycle({
        tenantId,
        charter: capped,
      });
      cycles.push(report);
      HISTORY.push(report);
      if (HISTORY.length > MAX_HISTORY) HISTORY.shift();
    } catch (err) {
      skipped.push({
        tenantId: String(tenantId),
        reason: err instanceof Error ? err.message.slice(0, 200) : "unknown_error",
      });
    }
  }

  const passedCount = cycles.reduce((s, c) => s + c.summary.candidatesConsidered, 0);
  const haltedCount = cycles.reduce((s, c) => s + c.summary.haltedAtGate, 0);
  return {
    ran: cycles.length > 0,
    cycles,
    summary: `Ran ${cycles.length} cycle(s) · ${passedCount} candidates considered · ${haltedCount} halted at gate · ${skipped.length} tenant(s) skipped`,
    skipped,
    durationMs: Date.now() - start,
  };
}

/**
 * Phase 421 — digest diff.
 *
 * Compares two OrgDigest snapshots taken at different times and surfaces
 * exactly what changed. Drives "what happened in the last hour" alert
 * emails, sidebar pulse indicators, and the audit-log "since you last
 * looked" badge.
 *
 * Pure function — operates on the digest output of Phase 420 with no
 * I/O of its own. Adds no new state.
 *
 * Diff categories (per provider):
 *   - status_changed       (any kernel status transition)
 *   - became_actionable    (was healthy, now needs operator attention)
 *   - became_healthy       (was actionable, now connected)
 *   - sticky_escalated     (errorClass shifted from non-sticky to sticky)
 *   - oscillation_escalated (errorClass shifted from non-oscillation to oscillation)
 *   - added                (in `current` but not `previous` — new provider connected)
 *   - removed              (in `previous` but not `current` — provider rows deleted)
 *
 * One provider can land in multiple buckets — e.g. a connected→failed
 * transition emits both `status_changed` AND `became_actionable`.
 */

import type { OrgDigest, ProviderDigest } from "./connectorSetupDigest";
import type { ConnectorSetupStatus } from "./connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Diff output shape.
   ────────────────────────────────────────────────────────────── */

export interface DigestDiff {
  generatedAt: Date;
  windowFromAt: Date;
  windowToAt: Date;
  statusChanged: StatusChange[];
  becameActionable: ProviderRef[];
  becameHealthy: ProviderRef[];
  stickyEscalated: ProviderRef[];
  oscillationEscalated: ProviderRef[];
  added: ProviderRef[];
  removed: ProviderRef[];
  /** True iff any of the above arrays is non-empty. Drives the "do we send a digest email?" gate. */
  hasChanges: boolean;
}

export interface StatusChange {
  provider: string;
  from: ConnectorSetupStatus;
  to: ConnectorSetupStatus;
}

export interface ProviderRef {
  provider: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function diffOrgDigests(previous: OrgDigest, current: OrgDigest): DigestDiff {
  const prevByProvider = indexByProvider(previous.providers);
  const currByProvider = indexByProvider(current.providers);

  const statusChanged: StatusChange[] = [];
  const becameActionable: ProviderRef[] = [];
  const becameHealthy: ProviderRef[] = [];
  const stickyEscalated: ProviderRef[] = [];
  const oscillationEscalated: ProviderRef[] = [];
  const added: ProviderRef[] = [];
  const removed: ProviderRef[] = [];

  for (const [provider, curr] of currByProvider) {
    const prev = prevByProvider.get(provider);
    if (!prev) {
      added.push({ provider });
      continue;
    }
    if (prev.status !== curr.status) {
      statusChanged.push({ provider, from: prev.status, to: curr.status });
    }
    if (!prev.actionable && curr.actionable) {
      becameActionable.push({ provider });
    }
    if (prev.actionable && !curr.actionable) {
      becameHealthy.push({ provider });
    }
    if (prev.errorClass.kind !== "sticky_error" && curr.errorClass.kind === "sticky_error") {
      stickyEscalated.push({ provider });
    }
    if (prev.errorClass.kind !== "chronic_oscillation" && curr.errorClass.kind === "chronic_oscillation") {
      oscillationEscalated.push({ provider });
    }
  }

  for (const provider of prevByProvider.keys()) {
    if (!currByProvider.has(provider)) {
      removed.push({ provider });
    }
  }

  const hasChanges =
    statusChanged.length > 0 ||
    becameActionable.length > 0 ||
    becameHealthy.length > 0 ||
    stickyEscalated.length > 0 ||
    oscillationEscalated.length > 0 ||
    added.length > 0 ||
    removed.length > 0;

  return {
    generatedAt: current.generatedAt,
    windowFromAt: previous.generatedAt,
    windowToAt: current.generatedAt,
    statusChanged,
    becameActionable,
    becameHealthy,
    stickyEscalated,
    oscillationEscalated,
    added,
    removed,
    hasChanges,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function indexByProvider(providers: ReadonlyArray<ProviderDigest>): Map<string, ProviderDigest> {
  const m = new Map<string, ProviderDigest>();
  for (const p of providers) m.set(p.provider, p);
  return m;
}

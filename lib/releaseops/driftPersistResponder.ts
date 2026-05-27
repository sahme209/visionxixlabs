/**
 * Phase 486 — drift detect-and-persist orchestrator.
 *
 * Accepts {declared, observed} payloads from the caller (operator
 * script or scheduled job), runs the Phase 485 detector, and upserts
 * findings into DriftFinding. Resources that previously had open
 * findings but now match declared state get auto-marked resolved.
 *
 * The detector is pure; this responder is the I/O boundary.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  detectDrift,
  type DeclaredResource,
  type ObservedResource,
  type DriftFinding,
} from "./driftDetector";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface DriftPersistExistingRow {
  id: string;
  resourceKind: string;
  resourceId: string;
  status: string;
}

export interface DriftPersistRepo {
  driftFinding: {
    findMany(args: { where: { organizationId: string } }): Promise<DriftPersistExistingRow[]>;
    upsert(args: {
      where: {
        organizationId_resourceKind_resourceId: {
          organizationId: string;
          resourceKind: string;
          resourceId: string;
        };
      };
      create: {
        organizationId: string;
        resourceKind: string;
        resourceId: string;
        displayName: string;
        applicationId: string | null;
        environmentTier: string | null;
        severity: string;
        status: "open";
        summary: string;
        declaredJson: Record<string, unknown>;
        observedJson: Record<string, unknown>;
      };
      update: {
        displayName: string;
        applicationId: string | null;
        environmentTier: string | null;
        severity: string;
        status: "open";
        summary: string;
        declaredJson: Record<string, unknown>;
        observedJson: Record<string, unknown>;
        lastSeenAt: Date;
      };
    }): Promise<{ id: string }>;
    update(args: {
      where: { id: string };
      data: { status: "resolved"; lastSeenAt: Date };
    }): Promise<{ id: string }>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildDriftPersistInput {
  organizationId: string;
  declared: ReadonlyArray<DeclaredResource>;
  observed: ReadonlyArray<ObservedResource>;
}

export type DriftPersistBody =
  | {
      ok: true;
      data: {
        scannedDeclared: number;
        scannedObserved: number;
        upserted: number;
        autoResolved: number;
        missingFromRuntime: number;
        unmanagedDiscovered: number;
        bySeverity: Record<string, number>;
        completedAtIso: string;
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: DriftPersistBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildDriftPersistResponse(
  repo: DriftPersistRepo,
  input: BuildDriftPersistInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const result = detectDrift({ declared: input.declared, observed: input.observed });

    // Index existing open findings so we can auto-resolve ones the
    // detector no longer reports.
    const existing = await repo.driftFinding.findMany({ where: { organizationId: input.organizationId } });
    const reportedKeys = new Set<string>(result.findings.map((f) => keyOf(f.resourceKind, f.resourceId)));

    let upserted = 0;
    for (const f of result.findings) {
      await repo.driftFinding.upsert({
        where: {
          organizationId_resourceKind_resourceId: {
            organizationId: input.organizationId,
            resourceKind: f.resourceKind,
            resourceId: f.resourceId,
          },
        },
        create: {
          organizationId: input.organizationId,
          resourceKind: f.resourceKind,
          resourceId: f.resourceId,
          displayName: f.displayName,
          applicationId: f.applicationId ?? null,
          environmentTier: f.environmentTier ?? null,
          severity: f.severity,
          status: "open",
          summary: f.summary,
          declaredJson: f.declaredJson,
          observedJson: f.observedJson,
        },
        update: {
          displayName: f.displayName,
          applicationId: f.applicationId ?? null,
          environmentTier: f.environmentTier ?? null,
          severity: f.severity,
          status: "open",
          summary: f.summary,
          declaredJson: f.declaredJson,
          observedJson: f.observedJson,
          lastSeenAt: now,
        },
      });
      upserted += 1;
    }

    // Auto-resolve open rows that the detector no longer reports.
    let autoResolved = 0;
    for (const ex of existing) {
      if (ex.status === "resolved") continue;
      if (reportedKeys.has(keyOf(ex.resourceKind, ex.resourceId))) continue;
      await repo.driftFinding.update({ where: { id: ex.id }, data: { status: "resolved", lastSeenAt: now } });
      autoResolved += 1;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          scannedDeclared: input.declared.length,
          scannedObserved: input.observed.length,
          upserted,
          autoResolved,
          missingFromRuntime: result.missingFromRuntime.length,
          unmanagedDiscovered: result.unmanagedDiscovered.length,
          bySeverity: result.summary.bySeverity,
          completedAtIso: now.toISOString(),
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "DriftFinding migration not applied yet." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

function keyOf(kind: string, id: string): string {
  return `${kind}::${id}`;
}

// Re-export for the route convenience.
export type { DriftFinding };

/**
 * Phase 422 — pure response builder for /api/v1/connectors/setup-digest.
 *
 * Sits between the route handler (which only knows how to translate
 * auth + req into a single call) and the digest pipeline (Phase 420).
 * Owns the HTTP-shaped response: status code, error envelope, graceful
 * degradation when the schema hasn't been migrated yet.
 *
 * Extracted so the route file stays a thin auth-and-wire shim and the
 * non-trivial branching (migration-pending detection, error envelope)
 * is testable with stubs — no NextRequest, no Prisma, no module mocks.
 */

import { buildOrgSetupDigest } from "./connectorSetupDigest";
import type { SnapshotRepo } from "./connectorSetupSnapshot";

/* ──────────────────────────────────────────────────────────────────
   Response shape.
   ────────────────────────────────────────────────────────────── */

export type ResponseBody =
  | { ok: true; data: SerializedDigest }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface SerializedDigest {
  generatedAt: string; // ISO
  providers: ReturnType<typeof serializeProviders>;
  summary: Record<string, number>;
}

export interface ResponderResult {
  status: number;
  body: ResponseBody;
}

export interface ResponderOptions {
  correlationId?: string;
  /** Lookback hours forwarded to the sticky-error classifier. */
  stickyWindowHours?: number;
  /** Override "now" — tests only. */
  now?: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildSetupDigestResponse(
  repo: SnapshotRepo,
  organizationId: string,
  opts: ResponderOptions = {},
): Promise<ResponderResult> {
  try {
    const digest = await buildOrgSetupDigest(repo, organizationId, {
      now: opts.now,
      stickyWindowHours: opts.stickyWindowHours,
    });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: digest.generatedAt.toISOString(),
          providers: serializeProviders(digest.providers),
          summary: digest.summary as unknown as Record<string, number>,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: {
          ok: false,
          error: "migration_pending",
          hint: "The ConnectorSetupSession + Transition tables haven't been migrated yet. Run `npx prisma migrate dev` (locally) or `npx prisma migrate deploy` (production) to apply the latest schema.",
        },
      };
    }
    return {
      status: 500,
      body: {
        ok: false,
        error: "internal_error",
        ...(opts.correlationId ? { correlationId: opts.correlationId } : {}),
      },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — exported so tests can pin them directly.
   ────────────────────────────────────────────────────────────── */

/**
 * Detects the Postgres "relation does not exist" condition under any
 * shape Prisma might surface it: a `PrismaClientKnownRequestError` with
 * code P2021, an `Error.message` containing the Postgres code 42P01, or
 * the literal "relation … does not exist" phrasing.
 */
export function isMissingTable(err: unknown): boolean {
  if (!err) return false;
  // Duck-type the Prisma error: we can't `instanceof` it here without
  // pulling Prisma into the test surface.
  if (typeof err === "object" && err !== null) {
    const code = (err as { code?: unknown }).code;
    if (code === "P2021") return true;
  }
  if (err instanceof Error) {
    return /relation .+ does not exist|undefined_table|42P01/i.test(err.message);
  }
  return false;
}

export function serializeProviders(
  providers: Awaited<ReturnType<typeof buildOrgSetupDigest>>["providers"],
) {
  return providers.map((p) => ({
    provider: p.provider,
    status: p.status,
    statusLabel: p.statusLabel,
    sidebarDotColor: p.sidebarDotColor,
    actionable: p.actionable,
    daysConnected: p.daysConnected,
    minutesSinceTransition: p.minutesSinceTransition,
    suggested: p.suggested,
    errorClass: p.errorClass,
    timeline: p.timeline,
  }));
}

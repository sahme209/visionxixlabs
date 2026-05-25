/**
 * Phase 432 — pure response builder for the alert-digest endpoints
 * (both the public v1 route and the session-auth dashboard route).
 *
 * Sibling to lib/connectors/setupDigestResponder.ts. Owns status code +
 * error envelope + migration_pending degradation so both the public v1
 * route and the dashboard session-auth route share one tested core.
 */

import { buildOrgAlertDigest } from "./alertEscalationDigest";
import type { AlertSnapshotRepo } from "./alertEscalationSnapshot";
import { isMissingTable } from "@/lib/connectors/setupDigestResponder";

export type AlertResponseBody =
  | { ok: true; data: SerializedAlertDigest }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface SerializedAlertDigest {
  generatedAt: string;
  alerts: Awaited<ReturnType<typeof buildOrgAlertDigest>>["alerts"];
  summary: Awaited<ReturnType<typeof buildOrgAlertDigest>>["summary"];
}

export interface ResponderResult {
  status: number;
  body: AlertResponseBody;
}

export interface ResponderOptions {
  correlationId?: string;
  now?: Date;
}

export async function buildAlertDigestResponse(
  repo: AlertSnapshotRepo,
  organizationId: string,
  opts: ResponderOptions = {},
): Promise<ResponderResult> {
  try {
    const digest = await buildOrgAlertDigest(repo, organizationId, { now: opts.now });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: digest.generatedAt.toISOString(),
          alerts: digest.alerts,
          summary: digest.summary,
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
          hint: "The AlertEscalationSession + Transition tables haven't been migrated yet. Run `npx prisma migrate deploy`.",
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

/**
 * GET/POST /api/cron/alert-escalation-tick — Phase 434.
 *
 * Vercel cron entry-point. Walks every org with at least one
 * ConnectorSetupSession, runs the Phase 418 sticky-error classifier,
 * asks the Phase 426 bridge what alert event to emit per provider,
 * and applies via the Phase 427 alert repo.
 *
 * Without this route, the alerts table only gets entries from
 * explicit operator clicks. WITH it, sticky AccessDenied (etc.)
 * automatically becomes a fired alert escalation.
 *
 * Idempotent: a second tick with no new connector events is a noop.
 * Open alerts suppress re-fires; healthy connectors clear open alerts.
 *
 * Bearer CRON_SECRET guard; 503 when unset.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db";
import {
  tickConnectorSetupToAlertEscalation,
  type ConnectorListRepo,
} from "@/lib/alerts/connectorSetupToAlertCron";
import type { AlertEscalationRepo } from "@/lib/alerts/alertEscalationRepo";
import { isMissingTable } from "@/lib/connectors/setupDigestResponder";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest)  { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }

async function handle(req: NextRequest): Promise<NextResponse> {
  const env = loadAppEnv();
  if (!env.cronSecret) {
    return NextResponse.json(
      { ok: false, reason: "cron_not_configured", detail: "CRON_SECRET is not set." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ ok: false, reason: "cron_unauthorized" }, { status: 401 });
  }

  // Find orgs that have at least one connector setup session — those are
  // the ones the tick has anything to do for. If the table doesn't exist
  // yet, return an empty tick rather than 500.
  let orgIds: string[] = [];
  try {
    const groups = await prisma.connectorSetupSession.groupBy({
      by: ["organizationId"],
    });
    orgIds = groups.map((g) => g.organizationId);
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({
        ok: true, reason: "migration_pending", orgsInspected: 0, perOrg: [],
      });
    }
    throw err;
  }

  const perOrg: Array<{ organizationId: string; inspected: number; fired: number; cleared: number; noop: number; errored: number }> = [];
  let totalFired = 0, totalCleared = 0;

  for (const organizationId of orgIds) {
    const r = await tickConnectorSetupToAlertEscalation(
      prisma as unknown as ConnectorListRepo,
      prisma as unknown as AlertEscalationRepo,
      organizationId,
    );
    perOrg.push({
      organizationId,
      ...r.summary,
    });
    totalFired += r.summary.fired;
    totalCleared += r.summary.cleared;
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    orgsInspected: orgIds.length,
    totalFired,
    totalCleared,
    perOrg,
  });
}

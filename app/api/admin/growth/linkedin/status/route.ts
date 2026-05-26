/**
 * GET /api/admin/growth/linkedin/status
 *
 * Snapshot of LinkedIn integration state for the admin UI:
 *   - env configured? (which vars are missing)
 *   - posting enabled? (LINKEDIN_POSTING_ENABLED)
 *   - active connection row + expiry
 *   - last 20 publish runs (for the audit panel)
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { loadLinkedInConfig, isPostingEnabled } from "@/lib/growth/linkedin/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;

  const cfg = loadLinkedInConfig();
  const configured = cfg.kind === "configured";
  const missing = cfg.kind === "missing" ? cfg.missing : [];

  const connection = await prisma.linkedInAccountConnection.findFirst({
    where: { status: "connected" },
    orderBy: { updatedAt: "desc" },
  });

  const recentRuns = await prisma.linkedInPostPublishRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    ok: true,
    env: {
      configured,
      missing,
      postingEnabled: isPostingEnabled(),
      organizationConfigured: configured && Boolean(cfg.config.organizationId),
    },
    connection: connection
      ? {
          ownerEmail:    connection.ownerEmail,
          linkedinName:  connection.linkedinName,
          linkedinUrn:   connection.linkedinUrn,
          organizationUrn: connection.organizationUrn,
          scopes:        connection.scopes,
          expiresAt:     connection.expiresAt.toISOString(),
          status:        connection.status,
          lastUsedAt:    connection.lastUsedAt?.toISOString() ?? null,
          lastError:     connection.lastError,
        }
      : null,
    recentRuns: recentRuns.map((r) => ({
      id:              r.id,
      draftId:         r.draftId,
      triggeredBy:     r.triggeredBy,
      outcome:         r.outcome,
      httpStatus:      r.httpStatus,
      errorDetail:     r.errorDetail,
      linkedinPostUrn: r.linkedinPostUrn,
      startedAt:       r.startedAt.toISOString(),
      finishedAt:      r.finishedAt?.toISOString() ?? null,
    })),
  });
}

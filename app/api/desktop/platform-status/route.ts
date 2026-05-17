/**
 * GET /api/desktop/platform-status
 *
 * Returns the typed DesktopState — unified workspace + platform
 * packaging + safety contract + review inbox counts — for the
 * authenticated tenant.
 *
 * Inspect-only. Tenant-scoped. Honest by construction:
 *  - Every platform's buildStatus / signed / notarized / publiclyDownloadable
 *    fields reflect real env state, never fabricated.
 *  - localExecutionStatus is literal "disabled".
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildDesktopState } from "@/lib/desktop/desktopStateModel";
import { listActiveSessions } from "@/lib/desktop/desktopSession";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    // Roll up the auth'd user's active desktop sessions (if any).
    const sessions = await listActiveSessions(ctx.userId);
    const sessionStatus = sessions.length > 0 ? "active" : "not_paired";
    const newest = sessions.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))[0];

    const state = buildDesktopState({
      tenantId: ctx.organizationId,
      sessionStatus,
      platform: newest?.platform ?? "unknown",
      appVersion: newest?.desktopVersion,
      tokenExpiresAt: newest?.expiresAt,
      lastSeenAt: newest?.lastSeenAt,
      handoffInboxCount: 0, // real count populates when handoff store goes Prisma-backed
      reviewItemCount: 0,
    });
    return NextResponse.json(apiSuccess(state), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }

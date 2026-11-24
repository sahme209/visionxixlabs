/**
 * GET /api/dashboard/release-activity/[id] — Phase 488.
 * Chronological event timeline for one release, synthesized from
 * existing rows (no new event table).
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { browserReleaseScope } from "@/lib/releaseops/browserReleaseScope";
import { prisma } from "@/lib/db";
import {
  buildReleaseActivityResponse,
  type ReleaseActivityRepo,
} from "@/lib/releaseops/releaseActivityResponder";

export const dynamic = "force-dynamic";

function reply(body: unknown, status: number) {
  return NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store"}});
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = browserReleaseScope(await currentContext());
  if (!session) {
    return reply({ ok: false, error: "auth_required" }, 401);
  }
  const { id: releaseId } = await ctx.params;
  const r = await buildReleaseActivityResponse(
    prisma as unknown as ReleaseActivityRepo,
    { organizationId: session.organizationId, releaseId },
  );
  if (r.body.ok) {
    const current = browserReleaseScope(await currentContext());
    if (!current || current.userId !== session.userId || current.organizationId !== session.organizationId) {
      return reply({ ok: false, error: "workspace_context_changed" }, 403);
    }
  }
  return reply(r.body, r.status);
}

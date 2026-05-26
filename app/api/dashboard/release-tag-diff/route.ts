/**
 * GET /api/dashboard/release-tag-diff?repositoryId=...&toTag=...&fromTag=... — Phase 456.
 *
 * Session-auth route. Reads Phase 451 discovery rows + computes the
 * diff between two release tags. The dashboard UI consumes the same
 * shape on web + desktop.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildReleaseTagDiffResponse } from "@/lib/releaseops/releaseTagDiffResponder";
import type { ReleaseTagDiffRepo } from "@/lib/releaseops/releaseTagDiffResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const repositoryId = req.nextUrl.searchParams.get("repositoryId");
  const toTag = req.nextUrl.searchParams.get("toTag");
  const fromTag = req.nextUrl.searchParams.get("fromTag");
  if (!repositoryId || !toTag) {
    return NextResponse.json({ ok: false, error: "invalid_payload", hint: "repositoryId + toTag query params required." }, { status: 400 });
  }
  // Wrap the Prisma client with the findByIds shim — Prisma's IN
  // lookup is a one-liner; the responder's structural contract just
  // wants the call signature it expects.
  const repo: ReleaseTagDiffRepo = Object.assign(prisma as unknown as ReleaseTagDiffRepo, {
    pullRequestRecord: Object.assign(
      (prisma as unknown as ReleaseTagDiffRepo).pullRequestRecord,
      {
        async findByIds(ids: ReadonlyArray<string>) {
          if (ids.length === 0) return [];
          // @ts-expect-error — Prisma's findMany accepts { id: { in: [...] } }
          return prisma.pullRequestRecord.findMany({
            where: { id: { in: Array.from(ids) } },
            select: { id: true, title: true, webUrl: true },
          });
        },
      },
    ),
  });
  const r = await buildReleaseTagDiffResponse(
    repo,
    {
      organizationId: ctx.organizationId,
      repositoryId,
      toTag,
      ...(fromTag ? { fromTagOverride: fromTag } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}

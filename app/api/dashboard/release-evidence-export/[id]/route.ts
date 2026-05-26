/**
 * GET /api/dashboard/release-evidence-export/[id]?format=markdown|json
 *   — Phase 449.
 *
 * Streams the evidence-pack export for a single release. Reads the
 * release row, the latest readiness snapshot, and the evidence pack
 * via the Phase 442 repo, then formats via the Phase 449 exporters.
 *
 * Auth: session cookie (dashboard scope). The route refuses cross-org
 * reads by scoping the release lookup to ctx.organizationId.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  exportEvidence,
  type EvidenceExportFormat,
} from "@/lib/releaseops/evidenceExporters";
import {
  listRecentReadinessSnapshots,
  readEvidencePack,
  type ReleaseRepo,
} from "@/lib/releaseops/releaseRepo";
import { isMissingTable } from "@/lib/releaseops/releaseListResponder";

export const dynamic = "force-dynamic";

function parseFormat(s: string | null): EvidenceExportFormat {
  return s === "json" ? "json" : "markdown";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const { id } = await params;
  const format = parseFormat(req.nextUrl.searchParams.get("format"));
  const repo = prisma as unknown as ReleaseRepo;

  try {
    const release = await repo.release.findUnique({ where: { id } });
    if (!release || release.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: "release_not_found" }, { status: 404 });
    }
    const [snaps, pack] = await Promise.all([
      listRecentReadinessSnapshots(repo, { releaseId: id, take: 1 }),
      readEvidencePack(repo, { releaseId: id }),
    ]);
    const out = exportEvidence(
      { release, latestReadiness: snaps[0] ?? null, evidencePack: pack },
      format,
    );
    return new NextResponse(out.body, {
      status: 200,
      headers: {
        "Content-Type": out.contentType,
        "Content-Disposition": `attachment; filename="${out.filename}"`,
      },
    });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({
        ok: false, error: "migration_pending",
        hint: "Release / Readiness / EvidencePack tables aren't migrated yet.",
      }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/release-evidence-generate — Phase 475.
 *
 * Body: { releaseId: string, repositoryId?: string }
 *
 * Compiles every audit-relevant artifact for one release into a
 * ReleaseEvidencePack row. Returns the contentHash so the caller can
 * record provenance.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildEvidencePackResponse,
  type EvidencePackRepo,
} from "@/lib/releaseops/evidencePackResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { releaseId?: unknown; repositoryId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  const repositoryId = typeof body.repositoryId === "string" ? body.repositoryId : undefined;

  if (!releaseId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { releaseId, repositoryId? }." },
      { status: 400 },
    );
  }

  const r = await buildEvidencePackResponse(
    prisma as unknown as EvidencePackRepo,
    {
      organizationId: ctx.organizationId,
      releaseId,
      ...(repositoryId !== undefined ? { repositoryId } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}

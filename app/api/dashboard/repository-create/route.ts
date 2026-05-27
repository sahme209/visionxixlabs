/**
 * POST /api/dashboard/repository-create — Phase 494.
 * Body: { provider, remoteOwner, remoteName, remoteUrl?, defaultBranch?, repoFlavor? }
 * Idempotent on (organizationId, provider, remoteOwner, remoteName).
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildRepositoryCreateResponse,
  type RepositoryCreateRepo,
} from "@/lib/releaseops/repositoryCreateResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { provider?: unknown; remoteOwner?: unknown; remoteName?: unknown; remoteUrl?: unknown; defaultBranch?: unknown; repoFlavor?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const provider = typeof body.provider === "string" ? body.provider : null;
  const remoteOwner = typeof body.remoteOwner === "string" ? body.remoteOwner : null;
  const remoteName = typeof body.remoteName === "string" ? body.remoteName : null;
  if (!provider || !remoteOwner || !remoteName) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { provider, remoteOwner, remoteName, remoteUrl?, defaultBranch?, repoFlavor? }." },
      { status: 400 },
    );
  }

  const r = await buildRepositoryCreateResponse(
    prisma as unknown as RepositoryCreateRepo,
    {
      organizationId: ctx.organizationId,
      provider, remoteOwner, remoteName,
      ...(typeof body.remoteUrl === "string" ? { remoteUrl: body.remoteUrl } : {}),
      ...(typeof body.defaultBranch === "string" ? { defaultBranch: body.defaultBranch } : {}),
      ...(typeof body.repoFlavor === "string" ? { repoFlavor: body.repoFlavor } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}

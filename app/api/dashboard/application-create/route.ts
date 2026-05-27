/**
 * POST /api/dashboard/application-create — Phase 493.
 * Body: { slug, name, ownerTeamLabel?, businessTier?, description? }
 * Idempotent on (organizationId, slug).
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildApplicationCreateResponse,
  type ApplicationCreateRepo,
} from "@/lib/releaseops/applicationCreateResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { slug?: unknown; name?: unknown; ownerTeamLabel?: unknown; businessTier?: unknown; description?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const slug = typeof body.slug === "string" ? body.slug : null;
  const name = typeof body.name === "string" ? body.name : null;
  if (!slug || !name) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { slug, name, ownerTeamLabel?, businessTier?, description? }." },
      { status: 400 },
    );
  }

  const r = await buildApplicationCreateResponse(
    prisma as unknown as ApplicationCreateRepo,
    {
      organizationId: ctx.organizationId,
      slug,
      name,
      ...(typeof body.ownerTeamLabel === "string" ? { ownerTeamLabel: body.ownerTeamLabel } : {}),
      ...(typeof body.businessTier === "string" ? { businessTier: body.businessTier } : {}),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}

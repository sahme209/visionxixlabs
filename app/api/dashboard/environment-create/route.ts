/**
 * POST /api/dashboard/environment-create
 * Body: { slug, name, tier, displayOrder? }
 * Admin-only — environments are tenant-wide configuration.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  buildEnvironmentCreateResponse,
  type EnvironmentCreateRepo,
} from "@/lib/releaseops/environmentCreateResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }

  let body: { slug?: unknown; name?: unknown; tier?: unknown; displayOrder?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const slug = typeof body.slug === "string" ? body.slug : null;
  const name = typeof body.name === "string" ? body.name : null;
  const tier = typeof body.tier === "string" ? body.tier : null;
  if (!slug || !name || !tier) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { slug, name, tier, displayOrder? }." },
      { status: 400 },
    );
  }

  const r = await buildEnvironmentCreateResponse(
    prisma as unknown as EnvironmentCreateRepo,
    {
      organizationId: ctx.organizationId,
      slug, name, tier,
      ...(typeof body.displayOrder === "number" ? { displayOrder: body.displayOrder } : {}),
    },
  );

  if (r.body.ok && r.body.data.created) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "environment.create",
      subjectKind: "environment",
      subjectId: r.body.data.id,
      summary: `Created environment ${r.body.data.name} (${r.body.data.tier})`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

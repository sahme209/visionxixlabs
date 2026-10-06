/**
 * GET  /api/desktop/identity-providers
 * POST /api/desktop/identity-providers
 * Body (POST): { protocol, issuerOrEntityId, metadataDocument, managedDomains, roleMapping, requireMfaClaim }
 *
 * Config management only — see docs/ENTERPRISE_IDENTITY_DESIGN.md. No
 * sign-in path reads this table yet; a created provider starts and stays
 * "pending" until a real metadata exchange ships. Admin/owner-only —
 * this is tenant-wide security configuration.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import {
  buildIdentityProviderListResponse,
  buildIdentityProviderCreateResponse,
  type IdentityProviderRepo,
} from "@/lib/identity/identityProviderResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import type { RoleMappingRule } from "@/lib/identity/enterpriseIdentityContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/identity-providers",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }
  const r = await buildIdentityProviderListResponse(prisma as unknown as IdentityProviderRepo, String(session.organizationId));
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/identity-providers",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    protocol?: unknown; issuerOrEntityId?: unknown; metadataDocument?: unknown;
    managedDomains?: unknown; roleMapping?: unknown; requireMfaClaim?: unknown;
  } | null;
  const protocol = typeof body?.protocol === "string" ? body.protocol : null;
  const issuerOrEntityId = typeof body?.issuerOrEntityId === "string" ? body.issuerOrEntityId : null;
  const metadataDocument = typeof body?.metadataDocument === "string" ? body.metadataDocument : null;
  const managedDomains = Array.isArray(body?.managedDomains) ? body.managedDomains.filter((d): d is string => typeof d === "string") : null;
  const roleMapping = Array.isArray(body?.roleMapping) ? (body.roleMapping as RoleMappingRule[]) : null;
  const requireMfaClaim = typeof body?.requireMfaClaim === "boolean" ? body.requireMfaClaim : true;
  if (!protocol || !issuerOrEntityId || !metadataDocument || !managedDomains || !roleMapping) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const r = await buildIdentityProviderCreateResponse(prisma as unknown as IdentityProviderRepo, {
    organizationId: String(session.organizationId),
    actorUserId: String(session.userId),
    protocol, issuerOrEntityId, metadataDocument, managedDomains, roleMapping, requireMfaClaim,
  });

  if (r.body.ok) {
    try {
      await appendAuditEvent(prisma as unknown as AuditEventRepo, {
        organizationId: String(session.organizationId),
        kind: "identity.sso_configured",
        subjectKind: "identity_provider",
        subjectId: r.body.data.id,
        summary: `Configured ${protocol} identity provider (${issuerOrEntityId}) from desktop — pending, not yet active`,
        actorUserId: String(session.userId),
      });
    } catch { /* best-effort */ }
  }
  return NextResponse.json(r.body, { status: r.status });
}

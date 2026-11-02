import {withUnenrolledConfigurationMutation} from '@/lib/desktop/configurationMutationRefusal';
/**
 * GET  /api/desktop/environments
 * POST /api/desktop/environments
 * Body (POST): { slug, name, tier, displayOrder? }
 *
 * Desktop-session equivalent of /api/dashboard/environment-list and
 * environment-create — moved here because the hosted web dashboard
 * deliberately never renders live-operations pages in a browser (see
 * proxy.ts's isWebOperationsRoute redirect). List is open to any paired
 * session; create is admin/owner-only since environments are tenant-wide
 * configuration.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildEnvironmentListResponse, type EnvironmentListRepo } from "@/lib/releaseops/environmentListResponder";
import { buildEnvironmentCreateResponse, type EnvironmentCreateRepo } from "@/lib/releaseops/environmentCreateResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/environments",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }
  const r = await buildEnvironmentListResponse(prisma as unknown as EnvironmentListRepo, String(session.organizationId));
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/environments",
    allowApiKey: false,
    requiredCapability: "policy:manage",
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { slug?: unknown; name?: unknown; tier?: unknown; displayOrder?: unknown } | null;
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const name = typeof body?.name === "string" ? body.name : null;
  const tier = typeof body?.tier === "string" ? body.tier : null;
  if (!slug || !name || !tier) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  let r:Awaited<ReturnType<typeof buildEnvironmentCreateResponse>>;
  try{
    r=await withUnenrolledConfigurationMutation(prisma,{organizationId:String(session.organizationId),userId:String(session.userId),sessionId:String(session.id)},request.signal,async()=>{
      const current=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',allowApiKey:false,requiredCapability: "policy:manage",recordHeartbeat:false,route:'configuration mutation current authority'});
      if(!current||current.credentialKind!=='desktop_session'||current.id!==session.id||current.userId!==session.userId||current.organizationId!==session.organizationId)throw Error('configuration_identity_changed');
    },tx=>buildEnvironmentCreateResponse(tx as unknown as EnvironmentCreateRepo, {
    organizationId: String(session.organizationId),
    slug, name, tier,
    ...(typeof body?.displayOrder === "number" ? { displayOrder: body.displayOrder } : {}),
  }));
  }catch{return NextResponse.json({ok:false,error:'governance_configuration_mutation_unavailable'},{status:409})}

  if (r.body.ok && r.body.data.created) {
    try {
      await appendAuditEvent(prisma as unknown as AuditEventRepo, {
        organizationId: String(session.organizationId),
        kind: "environment.create",
        subjectKind: "environment",
        subjectId: r.body.data.id,
        summary: `Created environment ${r.body.data.name} (${r.body.data.tier}) from desktop`,
        actorUserId: String(session.userId),
      });
    } catch { /* best-effort */ }
  }
  return NextResponse.json(r.body, { status: r.status });
}

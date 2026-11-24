import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { readReleaseBatchDeclarations, type ReleaseBatchReadinessRepo } from "@/lib/integrations/airflow/releaseBatchReadiness";
import { savedReleaseLocatorSchema } from "@/lib/tauri/deploymentRequestSummary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authority = {
    requiredScope: "pipeline:read", requiredCapability: "workspace:read", requireWorkspaceMembership: true,
    route: "GET /api/desktop/deployments/:id/batch-declarations", allowApiKey: false,
  } as const;
  const denied = () => NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const session = await resolveRequestDesktopSession(request, authority);
  if (!session) return denied();
  const { id } = await context.params;
  const versions = request.nextUrl.searchParams.getAll("expectedVersion");
  const locator = savedReleaseLocatorSchema.safeParse({ id, version: Number(versions[0]) });
  if (versions.length !== 1 || !/^[1-9]\d{0,8}$/.test(versions[0]) || !locator.success) {
    return NextResponse.json({ ok: false, error: "invalid_release_version" }, { status: 400 });
  }
  try {
    const declarations = await readReleaseBatchDeclarations(prisma as unknown as ReleaseBatchReadinessRepo, {
      organizationId: String(session.organizationId), requestId: locator.data.id, expectedVersion: locator.data.version, signal: request.signal,
    });
    if (!declarations) return NextResponse.json({ ok: false, error: "batch_declarations_unavailable" }, { status: 409 });
    const current = await resolveRequestDesktopSession(request, authority);
    if (!current || current.userId !== session.userId || current.organizationId !== session.organizationId || request.signal.aborted) return denied();
    return NextResponse.json({ ok: true, data: declarations }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "batch_declarations_unavailable" }, { status: 502 });
  }
}

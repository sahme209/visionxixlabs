import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { listWorkflowFiles } from "@/lib/connectors/github/githubWriteClient";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lists files only. Each selected file still needs its own dispatch-schema read. */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "GET /api/desktop/github/workflows", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const repositoryFullName = request.nextUrl.searchParams.get("repositoryFullName")?.trim() ?? "";
  const ref = request.nextUrl.searchParams.get("branch")?.trim() ?? "";
  const repository = parseRepositoryFullName(repositoryFullName);
  if (!repository || !ref || ref.length > 240 || /[\0\r\n]/.test(ref)) return NextResponse.json({ ok: false, error: "invalid_workflow_source" }, { status: 400 });
  const token = await resolveTenantScopedToken(String(session.organizationId), repository);
  if (!token.ok) return NextResponse.json({ ok: false, error: token.error }, { status: 409 });
  const result = await listWorkflowFiles({ ...repository, ref, installationToken: token.token, signal: request.signal });
  if (!result.ok) return NextResponse.json({ ok: false, error: "workflow_catalogue_unavailable" }, { status: 502 });
  return NextResponse.json({ ok: true, data: { repositoryFullName, ref, files: result.data } }, { headers: { "Cache-Control": "no-store" } });
}

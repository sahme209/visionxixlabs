import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { getFile } from "@/lib/connectors/github/githubWriteClient";
import { parseWorkflowDispatchInputs } from "@/lib/connectors/github/workflowDispatchInputs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reads metadata only. No merge, dispatch, credential exposure or release authority. */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "GET /api/desktop/github/workflow-inputs", allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const repositoryFullName = request.nextUrl.searchParams.get("repositoryFullName")?.trim() ?? "";
  const ref = request.nextUrl.searchParams.get("branch")?.trim() ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const repository = parseRepositoryFullName(repositoryFullName);
  if (!repository || !ref || ref.length > 240 || /[\0\r\n]/.test(ref) || !/^\.github\/workflows\/[A-Za-z0-9_][A-Za-z0-9_. -]{0,150}\.ya?ml$/.test(path)) {
    return NextResponse.json({ ok: false, error: "invalid_workflow_source" }, { status: 400 });
  }
  const token = await resolveTenantScopedToken(String(session.organizationId), repository);
  if (!token.ok) return NextResponse.json({ ok: false, error: token.error }, { status: 409 });
  const result = await getFile({ owner: repository.owner, repo: repository.repo, branch: ref, path, installationToken: token.token, read: { signal: request.signal, maxBytes: 200_000 } });
  if (!result.ok || result.data.path !== path || !/^[a-f0-9]{40}$/.test(result.data.sha)) return unavailable();
  try {
    const inputs = parseWorkflowDispatchInputs(result.data.content);
    return NextResponse.json({ ok: true, data: { source: { repositoryFullName, ref, path, blobSha: result.data.sha }, inputs } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}
function unavailable() { return NextResponse.json({ ok: false, error: "workflow_input_schema_unavailable" }, { status: 502 }); }

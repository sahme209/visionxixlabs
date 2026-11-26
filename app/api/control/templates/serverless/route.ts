import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { serverlessDeployWorkflow, type ServerlessPlatform } from "@/lib/releaseops/serverlessDeployTemplates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET /api/control/templates/serverless?platform=&name=&region=[&resourceGroup=&healthPath=&canaryPercent=&observeMinutes=]
 * Downloads a generated serverless deploy workflow for the team's own repository. Members only.
 * Generating text changes nothing; the workflow runs only when V19 dispatches it after its gates pass.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.roles.length) return NextResponse.json({ ok: false, error: "workspace_membership_required" }, { status: 403, headers: noStore });
  const q = request.nextUrl.searchParams;
  const num = (k: string) => { const v = q.get(k); return v === null || v === "" ? undefined : Number(v); };
  const text = (k: string) => q.get(k) || undefined;
  const r = serverlessDeployWorkflow({ platform: (q.get("platform") ?? "") as ServerlessPlatform, name: q.get("name") ?? "", region: q.get("region") ?? "", resourceGroup: text("resourceGroup"), healthPath: text("healthPath"), canaryPercent: num("canaryPercent"), observeMinutes: num("observeMinutes") });
  if (!r.ok) return NextResponse.json({ ok: false, error: "template_input_invalid", detail: r.error }, { status: 400, headers: noStore });
  return new NextResponse(r.yaml, { status: 200, headers: { ...noStore, "Content-Type": "text/yaml; charset=utf-8", "Content-Disposition": `attachment; filename="${r.filename}"` } });
}

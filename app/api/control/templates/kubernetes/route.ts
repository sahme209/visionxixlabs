import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { kubernetesRolloutWorkflow, type RolloutStrategy } from "@/lib/releaseops/kubernetesRolloutTemplates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET /api/control/templates/kubernetes?strategy=&namespace=&deployment=&container=[&canaryReplicas=&observeMinutes=]
 * Downloads a generated rollout workflow to commit to the team's own repository. Members only.
 * Generating text changes nothing; the workflow runs only when V19 dispatches it after its gates pass.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.roles.length) return NextResponse.json({ ok: false, error: "workspace_membership_required" }, { status: 403, headers: noStore });
  const q = request.nextUrl.searchParams;
  const num = (k: string) => { const v = q.get(k); return v === null || v === "" ? undefined : Number(v); };
  const r = kubernetesRolloutWorkflow({ strategy: (q.get("strategy") ?? "") as RolloutStrategy, namespace: q.get("namespace") ?? "", deployment: q.get("deployment") ?? "", container: q.get("container") ?? "", canaryReplicas: num("canaryReplicas"), observeMinutes: num("observeMinutes") });
  if (!r.ok) return NextResponse.json({ ok: false, error: "template_input_invalid", detail: r.error }, { status: 400, headers: noStore });
  return new NextResponse(r.yaml, { status: 200, headers: { ...noStore, "Content-Type": "text/yaml; charset=utf-8", "Content-Disposition": `attachment; filename="${r.filename}"` } });
}

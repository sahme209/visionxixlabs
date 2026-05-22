/**
 * POST /api/workforce/pipelines/[id]/start
 *
 * Kicks off a PipelineRun for the registered pipeline definition.
 * Auth: workspace member. The runner synchronously advances through
 * dry-run stages until it hits an approval gate, a failure, or the
 * end. The response includes the run id so the client can redirect
 * to the run detail page.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { startPipelineRun } from "@/lib/workforce/pipelines/pipelineRunner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }
  let body: { metadata?: unknown } = {};
  try { body = await req.json() as typeof body; } catch { /* empty */ }

  const triggeredBy = session.userId ?? session.email ?? "unknown";
  const result = await startPipelineRun({
    organizationId: String(session.organizationId),
    pipelineId: id,
    triggeredBy,
    metadata: (body.metadata && typeof body.metadata === "object" ? body.metadata as Record<string, unknown> : {}),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    runId: result.runId,
    correlationId: result.correlationId,
  });
}

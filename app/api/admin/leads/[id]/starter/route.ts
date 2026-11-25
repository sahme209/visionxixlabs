import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { parseAdminGenerationHeaders } from "@/lib/async/adminGenerationIntent";
import { LeadEngineBusyError, LeadGenerationRevisionChangedError } from "@/lib/async/engineRunner";
import { prisma } from "@/lib/db";
import { leadFormSchema } from "@/lib/leads/leadSchema";
import { runDetailedStarter } from "@/lib/leads/runDetailedStarter";

/** Regenerate the detailed website starter package for a selected lead revision. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const intent = parseAdminGenerationHeaders(req.headers);
  if (!intent) {
    return NextResponse.json({ error: "A valid generation request and lead revision are required." }, { status: 400 });
  }
  const { id } = await params;
  const { requestId } = intent;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.source !== "website-request") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!leadFormSchema.safeParse(lead.fullPayload).success) {
      return NextResponse.json({ error: "This lead has no complete detailed website brief." }, { status: 422 });
    }

    const run = await runDetailedStarter(id, { ...intent, actorId: auth.user.uid });
    return NextResponse.json({ success: true, requestId, replayed: run.reused, aiStarterPackage: run.generated });
  } catch (e) {
    if (e instanceof LeadGenerationRevisionChangedError) {
      return NextResponse.json({ error: e.message, code: "lead_revision_changed", requestId }, { status: 409 });
    }
    if (e instanceof LeadEngineBusyError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: "AI generation failed. Check the request before retrying." }, { status: 500 });
  }
}

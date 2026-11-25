import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { LeadEngineBusyError, LeadGenerationRevisionChangedError, runAsyncLeadEngine } from "@/lib/async/engineRunner";
import { parseAdminGenerationHeaders } from "@/lib/async/adminGenerationIntent";
import { prisma } from "@/lib/db";
import { generateWebsiteStarter } from "@/lib/websiteStarter/engine";

/**
 * POST /api/leads/[id]/generate — Trigger AI package generation.
 * Updates lead status and fullPayload.aiPackage when done.
 * Admin action. Public lead generation uses the signed-token trigger flow.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Lead ID required" }, { status: 400 });

  const intent = parseAdminGenerationHeaders(req.headers);
  if (!intent) {
    return NextResponse.json({ error: "A valid generation request and lead revision are required." }, { status: 400 });
  }
  const { requestId, revision } = intent;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const run = await runAsyncLeadEngine({
      leadId: id,
      engineName: "website-builder",
      getTier: () => "free",
      adminIntent: { actorId: auth.user.uid, requestId, revision },
      isReady: (payload) => !!payload.aiPackage,
      getExistingResult: (payload) => (payload.aiPackage as Awaited<ReturnType<typeof generateWebsiteStarter>>) || null,
      generate: async ({ payload, invocation }) => {
        const form = (payload.form as Record<string, unknown>) || {};
        return generateWebsiteStarter(
          {
            variant: "simple",
            form: {
              name: form.name as string,
              email: form.email as string,
              company: form.company as string,
              message: form.message as string,
              industry: form.industry as string,
              hasDomain: form.hasDomain as boolean,
              domainName: form.domainName as string,
            },
          },
          "free",
          invocation
        );
      },
      persist: ({ result }) => ({ aiPackage: result }),
    });

    return NextResponse.json({ success: true, status: "package_ready", requestId, replayed: run.reused });
  } catch (e) {
    if (e instanceof LeadGenerationRevisionChangedError) {
      return NextResponse.json({ error: e.message, code: "lead_revision_changed", requestId }, { status: 409 });
    }
    if (e instanceof LeadEngineBusyError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[leads generate]", e);
    return NextResponse.json(
      { error: "Failed to generate package" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { LeadEngineBusyError } from "@/lib/async/engineRunner";
import { prisma } from "@/lib/db";
import { leadFormSchema } from "@/lib/leads/leadSchema";
import { runDetailedStarter, savedStarterPackage } from "@/lib/leads/runDetailedStarter";
import { verifyStarterToken } from "@/lib/leads/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";

/** Generate a detailed starter package for the legacy signed website-request flow. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = verifyStarterToken(req.nextUrl.searchParams.get("token") ?? "");
  if ("error" in result || result.leadId !== id) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }
  if (!checkRateLimit(`lead-detailed-starter:${id}`)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.source !== "website-request") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
    const existing = savedStarterPackage(payload);
    if (existing) {
      return NextResponse.json({ success: true, alreadyPresent: true, aiStarterPackage: existing });
    }
    if (!leadFormSchema.safeParse(payload).success) {
      return NextResponse.json({ error: "This lead has no complete detailed website brief." }, { status: 422 });
    }

    const run = await runDetailedStarter(id);
    return NextResponse.json({ success: true, alreadyPresent: run.reused, aiStarterPackage: run.generated });
  } catch (e) {
    if (e instanceof LeadEngineBusyError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: true, message: "AI generation failed. Our team will follow up." },
      { status: 500 }
    );
  }
}

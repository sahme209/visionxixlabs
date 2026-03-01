import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/leads/list — Admin: list leads.
 * ?source=website-request | contact | all (default: website-request)
 * For contact leads: includes agentStatus, actionsTaken, lastEmailSent, executionLogIds.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const source = req.nextUrl.searchParams.get("source") || "website-request";
  const where = source === "all" ? {} : { source };

  try {
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const leadIds = leads.map((l) => l.id);
    const jobs =
      source === "contact" || source === "all"
        ? await prisma.agentJob.findMany({
            where: { leadId: { in: leadIds }, type: "CONTACT_RESOLUTION" },
          })
        : [];

    const jobByLead = new Map(jobs.map((j) => [j.leadId, j]));

    return NextResponse.json({
      leads: leads.map((l) => {
        const payload = (l.fullPayload as Record<string, unknown>) || {};
        const job = jobByLead.get(l.id);
        const resolution = payload.agentResolution as { status?: string; actionsTaken?: string[] } | undefined;
        const emailsSent = (payload.agentEmailsSent as Array<{ subject: string; sentAt: string }>) || [];
        const lastEmail = emailsSent.length > 0 ? emailsSent[emailsSent.length - 1] : null;

        return {
          id: l.id,
          email: l.email,
          name: l.name,
          status: l.status,
          source: l.source,
          fullPayload: l.fullPayload,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
          ...(l.source === "contact" && {
            agentStatus: resolution?.status ?? job?.status ?? "pending",
            actionsTaken: resolution?.actionsTaken ?? [],
            lastEmailSent: lastEmail ? { subject: lastEmail.subject, sentAt: lastEmail.sentAt } : null,
            executionLogIds: (job?.result as { executionLogIds?: string[] })?.executionLogIds ?? [],
          }),
        };
      }),
    });
  } catch (e) {
    console.error("[leads list]", e);
    return NextResponse.json({ error: "Failed to list leads" }, { status: 500 });
  }
}

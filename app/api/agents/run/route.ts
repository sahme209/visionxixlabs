/**
 * POST /api/agents/run
 * Worker endpoint — processes pending AgentJobs (Contact Resolution).
 * Protected by CRON_SECRET (Authorization: Bearer CRON_SECRET) or admin session.
 * Cron: curl -X POST -H "Authorization: Bearer $CRON_SECRET" /api/agents/run
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runContactResolutionAgent } from "@/lib/agents/contactResolutionAgent";
import { logAudit } from "@/lib/security/auditLog";
import { requireAdmin } from "@/lib/admin/auth";

import "@/lib/plugins/aws";

const MAX_JOBS_PER_RUN = 10;
const MAX_ATTEMPTS = 3;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const authorized = isAuthorized(req);
  if (!authorized) {
    const auth = await requireAdmin(req);
    if ("error" in auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const jobs = await prisma.agentJob.findMany({
      where: {
        status: "pending",
        attempts: { lt: MAX_ATTEMPTS },
        runAt: { lte: now },
      },
      orderBy: { runAt: "asc" },
      take: MAX_JOBS_PER_RUN,
    });

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const job of jobs) {
      const claimed = await prisma.agentJob.updateMany({
        where: { id: job.id, status: "pending", attempts: job.attempts, runAt: { lte: now } },
        data: { status: "running", attempts: { increment: 1 }, lastError: null },
      });
      if (claimed.count !== 1) continue;

      try {
        if (job.type !== "CONTACT_RESOLUTION") {
          await prisma.agentJob.update({
            where: { id: job.id },
            data: { status: "failed", lastError: "Unknown job type" },
          });
          results.push({ id: job.id, status: "failed", error: "Unknown job type" });
          continue;
        }

        const lead = await prisma.lead.findUnique({ where: { id: job.leadId } });
        if (!lead) {
          await prisma.agentJob.update({
            where: { id: job.id },
            data: { status: "failed", lastError: "Lead not found" },
          });
          results.push({ id: job.id, status: "failed", error: "Lead not found" });
          continue;
        }
        if (lead.source !== "contact") {
          await prisma.agentJob.update({
            where: { id: job.id },
            data: { status: "failed", lastError: "Contact record unavailable" },
          });
          results.push({ id: job.id, status: "failed", error: "Contact record unavailable" });
          continue;
        }

        const payload = (lead.fullPayload as Record<string, unknown>) || {};
        const input = {
          leadId: lead.id,
          name: (payload.name as string) || lead.name || "—",
          email: lead.email,
          company: (payload.company as string) || undefined,
          topic: (payload.topic as string) || undefined,
          message: (payload.message as string) || "",
        };

        const output = await runContactResolutionAgent(input);

        await prisma.$transaction(async tx => {
          const current = await tx.lead.findUnique({ where: { id: lead.id }, select: { fullPayload: true, source: true } });
          if (current?.source !== "contact") throw new Error("Contact record unavailable");
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              fullPayload: {
                ...(current.fullPayload as Record<string, unknown>),
                agentStatus: output.status,
                agentResolution: {
                  status: output.status,
                  actionsTaken: output.actionsTaken,
                  updatedAt: new Date().toISOString(),
                },
              },
            },
          });
          await tx.agentJob.update({
            where: { id: job.id },
            data: { status: "completed", result: output as object, lastError: null },
          });
        }, { isolationLevel: "Serializable" });

        await logAudit({
          leadId: lead.id,
          action: "agent_completed",
          actor: "system",
          metadata: { jobId: job.id, status: output.status },
        });

        results.push({ id: job.id, status: "completed" });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await prisma.agentJob.update({
          where: { id: job.id },
          data: { status: "failed", lastError: errMsg },
        });
        await logAudit({
          leadId: job.leadId,
          action: "agent_failed",
          actor: "system",
          metadata: { jobId: job.id, error: errMsg },
        });
        results.push({ id: job.id, status: "failed", error: "Agent job failed" });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (e) {
    console.error("[agents run]", e);
    return NextResponse.json(
      { error: "Worker failed" },
      { status: 500 }
    );
  }
}

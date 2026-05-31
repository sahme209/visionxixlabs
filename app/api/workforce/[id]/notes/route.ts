/**
 * POST /api/workforce/[id]/notes
 *
 * Saves operator notes onto AgentEngineerRecord.notes. Workspace-
 * scoped, admin-visible only — never surfaces to engineer prompts or
 * audit detail bodies (we redact via sanitizeDetail). The field is
 * already declared in the schema; this route gives it a UI.
 *
 * Body:
 *   notes = "<= 4000 chars"  (required, can be empty string to clear)
 *
 * Audits via 'engineer.notes_updated' with the prior length + new
 * length in detail (not the content — operators may paste internal
 * incident context here).
 *
 * 303-redirect back to the engineer detail page.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_NOTES_LEN = 4000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireContext();
  const { id } = await params;

  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === id);
  if (!engineer || engineer.productLayer !== "client") {
    return NextResponse.json({ error: "engineer not found" }, { status: 404 });
  }

  const form = await req.formData();
  const raw = form.get("notes");
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "notes must be a string" }, { status: 400 });
  }
  const next = raw.slice(0, MAX_NOTES_LEN).trim();

  const org = String(ctx.organizationId);
  const prior = await prisma.agentEngineerRecord.findUnique({
    where: { organizationId_engineerId: { organizationId: org, engineerId: engineer.id } },
    select: { notes: true },
  }).catch(() => null);

  await prisma.agentEngineerRecord.upsert({
    where: { organizationId_engineerId: { organizationId: org, engineerId: engineer.id } },
    create: {
      organizationId: org,
      engineerId: engineer.id,
      defaultApprovalRule: engineer.approvalRule,
      currentApprovalRule: null,
      isEnabled: true,
      notes: next.length === 0 ? null : next,
    },
    update: {
      notes: next.length === 0 ? null : next,
    },
  });

  const correlationId = `engineer_notes_${Date.now().toString(36)}` as CorrelationId;
  // Detail intentionally omits content — notes may contain internal
  // incident context that doesn't belong in the audit trail body.
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.notes_updated",
    outcome: "success",
    entityRef: `engineer:${engineer.id}`,
    correlationId,
    detail: {
      engineerId: engineer.id,
      priorLen: prior?.notes?.length ?? 0,
      nextLen: next.length,
    },
  });

  return NextResponse.redirect(
    new URL(`/dashboard/workforce/${engineer.id}`, req.url),
    303,
  );
}

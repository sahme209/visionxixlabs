/**
 * POST /api/workforce/[id]/toggle
 *
 * Flips AgentEngineerRecord.isEnabled for a single engineer in the
 * caller's workspace. Form-encoded so the detail page can wire it
 * with a plain server-rendered <form> — no client JS needed.
 *
 * Body:
 *   enabled = "true" | "false"   (required)
 *
 * Audits via secureAudit('engineer.enable_toggled') with the prior
 * state in `detail`. Idempotent: setting enabled=true when already
 * enabled is a no-op write but still emits the audit row so the
 * trail tells the full story.
 *
 * 303 redirect back to the engineer detail page so the form action
 * stays compatible with the server-component model.
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

function parseEnabled(raw: FormDataEntryValue | null): boolean | null {
  if (raw === "true")  return true;
  if (raw === "false") return false;
  return null;
}

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
  const desired = parseEnabled(form.get("enabled"));
  if (desired === null) {
    return NextResponse.json({ error: "enabled must be 'true' or 'false'" }, { status: 400 });
  }

  const org = String(ctx.organizationId);
  const prior = await prisma.agentEngineerRecord.findUnique({
    where: { organizationId_engineerId: { organizationId: org, engineerId: engineer.id } },
    select: { isEnabled: true },
  }).catch(() => null);

  // Upsert so an engineer that hasn't been touched yet picks up
  // the registry default for its current rule.
  await prisma.agentEngineerRecord.upsert({
    where: { organizationId_engineerId: { organizationId: org, engineerId: engineer.id } },
    create: {
      organizationId: org,
      engineerId: engineer.id,
      defaultApprovalRule: engineer.approvalRule,
      currentApprovalRule: null,
      isEnabled: desired,
    },
    update: {
      isEnabled: desired,
    },
  });

  const correlationId = `engineer_toggle_${Date.now().toString(36)}` as CorrelationId;
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.enable_toggled",
    outcome: "success",
    entityRef: `engineer:${engineer.id}`,
    correlationId,
    detail: {
      engineerId: engineer.id,
      priorEnabled: prior?.isEnabled ?? null,
      nextEnabled: desired,
    },
  });

  // 303 forces the browser to GET the detail page after a POST.
  return NextResponse.redirect(
    new URL(`/dashboard/workforce/${engineer.id}`, req.url),
    303,
  );
}

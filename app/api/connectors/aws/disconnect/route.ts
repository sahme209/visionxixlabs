/**
 * POST /api/connectors/aws/disconnect
 *
 * Disconnects the user's AWS connector. Updates:
 *   1. Lead.fullPayload.connectors.aws.status → "disconnected"
 *   2. ConnectorSetupSession.status → "disconnected" (org-scoped)
 *   3. Disables any AxiomScheduledRun rows for this CloudAccount
 *
 * Does NOT modify the customer's AWS account — no role deletion,
 * no policy edit. The trust policy + role stay in place so the
 * operator can re-link without re-running CloudFormation. To remove
 * the role permanently the operator deletes the CloudFormation
 * stack on the AWS side; the platform-side state is what this
 * endpoint clears.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const ctx = await requireContext();
  const correlationId = `disconnect_aws_${Date.now().toString(36)}` as CorrelationId;

  // Resolve the user's most-recent cloud-operator Lead (same lookup
  // /api/scan/trigger uses).
  const user = await prisma.user.findUnique({
    where: { email: ctx.email!.toLowerCase() },
    select: { id: true },
  });
  const lead = await prisma.lead.findFirst({
    where: {
      source: "cloud-operator",
      OR: [
        ...(user?.id ? [{ userId: user.id }] : []),
        { email: ctx.email!.toLowerCase() },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, fullPayload: true },
  });

  // Mark the lead's connector record as disconnected. Skipped silently
  // if there's no lead — the next two steps still run so the dashboard
  // state lines up regardless.
  if (lead) {
    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const connectors = (payload.connectors as Record<string, unknown>) || {};
    const aws = connectors.aws as Record<string, unknown> | undefined;
    if (aws) {
      connectors.aws = {
        ...aws,
        status: "disconnected",
        disconnectedAt: new Date().toISOString(),
      };
      await prisma.lead.update({
        where: { id: lead.id },
        data: { fullPayload: { ...payload, connectors } as object },
      });
    }
  }

  // Flip the ConnectorSetupSession the dashboard reads from.
  try {
    await prisma.connectorSetupSession.updateMany({
      where: { organizationId: ctx.organizationId, provider: "aws" },
      data: {
        status: "disconnected",
        lastEventKind: "operator_disconnected",
        lastTransitionAt: new Date(),
      },
    });
  } catch (err) {
    console.warn("[connectors/aws/disconnect] session update failed:", err instanceof Error ? err.message : err);
  }

  // Stop the cron from re-scanning the now-disconnected account.
  try {
    await prisma.axiomScheduledRun.updateMany({
      where: { organizationId: ctx.organizationId, cloudAccount: { provider: "aws" } },
      data: { enabled: false, lastDiffSummary: "Disabled: operator disconnected." },
    });
  } catch (err) {
    console.warn("[connectors/aws/disconnect] scheduled-run disable failed:", err instanceof Error ? err.message : err);
  }

  await auditRecord({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "connector.disconnect",
    outcome: "success",
    entityRef: "aws",
    correlationId,
    detail: { provider: "aws", trigger: "operator" },
  });

  return NextResponse.json({ ok: true });
}

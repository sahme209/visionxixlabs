/**
 * Generic disconnect helper used by /api/connectors/{aws,azure,gcp}/disconnect.
 *
 * Three writes:
 *   1. Lead.fullPayload.connectors[provider].status → "disconnected" + timestamp
 *   2. ConnectorSetupSession.status → "disconnected" (org-scoped)
 *   3. Disable AxiomScheduledRun rows for this CloudAccount provider
 *
 * Audits 'connector.disconnected' on the way out.
 */

import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";

export async function disconnectConnector(
  ctx: { organizationId: OrganizationId; userId: UserId; email: string },
  provider: "aws" | "azure" | "gcp",
): Promise<{ ok: true }> {
  const correlationId = `disconnect_${provider}_${Date.now().toString(36)}` as CorrelationId;

  // Resolve the user's most-recent cloud-operator Lead.
  const user = await prisma.user.findUnique({
    where: { email: ctx.email.toLowerCase() },
    select: { id: true },
  });
  const lead = await prisma.lead.findFirst({
    where: {
      source: "cloud-operator",
      OR: [
        ...(user?.id ? [{ userId: user.id }] : []),
        { email: ctx.email.toLowerCase() },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, fullPayload: true },
  });

  if (lead) {
    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const connectors = (payload.connectors as Record<string, unknown>) || {};
    const current = connectors[provider] as Record<string, unknown> | undefined;
    if (current) {
      connectors[provider] = {
        ...current,
        status: "disconnected",
        disconnectedAt: new Date().toISOString(),
      };
      await prisma.lead.update({
        where: { id: lead.id },
        data: { fullPayload: { ...payload, connectors } as object },
      });
    }
  }

  try {
    await prisma.connectorSetupSession.updateMany({
      where: { organizationId: ctx.organizationId, provider },
      data: {
        status: "disconnected",
        lastEventKind: "operator_disconnected",
        lastTransitionAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(`[disconnect/${provider}] session update failed:`, err instanceof Error ? err.message : err);
  }

  try {
    await prisma.axiomScheduledRun.updateMany({
      where: { organizationId: ctx.organizationId, cloudAccount: { provider } },
      data: { enabled: false, lastDiffSummary: "Disabled: operator disconnected." },
    });
  } catch (err) {
    console.warn(`[disconnect/${provider}] scheduled-run disable failed:`, err instanceof Error ? err.message : err);
  }

  await auditRecord({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "connector.disconnect",
    outcome: "success",
    entityRef: provider,
    correlationId,
    detail: { provider, trigger: "operator" },
  });

  return { ok: true };
}

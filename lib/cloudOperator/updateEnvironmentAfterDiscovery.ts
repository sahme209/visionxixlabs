/**
 * Updates lead.fullPayload with environment summary and architecture graph
 * after aws:infra-discovery succeeds. Used by execution/run and axiomAssistantTools.
 */

import { prisma } from "@/lib/db";
import { generateEnvironmentSummary } from "@/lib/axiom/environmentSummaryGenerator";
import { buildArchitectureGraph } from "@/lib/cloud/architectureGraph";

export type DiscoveryResultData = {
  ec2Count?: number;
  s3Count?: number;
  rdsCount?: number;
  vpcCount?: number;
  region?: string;
};

/**
 * Update lead.fullPayload with environmentSummary and architectureGraph
 * after successful aws:infra-discovery. Non-throwing; logs on failure.
 */
export async function updateEnvironmentAfterDiscovery(
  leadId: string,
  resultData: DiscoveryResultData
): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { fullPayload: true, userId: true },
    });
    if (!lead) return;

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const connectorsRaw = (payload.connectors as Record<string, Record<string, unknown>>) || {};
    const connectors: Record<string, boolean> = {};
    let awsAccountId: string | undefined;
    for (const [k, v] of Object.entries(connectorsRaw)) {
      const status = (v?.status as string) || "pending";
      connectors[k] = status === "linked";
      if (k === "aws" && status === "linked" && v?.verifiedAccountId) {
        awsAccountId = String(v.verifiedAccountId);
      }
    }

    const execWhere = lead.userId
      ? { OR: [{ leadId }, { userId: lead.userId }] }
      : { leadId };
    const iamLogs = await prisma.executionLog.findMany({
      where: {
        ...execWhere,
        pluginId: "aws:iam-exposure-scan",
        status: "success",
      },
      orderBy: { executedAt: "desc" },
      take: 1,
      select: { result: true },
    });
    const iamResult = iamLogs[0]?.result as Record<string, unknown> | undefined;
    const iamFindings = (iamResult?.findings as Array<Record<string, unknown>>) ?? [];

    const d = resultData;
    const graph = buildArchitectureGraph({
      ec2Count: d.ec2Count ?? 0,
      s3Count: d.s3Count ?? 0,
      rdsCount: d.rdsCount ?? 0,
      vpcCount: d.vpcCount ?? 0,
      region: d.region,
    });

    const summary = await generateEnvironmentSummary({
      discovery: {
        ec2Count: d.ec2Count ?? 0,
        s3Count: d.s3Count ?? 0,
        rdsCount: d.rdsCount ?? 0,
        vpcCount: d.vpcCount ?? 0,
        region: d.region,
      },
      iamFindings: iamFindings.map((f) => ({
        type: f.type as string | undefined,
        severity: f.severity as string | undefined,
        principal: f.principal as string | undefined,
        detail: f.detail as string | undefined,
        summary: (f as { summary?: string }).summary,
      })),
      connectorStatus: {
        ...connectors,
        awsAccountId,
      },
      userId: lead.userId,
    });

    const updatedPayload = {
      ...payload,
      environmentSummary: summary,
      architectureGraph: graph,
    };
    await prisma.lead.update({
      where: { id: leadId },
      data: { fullPayload: updatedPayload as object },
    });
  } catch (err) {
    console.error("[updateEnvironmentAfterDiscovery]", err);
  }
}

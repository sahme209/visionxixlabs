/**
 * Updates lead.fullPayload with environment summary and architecture graph
 * after aws:infra-discovery succeeds. Used by execution/run and axiomAssistantTools.
 */

import { prisma } from "@/lib/db";
import { generateEnvironmentSummary, type EnvironmentSummaryInputs } from "@/lib/axiom/environmentSummaryGenerator";
import { buildArchitectureGraph } from "@/lib/cloud/architectureGraph";

export type DiscoveryResultData = {
  ec2Count?: number;
  s3Count?: number;
  rdsCount?: number;
  vpcCount?: number;
  region?: string;
};

function readIamFindings(result: unknown): Pick<EnvironmentSummaryInputs, "iamFindings" | "hasIamScan"> {
  const findings = result && typeof result === "object" && "findings" in result ? result.findings : null;
  if (!Array.isArray(findings)) return { iamFindings: [], hasIamScan: false };
  const iamFindings = findings.flatMap((finding: unknown) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) return [];
    const row = finding as Record<string, unknown>;
    return [{
      type: typeof row.type === "string" ? row.type : undefined,
      severity: typeof row.severity === "string" ? row.severity : undefined,
      principal: typeof row.principal === "string" ? row.principal : undefined,
      detail: typeof row.detail === "string" ? row.detail : undefined,
      summary: typeof row.summary === "string" ? row.summary : undefined,
    }];
  });
  return { iamFindings, hasIamScan: findings.length === iamFindings.length };
}

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
      select: { fullPayload: true, userId: true, source: true },
    });
    if (!lead || lead.source !== "cloud-operator") return;

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

    const iamLogs = await prisma.executionLog.findMany({
      where: {
        leadId,
        pluginId: "aws:iam-exposure-scan",
        status: "success",
      },
      orderBy: { executedAt: "desc" },
      take: 1,
      select: { result: true },
    });
    const d = resultData;
    const graph = buildArchitectureGraph({
      ec2Count: d.ec2Count ?? 0,
      s3Count: d.s3Count ?? 0,
      rdsCount: d.rdsCount ?? 0,
      vpcCount: d.vpcCount ?? 0,
      region: d.region,
    });

    const summary = await generateEnvironmentSummary({
      discovery: d,
      ...readIamFindings(iamLogs[0]?.result),
      connectorStatus: {
        ...connectors,
        awsAccountId,
      },
      userId: lead.userId,
    });

    const updatedPayload = {
      ...payload,
      environmentEvidenceLeadId: leadId,
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

/**
 * Update lead.fullPayload with architecture graph and environment summary
 * after aws:iam-exposure-scan succeeds. Uses latest infra-discovery and IAM scan
 * from ExecutionLog. Skips if no infra discovery exists yet.
 */
export async function updateEnvironmentAfterIamScan(opts: {
  leadId: string;
  userId?: string | null;
}): Promise<void> {
  const { leadId } = opts;
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { fullPayload: true, userId: true, source: true },
    });
    if (!lead || lead.source !== "cloud-operator") return;

    const [infraLogs, iamLogs] = await Promise.all([
      prisma.executionLog.findMany({
        where: {
          leadId,
          pluginId: "aws:infra-discovery",
          status: "success",
        },
        orderBy: { executedAt: "desc" },
        take: 1,
        select: { result: true },
      }),
      prisma.executionLog.findMany({
        where: {
          leadId,
          pluginId: "aws:iam-exposure-scan",
          status: "success",
        },
        orderBy: { executedAt: "desc" },
        take: 1,
        select: { result: true },
      }),
    ]);

    const infraResult = infraLogs[0]?.result as Record<string, unknown> | undefined;
    if (!infraResult) return;

    const d = infraResult;
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

    const graph = buildArchitectureGraph({
      ec2Count: (d.ec2Count as number) ?? 0,
      s3Count: (d.s3Count as number) ?? 0,
      rdsCount: (d.rdsCount as number) ?? 0,
      vpcCount: (d.vpcCount as number) ?? 0,
      region: d.region as string | undefined,
    });

    const summary = await generateEnvironmentSummary({
      discovery: {
        ec2Count: d.ec2Count as number | undefined,
        s3Count: d.s3Count as number | undefined,
        rdsCount: d.rdsCount as number | undefined,
        vpcCount: d.vpcCount as number | undefined,
        region: d.region as string | undefined,
      },
      ...readIamFindings(iamLogs[0]?.result),
      connectorStatus: {
        ...connectors,
        awsAccountId,
      },
      userId: lead.userId,
    });

    const updatedPayload = {
      ...payload,
      environmentEvidenceLeadId: leadId,
      environmentSummary: summary,
      architectureGraph: graph,
    };
    await prisma.lead.update({
      where: { id: leadId },
      data: { fullPayload: updatedPayload as object },
    });
  } catch (err) {
    console.error("[updateEnvironmentAfterIamScan]", err);
  }
}

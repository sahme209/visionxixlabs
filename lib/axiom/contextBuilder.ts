/**
 * Axiom environment context builder.
 * Collects connector status, AxiomScoreSnapshot, ExecutionLog, IAM findings,
 * and Lead infrastructure info for environment-aware assistant responses.
 */

import { prisma } from "@/lib/db";

export type AxiomEnvironmentContext = {
  connectors: {
    aws?: boolean;
    github?: boolean;
    azure?: boolean;
    gcp?: boolean;
  };
  cloudAccountId: string | null;
  recentFindings: string[];
  lastExecutions: Array<{
    pluginId: string;
    status: string;
    executedAt: Date;
    summary: string;
  }>;
  axiomScore: {
    infrastructureScore: number | null;
    estimatedAnnualSavings: number | null;
    riskExposureLevel: string | null;
    complexityTier: string | null;
    deploymentFrictionIndex: number | null;
  } | null;
  environmentSummary: string;
};

const EMPTY_CONTEXT: AxiomEnvironmentContext = {
  connectors: {},
  cloudAccountId: null,
  recentFindings: [],
  lastExecutions: [],
  axiomScore: null,
  environmentSummary: "No environment data available.",
};

/**
 * Build Axiom environment context for assistant prompts.
 * Collects connector status (AWS, GitHub, Azure, GCP), last AxiomScoreSnapshot,
 * last 5 ExecutionLog entries, IAM scan findings, and Lead fullPayload infra info.
 */
export async function buildAxiomEnvironmentContext(opts: {
  leadId: string;
  userId?: string | null;
}): Promise<AxiomEnvironmentContext> {
  const { leadId, userId } = opts;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { fullPayload: true, source: true, userId: true },
  });

  if (!lead || lead.source !== "cloud-operator") {
    return EMPTY_CONTEXT;
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const connectorsRaw = (payload.connectors as Record<string, Record<string, unknown>>) || {};
  const operatorProfile = (payload.operatorProfile as Record<string, unknown>) || {};

  const connectors: AxiomEnvironmentContext["connectors"] = {};
  let cloudAccountId: string | null = null;

  for (const [k, v] of Object.entries(connectorsRaw)) {
    const status = (v?.status as string) || "pending";
    const linked = status === "linked";
    if (k === "aws") connectors.aws = linked;
    else if (k === "github") connectors.github = linked;
    else if (k === "azure") connectors.azure = linked;
    else if (k === "gcp") connectors.gcp = linked;
    if (k === "aws" && linked && v?.verifiedAccountId) {
      cloudAccountId = String(v.verifiedAccountId);
    }
  }

  const execWhere = lead.userId
    ? { OR: [{ leadId }, { userId: lead.userId }] }
    : { leadId };

  const logs = await prisma.executionLog.findMany({
    where: execWhere,
    orderBy: { executedAt: "desc" },
    take: 5,
    select: {
      pluginId: true,
      status: true,
      executedAt: true,
      result: true,
      errorMessage: true,
    },
  });

  const lastExecutions = logs.map((log) => {
    const resultObj = (log.result as Record<string, unknown>) ?? {};
    let summary: string;
    if (typeof resultObj.summary === "string") {
      summary = resultObj.summary;
    } else if (resultObj.summary && typeof resultObj.summary === "object") {
      const s = resultObj.summary as Record<string, unknown>;
      summary = `Users: ${s.usersCount ?? 0}, Roles: ${s.rolesCount ?? 0}, Findings: ${s.findingsCount ?? 0}`;
    } else if (log.errorMessage) {
      summary = log.errorMessage;
    } else {
      summary = `${log.pluginId} — ${log.status}`;
    }
    return {
      pluginId: log.pluginId,
      status: log.status,
      executedAt: log.executedAt,
      summary,
    };
  });

  const recentFindings: string[] = [];
  const lastIamLog = logs.find((l) =>
    l.pluginId === "aws:iam-exposure-scan"
  );
  if (lastIamLog?.result && typeof lastIamLog.result === "object") {
    const r = lastIamLog.result as Record<string, unknown>;
    const findings = (r.findings as Array<Record<string, unknown>>) ?? [];
    for (const f of findings.slice(0, 10)) {
      const type = (f.type as string) ?? "Unknown";
      const detail = (f.detail as string) ?? "";
      const principal = (f.principal as string) ?? "";
      recentFindings.push(`[${type}] ${principal ? `${principal}: ` : ""}${detail}`);
    }
  }

  const lastSnapshot = await prisma.axiomScoreSnapshot.findFirst({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });

  const axiomScore = lastSnapshot
    ? {
        infrastructureScore: lastSnapshot.infrastructureScore,
        estimatedAnnualSavings: lastSnapshot.estimatedAnnualSavings,
        riskExposureLevel: lastSnapshot.riskExposureLevel,
        complexityTier: lastSnapshot.complexityTier,
        deploymentFrictionIndex: lastSnapshot.deploymentFrictionIndex,
      }
    : null;

  const parts: string[] = [];

  const proj = String(operatorProfile.projectType ?? "").trim();
  const host = String(operatorProfile.hostingProvider ?? "").trim();
  const spend = String(operatorProfile.monthlySpend ?? "").trim();
  const goal = String(operatorProfile.primaryGoal ?? "").trim();
  const gitProvider = String(operatorProfile.gitProvider ?? "None").trim();
  if (proj || host) parts.push(`Profile: ${proj || "—"} on ${host || "—"}`);
  if (spend) parts.push(`Monthly spend: ${spend}`);
  if (goal) parts.push(`Primary goal: ${goal}`);
  if (gitProvider && gitProvider !== "None") parts.push(`Git provider: ${gitProvider}`);

  if (axiomScore) {
    const score = axiomScore.infrastructureScore ?? "—";
    const savings =
      axiomScore.estimatedAnnualSavings != null ? `$${axiomScore.estimatedAnnualSavings}` : "—";
    const tier = axiomScore.complexityTier ?? "—";
    parts.push(`Axiom score: ${score}, Est. savings: ${savings}, Tier: ${tier}`);
  }

  const connectorList = Object.entries(connectors)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");
  parts.push(`Connectors: ${connectorList || "none"}`);

  if (cloudAccountId) parts.push(`AWS account: ${cloudAccountId}`);
  if (lastExecutions.length > 0) {
    parts.push(
      `Recent runs: ${lastExecutions.map((e) => `${e.pluginId} (${e.status})`).join("; ")}`
    );
  }
  if (recentFindings.length > 0) {
    parts.push(`IAM findings: ${recentFindings.length} items`);
  }

  const environmentSummary = parts.join(". ") || "No environment data available.";

  return {
    connectors,
    cloudAccountId,
    recentFindings,
    lastExecutions,
    axiomScore,
    environmentSummary,
  };
}

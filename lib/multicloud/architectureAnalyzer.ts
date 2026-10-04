/**
 * Architecture Analyzer — runs cloud scans, computes resilience score,
 * calls AI to generate multi-cloud recommendation. The "Magic Moment" engine.
 */

import { prisma } from "@/lib/db";
import { getConnector } from "@/lib/connectors/registry";
import type { CloudProvider } from "@/lib/connectors/interface";
import { computeResilienceScore, type ResilienceScoreInput, type ResilienceScoreResult } from "./resilienceScore";
import { generate } from "@/lib/ai/orchestrator";
import { logAudit } from "@/lib/security/auditLog";

// Ensure plugins are registered
import "@/lib/plugins/aws";
import "@/lib/plugins/azure/index";
import "@/lib/plugins/gcp/index";

export interface AnalyzeResult {
  reportId: string;
  resilienceScore: ResilienceScoreResult;
  currentStateSummary: {
    primaryProvider: string;
    providers: string[];
    regions: string[];
    resourceCounts: Record<string, number>;
    estimatedMonthlyCost: number | null;
  };
  risks: Array<{
    category: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
  }>;
  recommendedArchitecture: {
    pattern: string;
    secondaryProvider: string;
    components: string[];
    description: string;
  };
  estimatedCostImpact: {
    currentMonthlyCost: number | null;
    additionalMonthlyCost: number | null;
    percentIncrease: number | null;
  };
  rto: string;
  rpo: string;
  nextSteps: string[];
  aiAnalysis: string;
}

interface ScanData {
  provider: string;
  discovery: Record<string, unknown> | null;
  security: { findings: Array<{ severity: string; resource?: string; issue?: string }> } | null;
  cost: Record<string, unknown> | null;
}

async function getConnectedProviders(leadId: string): Promise<{ provider: CloudProvider; subscriptionId?: string }[]> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { fullPayload: true } });
  if (!lead) return [];

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const connectors = (payload.connectors as Record<string, Record<string, unknown>>) || {};

  const connected: { provider: CloudProvider; subscriptionId?: string }[] = [];
  for (const [key, value] of Object.entries(connectors)) {
    if (["aws", "azure", "gcp"].includes(key) && value?.status === "linked") {
      connected.push({
        provider: key as CloudProvider,
        subscriptionId: value.verifiedAccountId as string | undefined,
      });
    }
  }
  return connected;
}

async function runScansForProvider(
  provider: CloudProvider,
  leadId: string,
  userId: string
): Promise<ScanData> {
  const connector = getConnector(provider);
  const context = { userId, leadId, credentialsKey: leadId, dryRun: true };

  let discovery: Record<string, unknown> | null = null;
  let security: { findings: Array<{ severity: string; resource?: string; issue?: string }> } | null = null;
  let cost: Record<string, unknown> | null = null;

  try {
    const discoveryResult = await connector.discoverInfrastructure(context);
    if (discoveryResult.ok && discoveryResult.data) {
      discovery = discoveryResult.data;
    }
  } catch {
    // Continue with partial data
  }

  try {
    const securityResult = await connector.runSecurityScan(context);
    if (securityResult.ok && securityResult.data) {
      const findings = securityResult.data.findings as Array<{ severity: string; resource?: string; issue?: string }> | undefined;
      security = { findings: findings ?? [] };
    }
  } catch {
    // Continue with partial data
  }

  // Cost scan only available for AWS
  if (provider === "aws") {
    try {
      const { executePlugin } = await import("@/lib/execution/pluginEngine");
      const costResult = await executePlugin({
        pluginId: "aws:cost-explorer-summary",
        input: {},
        ctx: { userId, leadId, dryRun: true, credentialsKey: leadId },
        skipEntitlementCheck: true,
      });
      if (costResult.status === "success" && costResult.data) {
        cost = costResult.data;
      }
    } catch {
      // Cost is optional
    }
  }

  return { provider, discovery, security, cost };
}

function extractRegions(scans: ScanData[]): string[] {
  const regions = new Set<string>();
  for (const scan of scans) {
    if (scan.discovery) {
      const region = scan.discovery.region as string | undefined;
      if (region) regions.add(region);
      const services = scan.discovery.services as Array<{ region?: string }> | undefined;
      if (services) {
        for (const s of services) {
          if (s.region) regions.add(s.region);
        }
      }
    }
  }
  return Array.from(regions);
}

function extractResourceCounts(scans: ScanData[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const scan of scans) {
    if (!scan.discovery) continue;
    const prefix = scan.provider;
    for (const [key, value] of Object.entries(scan.discovery)) {
      if (typeof value === "number" && key.endsWith("Count")) {
        counts[`${prefix}:${key.replace("Count", "")}`] = value;
      }
    }
  }
  return counts;
}

function extractSecurityFindings(scans: ScanData[]): Array<{ severity: "critical" | "high" | "medium" | "low"; category: string; description: string }> {
  const findings: Array<{ severity: "critical" | "high" | "medium" | "low"; category: string; description: string }> = [];
  for (const scan of scans) {
    if (!scan.security?.findings) continue;
    for (const f of scan.security.findings) {
      findings.push({
        severity: f.severity as "critical" | "high" | "medium" | "low",
        category: `${scan.provider} security`,
        description: f.issue ?? `${f.resource ?? "resource"}: security finding`,
      });
    }
  }
  return findings;
}

function estimateMonthlyCost(scans: ScanData[]): number | null {
  for (const scan of scans) {
    if (scan.cost) {
      const total = scan.cost.totalCost as number | undefined;
      if (total != null) return total;
      const last30 = scan.cost.last30Days as number | undefined;
      if (last30 != null) return last30;
    }
  }
  return null;
}

function pickSecondaryProvider(primary: string): string {
  if (primary === "aws") return "azure";
  if (primary === "azure") return "gcp";
  return "aws";
}

function buildResilienceInput(
  providers: string[],
  regions: string[],
  securityFindings: Array<{ severity: "critical" | "high" | "medium" | "low" }>
): ResilienceScoreInput {
  return {
    providers,
    regions,
    hasBackups: false,
    hasCrossRegionReplication: regions.length > 1,
    hasCrossCloudReplication: providers.length > 1,
    securityFindings,
    hasMonitoring: false,
    hasAlerts: false,
    hasIncidentRunbooks: false,
    hasAutoScaling: false,
    hasDRPlan: false,
  };
}

const AI_SYSTEM_PROMPT = `You are a senior cloud architect specializing in multi-cloud resilience.

You analyze infrastructure scan data and produce practical multi-cloud recommendations.

Your output must be STRICT JSON with this schema:
{
  "currentStateSummary": "2-3 sentence description of the current infrastructure state",
  "singlePointsOfFailure": ["list of specific SPOFs found"],
  "topRisks": [
    { "category": "string", "severity": "critical|high|medium|low", "description": "specific risk description" }
  ],
  "recommendedArchitecture": {
    "pattern": "Active-Passive|Active-Active|Burst",
    "secondaryProvider": "azure|gcp|aws",
    "description": "2-3 sentence description of the recommended architecture",
    "components": ["list of specific components to deploy on secondary cloud"],
    "whyThisProvider": "1 sentence explaining why this secondary was chosen"
  },
  "estimatedAdditionalMonthlyCost": number or null,
  "percentCostIncrease": number or null,
  "rto": "estimated recovery time objective as string",
  "rpo": "estimated recovery point objective as string",
  "nextSteps": ["ordered list of 5-7 practical next steps"],
  "executiveSummary": "3-4 sentence summary for a non-technical executive"
}

RULES:
- Be specific. Reference actual resource counts and findings from the scan data.
- Recommend Active-Passive for most cases (lowest cost, simplest). Only recommend Active-Active for critical workloads.
- Cost estimates should be realistic percentages of current spend (Active-Passive typically adds 20-35%).
- RTO/RPO should be realistic for the recommended pattern.
- Next steps should be actionable engineering tasks, not vague advice.
- If data is limited, acknowledge it and make reasonable assumptions.`;

// Cloud discovery payloads carry the prospect's real tenant identifiers
// (Azure subscriptionId, GCP projectId, etc.) — these must never reach a
// model provider's prompt. Strip by key name (not by value pattern, since
// these are plain GUIDs/strings with no distinguishing shape to redact
// against) before any discovery object is interpolated into a prompt.
const TENANT_IDENTIFIER_KEYS = new Set([
  "subscriptionid", "projectid", "accountid", "tenantid", "organizationid",
]);

export function redactTenantIdentifiers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactTenantIdentifiers);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = TENANT_IDENTIFIER_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redactTenantIdentifiers(v);
    }
    return out;
  }
  return value;
}

async function generateAIRecommendation(
  scans: ScanData[],
  providers: string[],
  regions: string[],
  resourceCounts: Record<string, number>,
  securityFindings: Array<{ severity: string; category: string; description: string }>,
  monthlyCost: number | null,
  resilienceScore: ResilienceScoreResult,
  userId?: string | null
): Promise<{
  aiAnalysis: string;
  parsed: Record<string, unknown>;
}> {
  const userPrompt = `Analyze this infrastructure and generate a multi-cloud resilience recommendation.

SCAN DATA:
- Connected providers: ${providers.join(", ")}
- Regions: ${regions.join(", ") || "single region (could not determine)"}
- Resources: ${JSON.stringify(resourceCounts)}
- Estimated monthly cost: ${monthlyCost != null ? `$${monthlyCost}` : "unknown"}
- Security findings: ${securityFindings.length} total (${securityFindings.filter((f) => f.severity === "critical").length} critical, ${securityFindings.filter((f) => f.severity === "high").length} high)
- Top findings: ${securityFindings.slice(0, 5).map((f) => `[${f.severity}] ${f.description}`).join("; ") || "none"}

RESILIENCE SCORE: ${resilienceScore.total}/100 (Grade: ${resilienceScore.grade})
- Cloud Dependency: ${resilienceScore.categories.cloudDependency.score}/20
- Regional Redundancy: ${resilienceScore.categories.regionalRedundancy.score}/20
- Backup & Replication: ${resilienceScore.categories.backupAndReplication.score}/20
- Security Exposure: ${resilienceScore.categories.securityExposure.score}/20
- Monitoring & Recovery: ${resilienceScore.categories.monitoringAndRecovery.score}/20

RAW SCAN DETAILS:
${scans.map((s) => `--- ${s.provider.toUpperCase()} ---\nDiscovery: ${JSON.stringify(redactTenantIdentifiers(s.discovery) ?? "no data")}\nSecurity: ${s.security ? `${s.security.findings.length} findings` : "no data"}\nCost: ${JSON.stringify(s.cost ?? "no data")}`).join("\n\n")}

Generate a practical recommendation as JSON.`;

  try {
    const res = await generate({
      taskType: "PLAN_STRONG",
      systemPrompt: AI_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2048,
      temperature: 0.3,
      responseFormat: "json",
      userId: userId ?? undefined,
    });

    const raw = res.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { aiAnalysis: raw, parsed };
  } catch {
    return {
      aiAnalysis: "{}",
      parsed: buildFallbackRecommendation(providers, resourceCounts, monthlyCost),
    };
  }
}

function buildFallbackRecommendation(
  providers: string[],
  _resourceCounts: Record<string, number>,
  monthlyCost: number | null
): Record<string, unknown> {
  const primary = providers[0] ?? "aws";
  const secondary = pickSecondaryProvider(primary);
  const additionalCost = monthlyCost != null ? Math.round(monthlyCost * 0.25) : null;

  return {
    currentStateSummary: `Infrastructure runs entirely on ${primary}. No multi-cloud redundancy detected.`,
    singlePointsOfFailure: [`Single cloud provider (${primary})`, "Single region deployment", "No cross-cloud failover"],
    topRisks: [
      { category: "Vendor lock-in", severity: "high", description: `100% dependency on ${primary}` },
      { category: "Availability", severity: "high", description: "No failover if primary provider has an outage" },
    ],
    recommendedArchitecture: {
      pattern: "Active-Passive",
      secondaryProvider: secondary,
      description: `Deploy standby infrastructure on ${secondary} with database replication and DNS failover.`,
      components: ["Compute (standby)", "Database replica", "Storage sync", "DNS failover", "VPN tunnel"],
      whyThisProvider: `${secondary} offers the best compatibility and cost profile as a secondary to ${primary}.`,
    },
    estimatedAdditionalMonthlyCost: additionalCost,
    percentCostIncrease: 25,
    rto: "5 minutes",
    rpo: "5 minutes",
    nextSteps: [
      `Connect ${secondary} account`,
      "Run infrastructure discovery on secondary",
      "Review recommended architecture",
      "Deploy standby compute and database",
      "Configure DNS failover",
      "Test failover procedure",
    ],
    executiveSummary: `Your infrastructure is 100% dependent on ${primary}. We recommend an Active-Passive setup with ${secondary} as standby, adding approximately ${additionalCost != null ? `$${additionalCost}/month` : "25%"} to your cloud spend for full failover capability.`,
  };
}

export async function analyzeArchitecture(leadId: string, userId?: string | null): Promise<AnalyzeResult> {
  const connectedProviders = await getConnectedProviders(leadId);

  if (connectedProviders.length === 0) {
    throw new Error("No cloud providers connected. Connect at least one cloud account to analyze.");
  }

  const scans: ScanData[] = [];
  for (const cp of connectedProviders) {
    const effectiveUserId = userId ?? "system";
    const scan = await runScansForProvider(cp.provider, leadId, effectiveUserId);
    scans.push(scan);
  }

  const providers = connectedProviders.map((p) => p.provider);
  const regions = extractRegions(scans);
  const resourceCounts = extractResourceCounts(scans);
  const securityFindings = extractSecurityFindings(scans);
  const monthlyCost = estimateMonthlyCost(scans);

  const resilienceInput = buildResilienceInput(providers, regions, securityFindings);
  const resilienceScore = computeResilienceScore(resilienceInput);

  const { aiAnalysis, parsed } = await generateAIRecommendation(
    scans, providers, regions, resourceCounts, securityFindings, monthlyCost, resilienceScore, userId
  );

  const primary = providers[0] ?? "unknown";
  const aiRecs = parsed.recommendedArchitecture as Record<string, unknown> | undefined;
  const aiRisks = parsed.topRisks as Array<Record<string, unknown>> | undefined;
  const aiNextSteps = parsed.nextSteps as string[] | undefined;
  const aiAdditionalCost = parsed.estimatedAdditionalMonthlyCost as number | null | undefined;
  const aiPercentIncrease = parsed.percentCostIncrease as number | null | undefined;

  const risks = [
    ...securityFindings.slice(0, 10),
    ...(aiRisks ?? []).map((r) => ({
      category: String(r.category ?? "general"),
      severity: (r.severity ?? "medium") as "critical" | "high" | "medium" | "low",
      description: String(r.description ?? ""),
    })),
  ];

  const uniqueRisks = risks.filter(
    (r, i, arr) => arr.findIndex((x) => x.description === r.description) === i
  );

  const result: AnalyzeResult = {
    reportId: "",
    resilienceScore,
    currentStateSummary: {
      primaryProvider: primary,
      providers,
      regions,
      resourceCounts,
      estimatedMonthlyCost: monthlyCost,
    },
    risks: uniqueRisks,
    recommendedArchitecture: {
      pattern: String(aiRecs?.pattern ?? "Active-Passive"),
      secondaryProvider: String(aiRecs?.secondaryProvider ?? pickSecondaryProvider(primary)),
      components: (aiRecs?.components as string[]) ?? ["Compute (standby)", "Database replica", "Storage sync", "DNS failover"],
      description: String(aiRecs?.description ?? `Deploy standby on ${pickSecondaryProvider(primary)} with failover.`),
    },
    estimatedCostImpact: {
      currentMonthlyCost: monthlyCost,
      additionalMonthlyCost: aiAdditionalCost ?? (monthlyCost != null ? Math.round(monthlyCost * 0.25) : null),
      percentIncrease: aiPercentIncrease ?? 25,
    },
    rto: String(parsed.rto ?? "5 minutes"),
    rpo: String(parsed.rpo ?? "5 minutes"),
    nextSteps: aiNextSteps ?? [
      `Connect ${pickSecondaryProvider(primary)} account`,
      "Deploy standby infrastructure",
      "Configure database replication",
      "Set up DNS failover",
      "Test failover procedure",
    ],
    aiAnalysis: String(parsed.executiveSummary ?? resilienceScore.summary),
  };

  const report = await prisma.multiCloudReadinessReport.create({
    data: {
      leadId,
      userId: userId ?? null,
      score: resilienceScore.total,
      providerSummary: result.currentStateSummary as object,
      risks: uniqueRisks as object[],
      recommendations: result.recommendedArchitecture as object,
      estimatedCostImpact: result.estimatedCostImpact as object,
      rto: result.rto,
      rpo: result.rpo,
      rawScanData: scans.map((s) => ({ provider: s.provider, discovery: s.discovery, securityFindingsCount: s.security?.findings.length ?? 0 })) as object[],
      aiAnalysis: aiAnalysis,
    },
  });

  result.reportId = report.id;

  await logAudit({
    leadId,
    action: "multicloud_analysis_completed",
    actor: userId ? "user" : "system",
    metadata: { reportId: report.id, score: resilienceScore.total, grade: resilienceScore.grade },
  });

  return result;
}

import { prisma } from "@/lib/db";
import { getConnector } from "@/lib/connectors/registry";
import type { CloudProvider } from "../cloudSnapshot";
import type { SavingsEstimate } from "../enums";
import { CLOUD_PROVIDER_LABELS } from "../enums";
import { runAgent } from "./runAgent";
import type { AgentRunResult, AgentMessage } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingInput = {
  organizationId: string;
  userId: string;
  connectedAccountId: string;
  provider: "aws" | "azure" | "gcp";
  onMessage?: (msg: AgentMessage) => void;
};

export type OnboardingSummary = {
  status: "success" | "empty" | "error";
  provider: CloudProvider;
  accountLabel: string;

  connectionValid: boolean;
  regionsAvailable: number;

  totalResources: number;
  computeCount: number;
  storageCount: number;
  regionCount: number;

  topFindings: OnboardingFinding[];
  totalFindingCount: number;

  estimatedSavings: SavingsEstimate;

  highestRisk: { title: string; severity: string; description: string } | null;
  safestAction: { title: string; description: string; disposition: string } | null;

  runId: string | null;
  headline: string;
  summary: string;
  nextSteps: OnboardingNextStep[];

  durationMs: number;
};

export type OnboardingFinding = {
  title: string;
  category: string;
  severity: string;
  estimatedSavings: { monthly: number; yearly: number } | null;
  description: string;
};

export type OnboardingNextStep = {
  id: string;
  label: string;
  description: string;
  action: "view_plan" | "generate_terraform" | "schedule_scan" | "apply_safe" | "explore_chat";
  primary: boolean;
};

// ---------------------------------------------------------------------------
// runFirstExperience — the 60-second onboarding flow
// ---------------------------------------------------------------------------

export async function runFirstExperience(input: OnboardingInput): Promise<OnboardingSummary> {
  const { organizationId, userId, connectedAccountId, provider, onMessage } = input;
  const emit = onMessage ?? (() => {});
  const start = Date.now();
  const providerLabel = CLOUD_PROVIDER_LABELS[provider] ?? provider;

  // ── Step 1: Validate the cloud connection ──────────────────────────────

  const account = await prisma.cloudAccount.findUnique({
    where: { id: connectedAccountId },
  });

  if (!account) {
    return errorSummary(provider, providerLabel, start, "Cloud account not found. Check Settings → Cloud Accounts.");
  }

  emit({
    type: "scan_started",
    title: "Validating your connection",
    body: `Checking credentials and permissions for your ${providerLabel} account…`,
  });

  const connector = getConnector(provider);
  const validation = await connector.validateConnection(
    { accountId: account.externalAccountId, credentialRef: account.credentialRef },
    { userId },
  );

  if (!validation.valid) {
    emit({
      type: "error",
      title: "Connection failed",
      body: validation.error ?? `Could not connect to ${providerLabel}. Check your credentials and try again.`,
    });
    return errorSummary(provider, providerLabel, start, validation.error ?? "Connection validation failed.");
  }

  emit({
    type: "scan_started",
    title: "Connection verified",
    body: `Your ${providerLabel} account is connected. Starting first scan…`,
  });

  // ── Step 2: Run the agent with onboarding trigger ──────────────────────

  let agentResult: AgentRunResult;
  try {
    agentResult = await runAgent({
      organizationId,
      userId,
      connectedAccountId,
      provider,
      trigger: "onboarding",
      onMessage,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return errorSummary(provider, providerLabel, start, errMsg);
  }

  if (agentResult.status === "failed") {
    return errorSummary(provider, providerLabel, start, agentResult.error ?? "Agent run failed.");
  }

  // ── Step 3: Load rich data from DB for the summary ─────────────────────

  const run = await prisma.axiomAgentRun.findUnique({
    where: { id: agentResult.runId },
    include: {
      findings: { orderBy: { severity: "desc" }, take: 10 },
      recommendations: { orderBy: { monthlyHigh: "desc" }, take: 10 },
    },
  });

  const snapshot = run?.snapshotData as { resources?: unknown[]; regions?: string[] } | null;
  const resources = (snapshot?.resources ?? []) as Array<{ resourceType: string }>;
  const regions = snapshot?.regions ?? [];

  const computeCount = resources.filter((r) => r.resourceType === "compute").length;
  const storageCount = resources.filter((r) => r.resourceType === "storage").length;

  // ── Step 4: Handle empty state ─────────────────────────────────────────

  if (resources.length === 0) {
    return emptySummary(provider, providerLabel, account.externalAccountId, agentResult.runId, start);
  }

  if (agentResult.findingCount === 0) {
    return cleanSummary(
      provider,
      providerLabel,
      account.externalAccountId,
      agentResult.runId,
      resources.length,
      computeCount,
      storageCount,
      regions.length,
      start,
    );
  }

  // ── Step 5: Build rich onboarding summary ──────────────────────────────

  const findings = run?.findings ?? [];
  const recommendations = run?.recommendations ?? [];

  const topFindings: OnboardingFinding[] = findings.slice(0, 3).map((f) => ({
    title: f.title,
    category: f.category,
    severity: f.severity,
    estimatedSavings:
      f.monthlyHigh > 0 || f.yearlyHigh > 0
        ? { monthly: (f.monthlyLow + f.monthlyHigh) / 2, yearly: (f.yearlyLow + f.yearlyHigh) / 2 }
        : null,
    description: f.description,
  }));

  const highSeverityFinding = findings.find(
    (f) => f.severity === "critical" || f.severity === "high",
  );
  const highestRisk = highSeverityFinding
    ? { title: highSeverityFinding.title, severity: highSeverityFinding.severity, description: highSeverityFinding.description }
    : null;

  const safeRec = recommendations.find((r) => r.disposition === "auto_fix_candidate");
  const safestAction = safeRec
    ? { title: safeRec.title, description: safeRec.rationale, disposition: safeRec.disposition }
    : null;

  const headline = buildHeadline(providerLabel, resources.length, findings.length, agentResult.savingsIdentified);
  const summary = buildSummaryText(providerLabel, resources.length, computeCount, storageCount, regions.length, findings.length, agentResult, topFindings, highestRisk, safestAction);

  const nextSteps = buildNextSteps(agentResult, safestAction !== null);

  emit({
    type: "findings_summary",
    title: headline,
    body: summary,
    data: {
      totalResources: resources.length,
      findingCount: findings.length,
      estimatedSavings: agentResult.savingsIdentified,
    },
  });

  return {
    status: "success",
    provider,
    accountLabel: account.externalAccountId,
    connectionValid: true,
    regionsAvailable: regions.length,
    totalResources: resources.length,
    computeCount,
    storageCount,
    regionCount: regions.length,
    topFindings,
    totalFindingCount: agentResult.findingCount,
    estimatedSavings: agentResult.savingsIdentified,
    highestRisk,
    safestAction,
    runId: agentResult.runId,
    headline,
    summary,
    nextSteps,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Headline + summary text builders
// ---------------------------------------------------------------------------

function buildHeadline(
  providerLabel: string,
  resourceCount: number,
  findingCount: number,
  savings: SavingsEstimate,
): string {
  if (savings.yearlyHigh > 0) {
    return `I scanned ${resourceCount} ${providerLabel} resources and found $${Math.round(savings.yearlyHigh).toLocaleString()}/yr in potential savings.`;
  }
  return `I scanned ${resourceCount} ${providerLabel} resources and found ${findingCount} thing${findingCount === 1 ? "" : "s"} worth looking at.`;
}

function buildSummaryText(
  providerLabel: string,
  resourceCount: number,
  computeCount: number,
  storageCount: number,
  regionCount: number,
  findingCount: number,
  result: AgentRunResult,
  topFindings: OnboardingFinding[],
  highestRisk: { title: string; severity: string } | null,
  safestAction: { title: string } | null,
): string {
  const parts: string[] = [];

  parts.push(
    `Your ${providerLabel} account has ${resourceCount} resources ` +
    `(${computeCount} compute, ${storageCount} storage) across ${regionCount} region${regionCount === 1 ? "" : "s"}.`,
  );

  if (findingCount > 0) {
    parts.push(`\n\nI identified ${findingCount} finding${findingCount === 1 ? "" : "s"}:`);
    for (const f of topFindings) {
      const savingsNote = f.estimatedSavings
        ? ` — ~$${Math.round(f.estimatedSavings.yearly)}/yr savings`
        : "";
      parts.push(`\n• ${f.title}${savingsNote}`);
    }
    if (findingCount > topFindings.length) {
      parts.push(`\n• …and ${findingCount - topFindings.length} more.`);
    }
  }

  if (result.savingsIdentified.yearlyHigh > 0) {
    const low = Math.round(result.savingsIdentified.yearlyLow);
    const high = Math.round(result.savingsIdentified.yearlyHigh);
    parts.push(`\n\nEstimated annual savings: $${low.toLocaleString()}–$${high.toLocaleString()}/yr.`);
  }

  if (highestRisk) {
    parts.push(`\n\nHighest risk: "${highestRisk.title}" (${highestRisk.severity} severity).`);
  }

  if (safestAction) {
    parts.push(`\nSafest quick win: "${safestAction.title}" — low-risk, reversible, no downtime.`);
  }

  return parts.join("");
}

// ---------------------------------------------------------------------------
// Next-step action builder
// ---------------------------------------------------------------------------

function buildNextSteps(result: AgentRunResult, hasSafeAction: boolean): OnboardingNextStep[] {
  const steps: OnboardingNextStep[] = [];

  steps.push({
    id: "view_plan",
    label: "View full action plan",
    description: `See all ${result.recommendationCount} recommendations with risk levels, savings estimates, and execution previews.`,
    action: "view_plan",
    primary: true,
  });

  if (result.savingsIdentified.yearlyHigh > 0) {
    steps.push({
      id: "generate_terraform",
      label: "Generate Terraform",
      description: "Export infrastructure-as-code for the recommended changes.",
      action: "generate_terraform",
      primary: false,
    });
  }

  if (hasSafeAction) {
    steps.push({
      id: "apply_safe",
      label: "Apply safe fixes",
      description: "Apply low-risk, reversible changes that don't require downtime.",
      action: "apply_safe",
      primary: false,
    });
  }

  steps.push({
    id: "schedule_scan",
    label: "Schedule weekly scans",
    description: "Automatically scan this account weekly and alert you to new risks or savings.",
    action: "schedule_scan",
    primary: false,
  });

  steps.push({
    id: "explore_chat",
    label: "Ask me anything",
    description: "Open the Axiom chat to ask questions about your findings, risks, or savings.",
    action: "explore_chat",
    primary: false,
  });

  return steps;
}

// ---------------------------------------------------------------------------
// Empty / clean / error state builders
// ---------------------------------------------------------------------------

function emptySummary(
  provider: CloudProvider,
  providerLabel: string,
  accountId: string,
  runId: string,
  start: number,
): OnboardingSummary {
  return {
    status: "empty",
    provider,
    accountLabel: accountId,
    connectionValid: true,
    regionsAvailable: 0,
    totalResources: 0,
    computeCount: 0,
    storageCount: 0,
    regionCount: 0,
    topFindings: [],
    totalFindingCount: 0,
    estimatedSavings: { monthlyLow: 0, monthlyHigh: 0, yearlyLow: 0, yearlyHigh: 0 },
    highestRisk: null,
    safestAction: null,
    runId,
    headline: `Your ${providerLabel} account is connected, but I didn't find any resources.`,
    summary:
      `I successfully connected to your ${providerLabel} account (${accountId}), ` +
      `but no compute or storage resources were detected. ` +
      `This could mean your resources are in a region I haven't scanned, or the account is newly created. ` +
      `Try scheduling a weekly scan — I'll detect new resources as they're provisioned.`,
    nextSteps: [
      {
        id: "schedule_scan",
        label: "Schedule weekly scans",
        description: "I'll automatically check for new resources and alert you when something appears.",
        action: "schedule_scan",
        primary: true,
      },
      {
        id: "explore_chat",
        label: "Ask me anything",
        description: "Open the Axiom chat if you have questions about connecting your infrastructure.",
        action: "explore_chat",
        primary: false,
      },
    ],
    durationMs: Date.now() - start,
  };
}

function cleanSummary(
  provider: CloudProvider,
  providerLabel: string,
  accountId: string,
  runId: string,
  totalResources: number,
  computeCount: number,
  storageCount: number,
  regionCount: number,
  start: number,
): OnboardingSummary {
  return {
    status: "success",
    provider,
    accountLabel: accountId,
    connectionValid: true,
    regionsAvailable: regionCount,
    totalResources,
    computeCount,
    storageCount,
    regionCount,
    topFindings: [],
    totalFindingCount: 0,
    estimatedSavings: { monthlyLow: 0, monthlyHigh: 0, yearlyLow: 0, yearlyHigh: 0 },
    highestRisk: null,
    safestAction: null,
    runId,
    headline: `Your ${providerLabel} infrastructure looks well-optimized.`,
    summary:
      `I scanned ${totalResources} resources ` +
      `(${computeCount} compute, ${storageCount} storage) across ${regionCount} region${regionCount === 1 ? "" : "s"} ` +
      `in your ${providerLabel} account (${accountId}). ` +
      `No significant cost, resilience, or security issues were detected. ` +
      `Schedule a weekly scan and I'll alert you if anything changes.`,
    nextSteps: [
      {
        id: "schedule_scan",
        label: "Schedule weekly scans",
        description: "I'll monitor your infrastructure and alert you to new risks or savings opportunities.",
        action: "schedule_scan",
        primary: true,
      },
      {
        id: "explore_chat",
        label: "Ask me anything",
        description: "Open the Axiom chat to explore your infrastructure or ask about best practices.",
        action: "explore_chat",
        primary: false,
      },
    ],
    durationMs: Date.now() - start,
  };
}

function errorSummary(
  provider: CloudProvider,
  providerLabel: string,
  start: number,
  error: string,
): OnboardingSummary {
  return {
    status: "error",
    provider,
    accountLabel: "",
    connectionValid: false,
    regionsAvailable: 0,
    totalResources: 0,
    computeCount: 0,
    storageCount: 0,
    regionCount: 0,
    topFindings: [],
    totalFindingCount: 0,
    estimatedSavings: { monthlyLow: 0, monthlyHigh: 0, yearlyLow: 0, yearlyHigh: 0 },
    highestRisk: null,
    safestAction: null,
    runId: null,
    headline: `Could not complete the ${providerLabel} scan.`,
    summary: error,
    nextSteps: [],
    durationMs: Date.now() - start,
  };
}

import type { CloudProvider } from "../cloudSnapshot";
import type { AgentRunResult, AgentFinding, AgentRecommendation } from "./types";
import type { SavingsEstimate } from "../enums";
import { CLOUD_PROVIDER_LABELS } from "../enums";

// ---------------------------------------------------------------------------
// Multi-cloud executive summary — aggregates runs across AWS, Azure, GCP
// ---------------------------------------------------------------------------

type ProviderBreakdown = {
  provider: CloudProvider;
  label: string;
  status: "completed" | "failed" | "not_connected";
  resourcesScanned: number;
  findingCount: number;
  savingsIdentified: SavingsEstimate;
  autoFixCount: number;
  approvalRequiredCount: number;
  reportOnlyCount: number;
  topAction: string | null;
};

type RankedAction = {
  rank: number;
  provider: CloudProvider;
  title: string;
  disposition: string;
  yearlySavings: number;
  riskLevel: string | null;
};

export type MultiCloudSummary = {
  generatedAt: string;
  providersConnected: CloudProvider[];
  providersNotConnected: CloudProvider[];
  totalResourcesScanned: number;
  totalFindings: number;
  totalRecommendations: number;
  totalSavings: SavingsEstimate;
  safeActionCount: number;
  approvalRequiredCount: number;
  reportOnlyCount: number;
  highestCostProvider: CloudProvider | null;
  highestRiskProvider: CloudProvider | null;
  topActions: RankedAction[];
  providerBreakdown: ProviderBreakdown[];
  executiveSummary: string;
  agentNarrative: string;
};

export type ProviderRunInput = {
  provider: CloudProvider;
  run: AgentRunResult | null;
  findings?: AgentFinding[];
  recommendations?: AgentRecommendation[];
  resourcesScanned?: number;
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

const ALL_PROVIDERS: CloudProvider[] = ["aws", "azure", "gcp"];

export function buildMultiCloudSummary(
  inputs: ProviderRunInput[],
): MultiCloudSummary {
  const now = new Date().toISOString();

  const inputMap = new Map<CloudProvider, ProviderRunInput>();
  for (const input of inputs) {
    inputMap.set(input.provider, input);
  }

  const connected: CloudProvider[] = [];
  const notConnected: CloudProvider[] = [];
  const breakdowns: ProviderBreakdown[] = [];

  for (const provider of ALL_PROVIDERS) {
    const input = inputMap.get(provider);
    if (!input || !input.run) {
      notConnected.push(provider);
      breakdowns.push(emptyBreakdown(provider));
      continue;
    }
    connected.push(provider);
    breakdowns.push(buildBreakdown(input));
  }

  const completedBreakdowns = breakdowns.filter((b) => b.status === "completed");

  const totalSavings = sumSavings(completedBreakdowns.map((b) => b.savingsIdentified));
  const totalResources = completedBreakdowns.reduce((s, b) => s + b.resourcesScanned, 0);
  const totalFindings = completedBreakdowns.reduce((s, b) => s + b.findingCount, 0);
  const totalRecs = inputs.reduce((s, i) => s + (i.run?.recommendationCount ?? 0), 0);
  const safeActions = completedBreakdowns.reduce((s, b) => s + b.autoFixCount, 0);
  const approvalRequired = completedBreakdowns.reduce((s, b) => s + b.approvalRequiredCount, 0);
  const reportOnly = completedBreakdowns.reduce((s, b) => s + b.reportOnlyCount, 0);

  const highestCost = pickHighest(completedBreakdowns, (b) => b.savingsIdentified.yearlyHigh);
  const highestRisk = pickHighestRisk(inputs);

  const topActions = buildTopActions(inputs).slice(0, 5);

  const executiveSummary = buildExecutiveSummary({
    connected, notConnected, totalResources, totalFindings,
    totalSavings, safeActions, approvalRequired, highestCost, highestRisk,
  });

  const agentNarrative = buildAgentNarrative({
    connected, notConnected, totalResources, totalFindings,
    totalSavings, safeActions, approvalRequired, reportOnly,
    highestCost, highestRisk, topActions, breakdowns: completedBreakdowns,
  });

  return {
    generatedAt: now,
    providersConnected: connected,
    providersNotConnected: notConnected,
    totalResourcesScanned: totalResources,
    totalFindings,
    totalRecommendations: totalRecs,
    totalSavings,
    safeActionCount: safeActions,
    approvalRequiredCount: approvalRequired,
    reportOnlyCount: reportOnly,
    highestCostProvider: highestCost,
    highestRiskProvider: highestRisk,
    topActions,
    providerBreakdown: breakdowns,
    executiveSummary,
    agentNarrative,
  };
}

// ---------------------------------------------------------------------------
// Per-provider breakdown
// ---------------------------------------------------------------------------

function buildBreakdown(input: ProviderRunInput): ProviderBreakdown {
  const { provider, run, recommendations } = input;
  const label = CLOUD_PROVIDER_LABELS[provider] ?? provider.toUpperCase();

  if (!run) return emptyBreakdown(provider);

  const topRec = recommendations
    ?.filter((r) => r.actionable)
    .sort((a, b) => (b.estimatedSavings?.yearly ?? 0) - (a.estimatedSavings?.yearly ?? 0))[0];

  return {
    provider,
    label,
    status: run.status === "completed" ? "completed" : "failed",
    resourcesScanned: input.resourcesScanned ?? 0,
    findingCount: run.findingCount,
    savingsIdentified: run.savingsIdentified,
    autoFixCount: run.autoFixCount,
    approvalRequiredCount: run.approvalRequiredCount,
    reportOnlyCount: run.reportOnlyCount,
    topAction: topRec?.title ?? run.nextAction,
  };
}

function emptyBreakdown(provider: CloudProvider): ProviderBreakdown {
  return {
    provider,
    label: CLOUD_PROVIDER_LABELS[provider] ?? provider.toUpperCase(),
    status: "not_connected",
    resourcesScanned: 0,
    findingCount: 0,
    savingsIdentified: { monthlyLow: 0, monthlyHigh: 0, yearlyLow: 0, yearlyHigh: 0 },
    autoFixCount: 0,
    approvalRequiredCount: 0,
    reportOnlyCount: 0,
    topAction: null,
  };
}

// ---------------------------------------------------------------------------
// Top actions — ranked by yearly savings across all providers
// ---------------------------------------------------------------------------

function buildTopActions(inputs: ProviderRunInput[]): RankedAction[] {
  const actions: RankedAction[] = [];

  for (const input of inputs) {
    if (!input.recommendations) continue;
    for (const rec of input.recommendations) {
      if (!rec.actionable) continue;
      actions.push({
        rank: 0,
        provider: input.provider,
        title: rec.title,
        disposition: rec.disposition,
        yearlySavings: rec.estimatedSavings?.yearly ?? 0,
        riskLevel: rec.riskLevel,
      });
    }
  }

  actions.sort((a, b) => b.yearlySavings - a.yearlySavings);
  actions.forEach((a, i) => { a.rank = i + 1; });

  return actions;
}

// ---------------------------------------------------------------------------
// Highest-risk provider — by count of high/critical findings
// ---------------------------------------------------------------------------

function pickHighestRisk(inputs: ProviderRunInput[]): CloudProvider | null {
  let best: CloudProvider | null = null;
  let bestCount = 0;

  for (const input of inputs) {
    if (!input.findings) continue;
    const highRisk = input.findings.filter(
      (f) => f.severity === "high" || f.severity === "critical",
    ).length;
    if (highRisk > bestCount) {
      bestCount = highRisk;
      best = input.provider;
    }
  }

  return best;
}

function pickHighest(
  breakdowns: ProviderBreakdown[],
  accessor: (b: ProviderBreakdown) => number,
): CloudProvider | null {
  let best: CloudProvider | null = null;
  let bestVal = 0;

  for (const b of breakdowns) {
    const val = accessor(b);
    if (val > bestVal) {
      bestVal = val;
      best = b.provider;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Savings aggregation
// ---------------------------------------------------------------------------

function sumSavings(estimates: SavingsEstimate[]): SavingsEstimate {
  return estimates.reduce(
    (acc, e) => ({
      monthlyLow: acc.monthlyLow + e.monthlyLow,
      monthlyHigh: acc.monthlyHigh + e.monthlyHigh,
      yearlyLow: acc.yearlyLow + e.yearlyLow,
      yearlyHigh: acc.yearlyHigh + e.yearlyHigh,
    }),
    { monthlyLow: 0, monthlyHigh: 0, yearlyLow: 0, yearlyHigh: 0 },
  );
}

// ---------------------------------------------------------------------------
// Executive summary — one-liner for dashboards and emails
// ---------------------------------------------------------------------------

function fmtDollars(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtRange(low: number, high: number): string {
  if (low === high || low === 0) return fmtDollars(high);
  return `${fmtDollars(low)}–${fmtDollars(high)}`;
}

function providerList(providers: CloudProvider[]): string {
  const labels = providers.map((p) => CLOUD_PROVIDER_LABELS[p] ?? p.toUpperCase());
  if (labels.length <= 2) return labels.join(" and ");
  return labels.slice(0, -1).join(", ") + ", and " + labels[labels.length - 1];
}

function buildExecutiveSummary(ctx: {
  connected: CloudProvider[];
  notConnected: CloudProvider[];
  totalResources: number;
  totalFindings: number;
  totalSavings: SavingsEstimate;
  safeActions: number;
  approvalRequired: number;
  highestCost: CloudProvider | null;
  highestRisk: CloudProvider | null;
}): string {
  if (ctx.connected.length === 0) {
    return "No cloud providers connected. Connect AWS, Azure, or GCP to start scanning.";
  }

  const parts: string[] = [];

  parts.push(
    `Scanned ${ctx.totalResources} resources across ${providerList(ctx.connected)}.`,
  );

  if (ctx.totalFindings === 0) {
    parts.push("No issues found — your infrastructure is well-optimized.");
    return parts.join(" ");
  }

  parts.push(
    `Found ${ctx.totalFindings} ${ctx.totalFindings === 1 ? "opportunity" : "opportunities"}` +
    (ctx.totalSavings.yearlyHigh > 0
      ? `, including ${fmtRange(ctx.totalSavings.yearlyLow, ctx.totalSavings.yearlyHigh)}/year in potential savings.`
      : "."),
  );

  if (ctx.highestCost && ctx.highestRisk && ctx.highestCost !== ctx.highestRisk) {
    const costLabel = CLOUD_PROVIDER_LABELS[ctx.highestCost];
    const riskLabel = CLOUD_PROVIDER_LABELS[ctx.highestRisk];
    parts.push(
      `${costLabel} has the highest cost opportunity, while ${riskLabel} has the highest resilience risk.`,
    );
  } else if (ctx.highestCost) {
    parts.push(`${CLOUD_PROVIDER_LABELS[ctx.highestCost]} has the biggest opportunity.`);
  }

  if (ctx.safeActions > 0) {
    parts.push(`${ctx.safeActions} safe ${ctx.safeActions === 1 ? "action is" : "actions are"} ready to apply.`);
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Agent narrative — detailed conversational summary for the dashboard
// ---------------------------------------------------------------------------

function buildAgentNarrative(ctx: {
  connected: CloudProvider[];
  notConnected: CloudProvider[];
  totalResources: number;
  totalFindings: number;
  totalSavings: SavingsEstimate;
  safeActions: number;
  approvalRequired: number;
  reportOnly: number;
  highestCost: CloudProvider | null;
  highestRisk: CloudProvider | null;
  topActions: RankedAction[];
  breakdowns: ProviderBreakdown[];
}): string {
  const lines: string[] = [];

  if (ctx.connected.length === 0) {
    return "I don't have any cloud accounts connected yet. Connect your AWS, Azure, or GCP account to get started.";
  }

  lines.push(
    `I scanned ${providerList(ctx.connected)} and analyzed ${ctx.totalResources} resources.`,
  );

  if (ctx.totalFindings === 0) {
    lines.push("Everything looks good — no significant issues or savings opportunities.");
    if (ctx.notConnected.length > 0) {
      lines.push(`Connect ${providerList(ctx.notConnected)} for full multi-cloud coverage.`);
    }
    return lines.join(" ");
  }

  if (ctx.totalSavings.yearlyHigh > 0) {
    lines.push(
      `I found ${ctx.totalFindings} opportunities, including ` +
      `${fmtRange(ctx.totalSavings.yearlyLow, ctx.totalSavings.yearlyHigh)}/year in savings.`,
    );
  } else {
    lines.push(`I found ${ctx.totalFindings} opportunities across your infrastructure.`);
  }

  if (ctx.highestCost && ctx.highestRisk && ctx.highestCost !== ctx.highestRisk) {
    lines.push(
      `${CLOUD_PROVIDER_LABELS[ctx.highestCost]} has the highest cost opportunity, ` +
      `while ${CLOUD_PROVIDER_LABELS[ctx.highestRisk]} has the highest resilience risk.`,
    );
  }

  lines.push("");

  // Provider breakdown
  for (const b of ctx.breakdowns) {
    const parts: string[] = [`**${b.label}**: ${b.findingCount} findings`];
    if (b.savingsIdentified.yearlyHigh > 0) {
      parts.push(`${fmtRange(b.savingsIdentified.yearlyLow, b.savingsIdentified.yearlyHigh)}/yr`);
    }
    if (b.topAction) {
      parts.push(`top action: ${b.topAction}`);
    }
    lines.push(`• ${parts.join(" · ")}`);
  }

  lines.push("");

  // Action breakdown
  const actionParts: string[] = [];
  if (ctx.safeActions > 0) {
    actionParts.push(`${ctx.safeActions} safe to apply now`);
  }
  if (ctx.approvalRequired > 0) {
    actionParts.push(`${ctx.approvalRequired} need your approval`);
  }
  if (ctx.reportOnly > 0) {
    actionParts.push(`${ctx.reportOnly} for review`);
  }
  if (actionParts.length > 0) {
    lines.push(`Actions: ${actionParts.join(", ")}.`);
  }

  // Top 5 actions
  if (ctx.topActions.length > 0) {
    lines.push("");
    lines.push("Top actions across all clouds:");
    for (const action of ctx.topActions) {
      const savings = action.yearlySavings > 0 ? ` — ${fmtDollars(action.yearlySavings)}/yr` : "";
      const badge = action.disposition === "auto_fix_candidate" ? " ✓ safe" : "";
      lines.push(`${action.rank}. [${CLOUD_PROVIDER_LABELS[action.provider]}] ${action.title}${savings}${badge}`);
    }
  }

  if (ctx.notConnected.length > 0) {
    lines.push("");
    lines.push(`Connect ${providerList(ctx.notConnected)} for full multi-cloud visibility.`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Response examples (for documentation / API reference)
// ---------------------------------------------------------------------------

export const RESPONSE_EXAMPLES = {
  fullThreeProvider: {
    description: "All three providers connected, findings on each",
    executiveSummary:
      "Scanned 142 resources across AWS, Azure, and Google Cloud. Found 18 opportunities, including $7,400–$11,200/year in potential savings. AWS has the highest cost opportunity, while Google Cloud has the highest resilience risk. 4 safe actions are ready to apply.",
    agentNarrative: [
      "I scanned AWS, Azure, and Google Cloud and analyzed 142 resources.",
      "I found 18 opportunities, including $7,400–$11,200/year in savings.",
      "AWS has the highest cost opportunity, while Google Cloud has the highest resilience risk.",
      "",
      "• **AWS**: 9 findings · $4,200–$6,800/yr · top action: Downsize 3x m5.2xlarge → m5.xlarge",
      "• **Azure**: 5 findings · $2,400–$3,200/yr · top action: Apply Blob lifecycle policies",
      "• **Google Cloud**: 4 findings · $800–$1,200/yr · top action: Enable backup on 12 unprotected resources",
      "",
      "Actions: 4 safe to apply now, 8 need your approval, 6 for review.",
    ].join("\n"),
  },

  singleProviderAws: {
    description: "Only AWS connected, Azure and GCP not connected",
    executiveSummary:
      "Scanned 64 resources across AWS. Found 7 opportunities, including $3,100–$4,800/year in potential savings. 2 safe actions are ready to apply.",
    agentNarrative: [
      "I scanned AWS and analyzed 64 resources.",
      "I found 7 opportunities, including $3,100–$4,800/year in savings.",
      "",
      "• **AWS**: 7 findings · $3,100–$4,800/yr · top action: Downsize 2x m5.xlarge → m5.large",
      "",
      "Actions: 2 safe to apply now, 3 need your approval, 2 for review.",
      "",
      "Connect Azure and Google Cloud for full multi-cloud visibility.",
    ].join("\n"),
  },

  noFindings: {
    description: "All providers connected, no issues found",
    executiveSummary:
      "Scanned 89 resources across AWS, Azure, and Google Cloud. No issues found — your infrastructure is well-optimized.",
  },

  noProviders: {
    description: "No cloud accounts connected",
    executiveSummary:
      "No cloud providers connected. Connect AWS, Azure, or GCP to start scanning.",
    agentNarrative:
      "I don't have any cloud accounts connected yet. Connect your AWS, Azure, or GCP account to get started.",
  },

  partialFailure: {
    description: "AWS completed, Azure failed, GCP not connected",
    executiveSummary:
      "Scanned 48 resources across AWS. Found 5 opportunities, including $2,200–$3,600/year in potential savings. 1 safe action is ready to apply.",
    agentNarrative: [
      "I scanned AWS and analyzed 48 resources.",
      "I found 5 opportunities, including $2,200–$3,600/year in savings.",
      "",
      "• **AWS**: 5 findings · $2,200–$3,600/yr · top action: Enable S3 Intelligent-Tiering on 6 buckets",
      "",
      "Actions: 1 safe to apply now, 2 need your approval, 2 for review.",
      "",
      "Connect Azure and Google Cloud for full multi-cloud visibility.",
    ].join("\n"),
  },
} as const;

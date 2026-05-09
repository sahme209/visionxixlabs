import { prisma } from "@/lib/db";
import type { ChatContext, ChatResponse, ChatAction, ChatHandler } from "./types";
import { CLOUD_PROVIDER_LABELS } from "../enums";
import type { CloudProvider } from "../cloudSnapshot";

// ---------------------------------------------------------------------------
// Handler registry — one handler per intent
// ---------------------------------------------------------------------------

export const HANDLERS: Record<string, ChatHandler> = {
  what_found: handleWhatFound,
  fix_priority: handleFixPriority,
  apply_safe: handleApplySafe,
  show_terraform: handleShowTerraform,
  show_cli: handleShowCLI,
  why_risky: handleWhyRisky,
  changes_since: handleChangesSince,
  savings_summary: handleSavingsSummary,
  start_scan: handleStartScan,
  approval_decision: handleApprovalDecision,
  explain_finding: handleExplainFinding,
  run_status: handleRunStatus,
  list_accounts: handleListAccounts,
  biggest_savings: handleBiggestSavings,
  automation_assessment: handleAutomationAssessment,
  provider_summary: handleProviderSummary,
  monitor_alerts: handleMonitorAlerts,
  unknown: handleUnknown,
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getLatestRun(ctx: ChatContext) {
  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  };
  if (ctx.activeRunId) where.id = ctx.activeRunId;

  return prisma.axiomAgentRun.findFirst({
    where,
    orderBy: { startedAt: "desc" },
    include: {
      cloudAccount: { select: { provider: true, externalAccountId: true } },
      findings: { orderBy: { severity: "desc" } },
      recommendations: { orderBy: { monthlyHigh: "desc" } },
      executionPlan: { include: { items: { orderBy: { sortOrder: "asc" } } } },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

function noScanResponse(): ChatResponse {
  return {
    message:
      "I don't have any scan data for your account yet. " +
      "Would you like me to run a scan now?",
    actions: [
      { type: "start_scan", label: "Start scan", payload: {} },
    ],
  };
}

function fmtSavings(low: number, high: number): string {
  if (low === 0 && high === 0) return "$0";
  if (low === high) return `$${low.toLocaleString()}`;
  return `$${low.toLocaleString()}–$${high.toLocaleString()}`;
}

function providerLabel(p: string): string {
  return CLOUD_PROVIDER_LABELS[p as CloudProvider] ?? p.toUpperCase();
}

// ---------------------------------------------------------------------------
// 1. what_found — "What did you find?"
// ---------------------------------------------------------------------------

async function handleWhatFound(
  ctx: ChatContext,
  params: Record<string, string>,
): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  if (run.status === "running" || run.status === "pending") {
    return {
      message: `Your ${providerLabel(run.cloudAccount?.provider ?? "aws")} scan is still running. I'll have results shortly.`,
    };
  }

  if (run.status === "failed") {
    return {
      message: `The last scan failed: ${run.errorMessage ?? "unknown error"}. Would you like me to try again?`,
      actions: [{ type: "start_scan", label: "Retry scan", payload: {} }],
    };
  }

  let findings = run.findings;
  const providerFilter = params.provider as CloudProvider | undefined;
  const categoryFilter = params.category;

  if (providerFilter) findings = findings.filter((f) => f.provider === providerFilter);
  if (categoryFilter) findings = findings.filter((f) => f.category === categoryFilter);

  if (findings.length === 0) {
    const scope = providerFilter ? ` for ${providerLabel(providerFilter)}` : "";
    const catScope = categoryFilter ? ` in ${categoryFilter}` : "";
    return {
      message: `No issues found${scope}${catScope}. Your infrastructure looks healthy in this area.`,
    };
  }

  const costCount = findings.filter((f) => f.category === "cost").length;
  const resilienceCount = findings.filter((f) => f.category === "resilience").length;
  const highSeverity = findings.filter((f) => f.severity === "high" || f.severity === "critical").length;

  const totalYearlyLow = findings.reduce((s, f) => s + (f.yearlyLow ?? 0), 0);
  const totalYearlyHigh = findings.reduce((s, f) => s + (f.yearlyHigh ?? 0), 0);

  const scope = providerFilter ? providerLabel(providerFilter) : providerLabel(run.cloudAccount?.provider ?? "aws");
  const parts: string[] = [];
  parts.push(`I found **${findings.length} issue${findings.length !== 1 ? "s" : ""}** across your ${scope} account.`);

  if (costCount > 0) parts.push(`**${costCount}** cost optimization${costCount !== 1 ? "s" : ""}`);
  if (resilienceCount > 0) parts.push(`**${resilienceCount}** resilience concern${resilienceCount !== 1 ? "s" : ""}`);
  if (highSeverity > 0) parts.push(`**${highSeverity}** high/critical severity`);
  if (totalYearlyHigh > 0) parts.push(`Estimated savings: **${fmtSavings(totalYearlyLow, totalYearlyHigh)}/year**`);

  const actions: ChatAction[] = [
    { type: "view_details", label: "See details", payload: { runId: run.id } },
  ];

  if (run.recommendations.some((r) => r.actionable)) {
    actions.push({ type: "apply_safe", label: "Apply safe fixes", payload: { runId: run.id } });
  }

  return {
    message: parts.join("\n\n"),
    actions,
    followUp: "Ask me \"What should I fix first?\" for a prioritized breakdown.",
  };
}

// ---------------------------------------------------------------------------
// 2. fix_priority — "What should I fix first?"
// ---------------------------------------------------------------------------

async function handleFixPriority(ctx: ChatContext): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  const recs = run.recommendations.filter((r) => r.actionable);
  if (recs.length === 0) {
    return {
      message: "No actionable recommendations right now. All findings are report-only or blocked.",
      followUp: "Ask \"How much can I save?\" for the full savings breakdown including report-only items.",
    };
  }

  const lines: string[] = ["Here's what I'd fix first, in priority order:\n"];

  for (let i = 0; i < Math.min(recs.length, 5); i++) {
    const r = recs[i];
    const savingsTag = r.yearlyHigh
      ? ` — saves ${fmtSavings(r.yearlyLow ?? 0, r.yearlyHigh ?? 0)}/yr`
      : "";
    const riskTag = r.riskLevel ? ` · ${r.riskLevel} risk` : "";
    const dispositionTag = r.disposition === "auto_fix_candidate" ? " ✦ safe to auto-apply" : "";

    lines.push(`**${i + 1}. ${r.title}**${savingsTag}${riskTag}${dispositionTag}`);
    lines.push(`   ${r.rationale}\n`);
  }

  if (recs.length > 5) {
    lines.push(`_…plus ${recs.length - 5} more recommendation${recs.length - 5 !== 1 ? "s" : ""}._`);
  }

  const autoFixCount = recs.filter((r) => r.disposition === "auto_fix_candidate").length;
  const actions: ChatAction[] = [];

  if (autoFixCount > 0) {
    actions.push({
      type: "apply_safe",
      label: `Apply ${autoFixCount} safe fix${autoFixCount !== 1 ? "es" : ""}`,
      payload: { runId: run.id },
    });
  }

  actions.push({
    type: "export_terraform",
    label: "Export Terraform",
    payload: { runId: run.id },
  });

  return { message: lines.join("\n"), actions };
}

// ---------------------------------------------------------------------------
// 3. apply_safe — "Can you apply the safe fixes?"
// ---------------------------------------------------------------------------

async function handleApplySafe(ctx: ChatContext): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  if (run.status !== "completed") {
    return { message: `Can't apply fixes — the run status is **${run.status}**. I need a completed scan first.` };
  }

  const plan = run.executionPlan;
  if (!plan) {
    return { message: "No execution plan was generated for this scan. The findings may all be report-only." };
  }

  const safeItems = plan.items.filter((i) => i.disposition === "auto_fix_candidate");
  if (safeItems.length === 0) {
    const approvalCount = plan.items.filter((i) => i.disposition === "approval_required").length;
    if (approvalCount > 0) {
      return {
        message:
          `No auto-fix candidates in this plan. However, **${approvalCount} action${approvalCount !== 1 ? "s" : ""}** can be applied with your approval.`,
        actions: [
          {
            type: "approve_all",
            label: `Approve ${approvalCount} action${approvalCount !== 1 ? "s" : ""}`,
            payload: { runId: run.id, itemIds: plan.items.filter((i) => i.disposition === "approval_required").map((i) => i.id) },
          },
        ],
      };
    }
    return { message: "No actions are safe to auto-apply. All items are report-only or require manual execution." };
  }

  const totalMonthly = safeItems.reduce((s, i) => s + (i.monthlyHigh ?? 0), 0);
  const itemSummary = safeItems
    .map((i) => `• ${i.currentState} → ${i.recommendedState}`)
    .join("\n");

  return {
    message:
      `I can safely apply **${safeItems.length} action${safeItems.length !== 1 ? "s" : ""}** right now:\n\n${itemSummary}\n\n` +
      `Estimated savings: ~$${totalMonthly.toLocaleString()}/month. ` +
      `All are low-risk, non-disruptive, and fully reversible.`,
    actions: [
      {
        type: "approve_all",
        label: "Apply now",
        payload: {
          runId: run.id,
          decision: "approve_all",
          itemIds: safeItems.map((i) => i.id),
        },
      },
    ],
    followUp: "Say \"show me the Terraform\" to review the infrastructure-as-code before applying.",
  };
}

// ---------------------------------------------------------------------------
// 4. show_terraform — "Show me the Terraform"
// ---------------------------------------------------------------------------

async function handleShowTerraform(ctx: ChatContext): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  const plan = run.executionPlan;
  if (!plan || plan.items.length === 0) {
    return { message: "No execution plan to generate Terraform from. Run a scan first." };
  }

  const { generateTerraform } = await import("../terraformGenerator");
  const { generateExecutionPlan } = await import("../executionPlan");

  const snapshotData = run.snapshotData as Record<string, unknown> | null;
  if (!snapshotData) {
    return { message: "Snapshot data is missing from this run. I can't generate Terraform without it. Try running a new scan." };
  }

  const execPlan = generateExecutionPlan(snapshotData as never);
  const tf = generateTerraform(execPlan);

  const warnings = tf.warnings.length > 0
    ? `\n\n**Warnings:**\n${tf.warnings.map((w) => `• ${w}`).join("\n")}`
    : "";

  return {
    message:
      `Here's the Terraform for **${tf.actionCount} action${tf.actionCount !== 1 ? "s" : ""}** (${tf.filename}):\n\n` +
      "```hcl\n" + tf.hcl + "\n```" +
      warnings,
    data: { filename: tf.filename, hcl: tf.hcl, warnings: tf.warnings },
    actions: [
      { type: "export_terraform", label: "Download .tf file", payload: { filename: tf.filename, hcl: tf.hcl } },
    ],
  };
}

// ---------------------------------------------------------------------------
// 5. show_cli — "Show me the CLI commands"
// ---------------------------------------------------------------------------

async function handleShowCLI(ctx: ChatContext): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  const plan = run.executionPlan;
  if (!plan || plan.items.length === 0) {
    return { message: "No execution plan to generate CLI commands from." };
  }

  const { generateCLICommands } = await import("../cliGenerator");
  const { generateExecutionPlan } = await import("../executionPlan");

  const snapshotData = run.snapshotData as Record<string, unknown> | null;
  if (!snapshotData) {
    return { message: "Snapshot data is missing from this run. Try running a new scan." };
  }

  const execPlan = generateExecutionPlan(snapshotData as never);
  const cli = generateCLICommands(execPlan);

  return {
    message:
      `Here are the CLI commands for **${cli.blockCount} action${cli.blockCount !== 1 ? "s" : ""}**:\n\n` +
      "```bash\n" + cli.script + "\n```",
    data: { script: cli.script, warnings: cli.warnings },
    actions: [
      { type: "export_cli", label: "Download script", payload: { script: cli.script } },
    ],
  };
}

// ---------------------------------------------------------------------------
// 6. why_risky — "Why is this risky?"
// ---------------------------------------------------------------------------

async function handleWhyRisky(
  ctx: ChatContext,
  params: Record<string, string>,
): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  const plan = run.executionPlan;
  if (!plan || plan.items.length === 0) {
    return { message: "No execution plan found — there are no actions to assess risk for." };
  }

  const targetRef = params.itemRef;
  const targetItem = targetRef
    ? plan.items.find((i) => i.id === targetRef || i.id.endsWith(targetRef))
    : plan.items.find((i) => i.riskLevel === "high" || i.riskLevel === "medium");

  if (!targetItem) {
    const allLow = plan.items.every((i) => i.riskLevel === "low");
    if (allLow) {
      return { message: "All actions in this plan are **low risk**. No downtime expected, and all are fully reversible." };
    }
    return { message: "I couldn't identify the specific item you're asking about. Can you specify which action?" };
  }

  const { simulateDryRun } = await import("../dryRunSimulator");
  const { generateExecutionPlan } = await import("../executionPlan");

  const snapshotData = run.snapshotData as Record<string, unknown> | null;
  if (!snapshotData) {
    return { message: "Snapshot data is missing — can't run risk simulation." };
  }

  const execPlan = generateExecutionPlan(snapshotData as never);
  const dryRun = simulateDryRun(execPlan);

  const itemRisks = dryRun.risks.filter((r) => r.itemId === targetItem.id);
  const itemDryRun = dryRun.itemBreakdown.find((b) => b.itemId === targetItem.id);

  const parts: string[] = [];
  parts.push(`**${targetItem.currentState} → ${targetItem.recommendedState}**`);
  parts.push(`Risk level: **${targetItem.riskLevel}**\n`);

  if (itemRisks.length > 0) {
    for (const risk of itemRisks) {
      parts.push(`**Risk:** ${risk.message}`);
      parts.push(`**Mitigation:** ${risk.mitigation}\n`);
    }
  } else {
    parts.push("No specific risks identified for this action.");
  }

  if (itemDryRun) {
    parts.push(`**Downtime:** ${itemDryRun.downtime}`);
    parts.push(`**Rollback:** ${itemDryRun.rollback}`);
  }

  const rec = run.recommendations.find((r) => r.id === targetItem.recommendationId);
  if (rec?.dispositionReason) {
    parts.push(`\n**Agent reasoning:** ${rec.dispositionReason}`);
  }

  return { message: parts.join("\n") };
}

// ---------------------------------------------------------------------------
// 7. changes_since — "What changed since last scan?"
// ---------------------------------------------------------------------------

async function handleChangesSince(
  ctx: ChatContext,
  params: Record<string, string>,
): Promise<ChatResponse> {
  const timeSince = params.timeSince ? new Date(params.timeSince) : undefined;
  const timeLabel = params.timeLabel ?? "last scan";

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    status: "completed",
  };

  if (timeSince) {
    where.startedAt = { gte: timeSince };
  }

  const runs = await prisma.axiomAgentRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: timeSince ? 10 : 2,
    include: {
      findings: true,
      recommendations: true,
    },
  });

  if (runs.length === 0) {
    if (timeSince) {
      return { message: `No completed scans found ${timeLabel}. Try a broader time range or run a new scan.` };
    }
    return noScanResponse();
  }

  if (runs.length < 2) {
    if (timeSince) {
      return {
        message: `Only one scan found ${timeLabel} — I need at least two to show changes. Run another scan to compare.`,
      };
    }
    return {
      message:
        "This is your first completed scan — I don't have a previous one to compare against. " +
        "Run another scan later to see what changed.",
    };
  }

  const current = runs[0];
  const previous = runs[runs.length - 1];
  const lines: string[] = [];

  const findingsDelta = current.findings.length - previous.findings.length;
  const recsDelta = current.recommendations.length - previous.recommendations.length;

  const currentSavingsHigh = current.findings.reduce((s, f) => s + (f.yearlyHigh ?? 0), 0);
  const prevSavingsHigh = previous.findings.reduce((s, f) => s + (f.yearlyHigh ?? 0), 0);
  const savingsDelta = currentSavingsHigh - prevSavingsHigh;

  const scopeLabel = timeSince
    ? `Changes **${timeLabel}** (${runs.length} scans, ${fmtDate(previous.startedAt ?? previous.createdAt)} → ${fmtDate(current.startedAt ?? current.createdAt)}):\n`
    : `Comparing scan from **${fmtDate(current.startedAt ?? current.createdAt)}** to **${fmtDate(previous.startedAt ?? previous.createdAt)}**:\n`;

  lines.push(scopeLabel);

  lines.push(`• Findings: ${current.findings.length} (${delta(findingsDelta)})`);
  lines.push(`• Recommendations: ${current.recommendations.length} (${delta(recsDelta)})`);
  lines.push(`• Estimated annual savings: ${fmtSavings(0, currentSavingsHigh)} (${delta(savingsDelta, "$")})`);

  const newFindings = current.findings.filter(
    (f) => !previous.findings.some((pf) => pf.title === f.title && pf.region === f.region),
  );
  const resolvedFindings = previous.findings.filter(
    (f) => !current.findings.some((cf) => cf.title === f.title && cf.region === f.region),
  );

  if (newFindings.length > 0) {
    lines.push(`\n**New findings:**`);
    for (const f of newFindings.slice(0, 5)) {
      lines.push(`• ${f.title} (${f.severity})`);
    }
    if (newFindings.length > 5) lines.push(`• _…and ${newFindings.length - 5} more_`);
  }

  if (resolvedFindings.length > 0) {
    lines.push(`\n**Resolved ${timeLabel}:**`);
    for (const f of resolvedFindings.slice(0, 5)) {
      lines.push(`• ${f.title}`);
    }
    if (resolvedFindings.length > 5) lines.push(`• _…and ${resolvedFindings.length - 5} more_`);
  }

  if (newFindings.length === 0 && resolvedFindings.length === 0) {
    lines.push("\nNo new or resolved findings — your infrastructure state is stable.");
  }

  return { message: lines.join("\n") };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function delta(n: number, prefix = ""): string {
  if (n === 0) return "no change";
  return n > 0 ? `+${prefix}${Math.abs(n).toLocaleString()}` : `-${prefix}${Math.abs(n).toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// 8. savings_summary — "How much can I save?"
// ---------------------------------------------------------------------------

async function handleSavingsSummary(ctx: ChatContext): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  const findings = run.findings;
  if (findings.length === 0) {
    return { message: "No savings opportunities found in the latest scan. Your infrastructure looks efficient." };
  }

  const byCategory = new Map<string, { count: number; yearlyLow: number; yearlyHigh: number }>();
  for (const f of findings) {
    const cat = f.category;
    const entry = byCategory.get(cat) ?? { count: 0, yearlyLow: 0, yearlyHigh: 0 };
    entry.count++;
    entry.yearlyLow += f.yearlyLow ?? 0;
    entry.yearlyHigh += f.yearlyHigh ?? 0;
    byCategory.set(cat, entry);
  }

  const totalLow = findings.reduce((s, f) => s + (f.yearlyLow ?? 0), 0);
  const totalHigh = findings.reduce((s, f) => s + (f.yearlyHigh ?? 0), 0);

  const lines: string[] = [];
  lines.push(`**Total estimated savings: ${fmtSavings(totalLow, totalHigh)}/year**\n`);
  lines.push("Breakdown:\n");

  for (const [category, data] of byCategory) {
    const catLabel = category.charAt(0).toUpperCase() + category.slice(1);
    lines.push(`• **${catLabel}** (${data.count} finding${data.count !== 1 ? "s" : ""}): ${fmtSavings(data.yearlyLow, data.yearlyHigh)}/yr`);
  }

  const autoFixSavings = run.recommendations
    .filter((r) => r.disposition === "auto_fix_candidate")
    .reduce((s, r) => s + (r.yearlyHigh ?? 0), 0);

  if (autoFixSavings > 0) {
    lines.push(`\n**${fmtSavings(0, autoFixSavings)}/yr** of this can be captured with safe auto-fixes.`);
  }

  const actions: ChatAction[] = [];
  if (autoFixSavings > 0) {
    actions.push({ type: "apply_safe", label: "Apply safe fixes", payload: { runId: run.id } });
  }
  actions.push({ type: "export_terraform", label: "Export Terraform", payload: { runId: run.id } });

  return { message: lines.join("\n"), actions };
}

// ---------------------------------------------------------------------------
// 9. start_scan — "Scan my account"
// ---------------------------------------------------------------------------

async function handleStartScan(ctx: ChatContext): Promise<ChatResponse> {
  if (!ctx.activeAccountId) {
    const accounts = await prisma.cloudAccount.findMany({
      where: { organizationId: ctx.organizationId, enabled: true },
      select: { id: true, provider: true, externalAccountId: true },
    });

    if (accounts.length === 0) {
      return { message: "No connected cloud accounts found. Connect an AWS, Azure, or GCP account first." };
    }

    if (accounts.length === 1) {
      return {
        message: `Starting a scan on your ${providerLabel(accounts[0].provider)} account (${accounts[0].externalAccountId})…`,
        data: { action: "trigger_scan", accountId: accounts[0].id, provider: accounts[0].provider },
        actions: [
          {
            type: "start_scan",
            label: "Confirm scan",
            payload: { accountId: accounts[0].id, provider: accounts[0].provider },
          },
        ],
      };
    }

    const accountLines = accounts.map(
      (a, i) => `${i + 1}. ${providerLabel(a.provider)} — ${a.externalAccountId}`,
    );
    return {
      message: `Which account should I scan?\n\n${accountLines.join("\n")}`,
      data: { accounts: accounts.map((a) => ({ id: a.id, provider: a.provider, externalId: a.externalAccountId })) },
    };
  }

  return {
    message: "Starting scan now…",
    data: { action: "trigger_scan", accountId: ctx.activeAccountId, provider: ctx.provider },
    actions: [
      {
        type: "start_scan",
        label: "Confirm scan",
        payload: { accountId: ctx.activeAccountId, provider: ctx.provider },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 10. approval_decision — "Approve these fixes"
// ---------------------------------------------------------------------------

async function handleApprovalDecision(
  ctx: ChatContext,
  params: Record<string, string>,
): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  if (run.status !== "completed") {
    return { message: `Can't process approvals — run status is **${run.status}**.` };
  }

  const plan = run.executionPlan;
  if (!plan) {
    return { message: "No execution plan exists for this run." };
  }

  const approvalItems = plan.items.filter((i) => i.disposition === "approval_required");
  if (approvalItems.length === 0) {
    return { message: "No items require approval. All actions are either auto-fixable or report-only." };
  }

  const decision = params.decision ?? "approve_all";

  if (decision === "reject_all") {
    return {
      message: `Understood — rejecting all ${approvalItems.length} pending action${approvalItems.length !== 1 ? "s" : ""}. No changes will be made.`,
      data: {
        action: "submit_approval",
        runId: run.id,
        decision: "reject_all",
        itemIds: approvalItems.map((i) => i.id),
      },
    };
  }

  const itemSummary = approvalItems.slice(0, 5).map(
    (i) => `• ${i.currentState} → ${i.recommendedState} (${i.riskLevel} risk)`,
  ).join("\n");

  return {
    message:
      `**${approvalItems.length} action${approvalItems.length !== 1 ? "s" : ""} pending approval:**\n\n${itemSummary}\n\n` +
      "Confirm to proceed.",
    actions: [
      {
        type: "approve_all",
        label: `Approve all ${approvalItems.length}`,
        payload: {
          runId: run.id,
          decision: "approve_all",
          itemIds: approvalItems.map((i) => i.id),
        },
      },
      {
        type: "reject_all",
        label: "Reject all",
        payload: { runId: run.id, decision: "reject_all", itemIds: approvalItems.map((i) => i.id) },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 11. explain_finding — "Tell me more about X"
// ---------------------------------------------------------------------------

async function handleExplainFinding(
  ctx: ChatContext,
  params: Record<string, string>,
): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  const ref = params.ref;
  const finding = ref
    ? run.findings.find((f) => f.id === ref || f.id.endsWith(ref))
    : run.findings[0];

  if (!finding) {
    return { message: "I couldn't find that specific item. Try asking about a specific finding by its ID." };
  }

  const rec = run.recommendations.find((r) => r.findingId === finding.id);

  const parts: string[] = [];
  parts.push(`**${finding.title}**`);
  parts.push(`Category: ${finding.category} · Severity: ${finding.severity} · Confidence: ${finding.confidence}\n`);
  parts.push(finding.description);

  if (finding.affectedResources && Array.isArray(finding.affectedResources)) {
    const resources = finding.affectedResources as string[];
    if (resources.length > 0) {
      parts.push(`\n**Affected resources:** ${resources.slice(0, 5).join(", ")}${resources.length > 5 ? ` (+${resources.length - 5} more)` : ""}`);
    }
  }

  if (finding.yearlyHigh && finding.yearlyHigh > 0) {
    parts.push(`**Estimated savings:** ${fmtSavings(finding.yearlyLow ?? 0, finding.yearlyHigh)}/year`);
  }

  if (rec) {
    parts.push(`\n**Recommendation:** ${rec.title}`);
    parts.push(`Disposition: ${rec.disposition.replace(/_/g, " ")} · Risk: ${rec.riskLevel ?? "n/a"}`);
    if (rec.dispositionReason) parts.push(`Reason: ${rec.dispositionReason}`);
  }

  const actions: ChatAction[] = [];
  if (rec?.actionable) {
    actions.push({ type: "view_finding", label: "View in plan", payload: { findingId: finding.id, runId: run.id } });
  }

  return { message: parts.join("\n"), actions };
}

// ---------------------------------------------------------------------------
// 12. run_status — "What's the status?"
// ---------------------------------------------------------------------------

async function handleRunStatus(ctx: ChatContext): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  const statusLabel: Record<string, string> = {
    pending: "queued and waiting to start",
    running: "currently scanning your infrastructure",
    completed: "finished successfully",
    failed: "encountered an error",
    partially_completed: "finished with some actions failed",
  };

  const parts: string[] = [];
  parts.push(`Your latest scan is **${statusLabel[run.status] ?? run.status}**.`);
  parts.push(`Started: ${fmtDate(run.startedAt ?? run.createdAt)}`);

  if (run.completedAt) {
    parts.push(`Completed: ${fmtDate(run.completedAt)}`);
  }

  if (run.status === "completed") {
    parts.push(`Findings: ${run.findings.length} · Recommendations: ${run.recommendations.length}`);

    const applied = run.auditEvents.filter((e) => e.status === "applied" || e.status === "verified").length;
    if (applied > 0) {
      parts.push(`Actions applied: ${applied}`);
    }
  }

  if (run.status === "failed" && run.errorMessage) {
    parts.push(`Error: ${run.errorMessage}`);
  }

  const actions: ChatAction[] = [];
  if (run.status === "completed" && run.findings.length > 0) {
    actions.push({ type: "view_details", label: "See findings", payload: { runId: run.id } });
  }
  if (run.status === "failed") {
    actions.push({ type: "start_scan", label: "Retry scan", payload: {} });
  }

  return { message: parts.join("\n"), actions };
}

// ---------------------------------------------------------------------------
// 13. list_accounts — "Show my connected accounts"
// ---------------------------------------------------------------------------

async function handleListAccounts(ctx: ChatContext): Promise<ChatResponse> {
  const accounts = await prisma.cloudAccount.findMany({
    where: { organizationId: ctx.organizationId },
    select: { id: true, provider: true, externalAccountId: true, enabled: true, lastScannedAt: true, regions: true },
    orderBy: { connectedAt: "asc" },
  });

  if (accounts.length === 0) {
    return { message: "No cloud accounts connected yet. Add an AWS, Azure, or GCP account to get started." };
  }

  const lines: string[] = [`**${accounts.length} connected account${accounts.length !== 1 ? "s" : ""}:**\n`];

  for (const a of accounts) {
    const status = a.enabled ? "active" : "disabled";
    const lastScan = a.lastScannedAt ? `last scanned ${fmtDate(a.lastScannedAt)}` : "never scanned";
    const regions = Array.isArray(a.regions) ? (a.regions as string[]) : [];
    lines.push(`• **${providerLabel(a.provider)}** — ${a.externalAccountId} (${status}, ${lastScan}, ${regions.length} region${regions.length !== 1 ? "s" : ""})`);
  }

  return { message: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// 14. biggest_savings — "Show my biggest savings opportunities"
// ---------------------------------------------------------------------------

async function handleBiggestSavings(
  ctx: ChatContext,
  params: Record<string, string>,
): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  let findings = run.findings.filter((f) => (f.yearlyHigh ?? 0) > 0);
  const providerFilter = params.provider as CloudProvider | undefined;
  if (providerFilter) findings = findings.filter((f) => f.provider === providerFilter);

  if (findings.length === 0) {
    const scope = providerFilter ? ` in ${providerLabel(providerFilter)}` : "";
    return { message: `No savings opportunities found${scope} in the latest scan.` };
  }

  findings.sort((a, b) => (b.yearlyHigh ?? 0) - (a.yearlyHigh ?? 0));

  const top = findings.slice(0, 7);
  const totalYearly = findings.reduce((s, f) => s + (f.yearlyHigh ?? 0), 0);

  const scope = providerFilter ? ` (${providerLabel(providerFilter)})` : "";
  const lines: string[] = [
    `**Top savings opportunities${scope}** — ${fmtSavings(0, totalYearly)}/yr total across ${findings.length} finding${findings.length !== 1 ? "s" : ""}:\n`,
  ];

  for (let i = 0; i < top.length; i++) {
    const f = top[i];
    const rec = run.recommendations.find((r) => r.findingId === f.id);
    const dispositionTag = rec?.disposition === "auto_fix_candidate"
      ? " · ✦ safe to auto-apply"
      : rec?.disposition === "approval_required"
        ? " · needs approval"
        : "";
    const riskTag = rec?.riskLevel ? ` · ${rec.riskLevel} risk` : "";

    lines.push(
      `**${i + 1}. ${f.title}** — ${fmtSavings(f.yearlyLow ?? 0, f.yearlyHigh ?? 0)}/yr${riskTag}${dispositionTag}`,
    );
    lines.push(`   ${f.category} · ${f.severity} severity · ${f.region}\n`);
  }

  if (findings.length > 7) {
    lines.push(`_…plus ${findings.length - 7} more totaling ${fmtSavings(0, findings.slice(7).reduce((s, f) => s + (f.yearlyHigh ?? 0), 0))}/yr._`);
  }

  const autoFixSavings = run.recommendations
    .filter((r) => r.disposition === "auto_fix_candidate")
    .reduce((s, r) => s + (r.yearlyHigh ?? 0), 0);

  const actions: ChatAction[] = [];
  if (autoFixSavings > 0) {
    actions.push({ type: "apply_safe", label: `Capture ${fmtSavings(0, autoFixSavings)}/yr safely`, payload: { runId: run.id } });
  }
  actions.push({ type: "export_terraform", label: "Export Terraform", payload: { runId: run.id } });

  return {
    message: lines.join("\n"),
    actions,
    followUp: "Ask \"What's safe to automate?\" to see which of these I can handle automatically.",
  };
}

// ---------------------------------------------------------------------------
// 15. automation_assessment — "What's safe to automate?"
// ---------------------------------------------------------------------------

async function handleAutomationAssessment(ctx: ChatContext): Promise<ChatResponse> {
  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  if (run.status !== "completed") {
    return { message: `I need a completed scan to assess automation safety. Current status: **${run.status}**.` };
  }

  const recs = run.recommendations;
  const autoFix = recs.filter((r) => r.disposition === "auto_fix_candidate");
  const approvalReq = recs.filter((r) => r.disposition === "approval_required");
  const reportOnly = recs.filter((r) => r.disposition === "report_only");
  const blocked = recs.filter((r) => r.disposition === "blocked");

  if (recs.length === 0) {
    return { message: "No recommendations in the latest scan — nothing to automate." };
  }

  const lines: string[] = [];

  // Safe to automate
  if (autoFix.length > 0) {
    const savings = autoFix.reduce((s, r) => s + (r.yearlyHigh ?? 0), 0);
    lines.push(`**✦ Safe to auto-apply (${autoFix.length})** — ${fmtSavings(0, savings)}/yr\n`);
    lines.push("These are low-risk, non-disruptive, and fully reversible:\n");
    for (const r of autoFix.slice(0, 5)) {
      lines.push(`• ${r.title} (${r.riskLevel ?? "low"} risk)`);
    }
    if (autoFix.length > 5) lines.push(`• _…plus ${autoFix.length - 5} more_`);
    lines.push("");
  }

  // Needs approval
  if (approvalReq.length > 0) {
    const savings = approvalReq.reduce((s, r) => s + (r.yearlyHigh ?? 0), 0);
    lines.push(`**⚠ Needs your approval (${approvalReq.length})** — ${fmtSavings(0, savings)}/yr\n`);
    lines.push("Higher impact — I'll prepare them but won't apply without your say-so:\n");
    for (const r of approvalReq.slice(0, 3)) {
      lines.push(`• ${r.title} (${r.riskLevel ?? "medium"} risk) — ${r.dispositionReason ?? ""}`);
    }
    if (approvalReq.length > 3) lines.push(`• _…plus ${approvalReq.length - 3} more_`);
    lines.push("");
  }

  // Report only
  if (reportOnly.length > 0) {
    lines.push(`**📋 Report only (${reportOnly.length})** — manual action recommended\n`);
    lines.push("These require human judgment or have irreversible side effects:\n");
    for (const r of reportOnly.slice(0, 3)) {
      lines.push(`• ${r.title} — ${r.dispositionReason ?? "requires manual review"}`);
    }
    if (reportOnly.length > 3) lines.push(`• _…plus ${reportOnly.length - 3} more_`);
    lines.push("");
  }

  // Blocked
  if (blocked.length > 0) {
    lines.push(`**🚫 Blocked (${blocked.length})** — cannot proceed\n`);
    for (const r of blocked.slice(0, 2)) {
      lines.push(`• ${r.title} — ${r.dispositionReason ?? "blocked by policy"}`);
    }
    lines.push("");
  }

  const actions: ChatAction[] = [];
  if (autoFix.length > 0) {
    actions.push({
      type: "apply_safe",
      label: `Apply ${autoFix.length} safe fix${autoFix.length !== 1 ? "es" : ""}`,
      payload: { runId: run.id },
    });
  }
  if (approvalReq.length > 0) {
    actions.push({
      type: "approve_all",
      label: `Review ${approvalReq.length} for approval`,
      payload: { runId: run.id, itemIds: approvalReq.map((r) => r.id) },
    });
  }

  return { message: lines.join("\n"), actions };
}

// ---------------------------------------------------------------------------
// 16. provider_summary — "Can you summarize AWS only?"
// ---------------------------------------------------------------------------

async function handleProviderSummary(
  ctx: ChatContext,
  params: Record<string, string>,
): Promise<ChatResponse> {
  const provider = params.provider as CloudProvider | undefined;
  if (!provider) {
    return {
      message: "Which cloud provider? I can summarize **AWS**, **Azure**, or **GCP**.",
    };
  }

  const run = await getLatestRun(ctx);
  if (!run) return noScanResponse();

  const findings = run.findings.filter((f) => f.provider === provider);
  const recs = run.recommendations.filter((r) => {
    const finding = run.findings.find((f) => f.id === r.findingId);
    return finding?.provider === provider;
  });

  if (findings.length === 0) {
    return {
      message: `No findings for ${providerLabel(provider)} in the latest scan. ` +
        (run.cloudAccount?.provider === provider
          ? "Your infrastructure looks healthy."
          : `The scan may not have included a ${providerLabel(provider)} account.`),
    };
  }

  const costCount = findings.filter((f) => f.category === "cost").length;
  const securityCount = findings.filter((f) => f.category === "security").length;
  const resilienceCount = findings.filter((f) => f.category === "resilience").length;
  const highSeverity = findings.filter((f) => f.severity === "high" || f.severity === "critical").length;

  const totalYearlyLow = findings.reduce((s, f) => s + (f.yearlyLow ?? 0), 0);
  const totalYearlyHigh = findings.reduce((s, f) => s + (f.yearlyHigh ?? 0), 0);

  const autoFixCount = recs.filter((r) => r.disposition === "auto_fix_candidate").length;
  const approvalCount = recs.filter((r) => r.disposition === "approval_required").length;

  const regions = Array.from(new Set(findings.map((f) => f.region).filter(Boolean)));

  const lines: string[] = [
    `**${providerLabel(provider)} Summary**\n`,
    `**${findings.length} finding${findings.length !== 1 ? "s" : ""}** across ${regions.length} region${regions.length !== 1 ? "s" : ""} (${regions.join(", ")})\n`,
  ];

  const breakdown: string[] = [];
  if (costCount > 0) breakdown.push(`${costCount} cost`);
  if (securityCount > 0) breakdown.push(`${securityCount} security`);
  if (resilienceCount > 0) breakdown.push(`${resilienceCount} resilience`);
  if (breakdown.length > 0) lines.push(`Categories: ${breakdown.join(", ")}`);
  if (highSeverity > 0) lines.push(`**${highSeverity}** high/critical severity`);
  if (totalYearlyHigh > 0) lines.push(`Estimated savings: **${fmtSavings(totalYearlyLow, totalYearlyHigh)}/year**`);

  lines.push("");
  if (autoFixCount > 0) lines.push(`✦ ${autoFixCount} safe to auto-apply`);
  if (approvalCount > 0) lines.push(`⚠ ${approvalCount} need${approvalCount === 1 ? "s" : ""} approval`);

  const actions: ChatAction[] = [];
  if (autoFixCount > 0) {
    actions.push({ type: "apply_safe", label: `Apply safe ${providerLabel(provider)} fixes`, payload: { runId: run.id, provider } });
  }
  actions.push({ type: "export_terraform", label: `Export ${providerLabel(provider)} Terraform`, payload: { runId: run.id, provider } });

  return {
    message: lines.join("\n"),
    actions,
    followUp: `Ask "Show my biggest savings for ${providerLabel(provider)}" to see the top opportunities.`,
  };
}

// ---------------------------------------------------------------------------
// 17. monitor_alerts — "Any new alerts?"
// ---------------------------------------------------------------------------

async function handleMonitorAlerts(
  ctx: ChatContext,
  params: Record<string, string>,
): Promise<ChatResponse> {
  const timeSince = params.timeSince ? new Date(params.timeSince) : undefined;
  const timeLabel = params.timeLabel ?? "recently";

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
  };
  if (timeSince) {
    where.createdAt = { gte: timeSince };
  } else {
    where.createdAt = { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) };
  }

  let alerts: Array<{
    id: string;
    category: string;
    severity: string;
    title: string;
    createdAt: Date;
  }>;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- model pending Prisma migration
    alerts = await (prisma as any).axiomMonitorAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, category: true, severity: true, title: true, createdAt: true },
    });
  } catch {
    return {
      message: "Monitor alerts aren't available yet. Run a scan first to establish a baseline, then monitoring will detect changes automatically.",
      actions: [{ type: "start_scan", label: "Start scan", payload: {} }],
    };
  }

  if (alerts.length === 0) {
    return {
      message: `No alerts ${timeLabel}. Your infrastructure is stable.`,
      followUp: "Ask \"What changed this week?\" to compare scan results over time.",
    };
  }

  const critical = alerts.filter((a) => a.severity === "critical");
  const warning = alerts.filter((a) => a.severity === "warning");
  const info = alerts.filter((a) => a.severity === "info");

  const lines: string[] = [
    `**${alerts.length} alert${alerts.length !== 1 ? "s" : ""} ${timeLabel}:**\n`,
  ];

  if (critical.length > 0) {
    lines.push(`**🔴 Critical (${critical.length}):**`);
    for (const a of critical.slice(0, 3)) {
      lines.push(`• ${a.title} — ${fmtDate(a.createdAt)}`);
    }
    lines.push("");
  }

  if (warning.length > 0) {
    lines.push(`**🟡 Warning (${warning.length}):**`);
    for (const a of warning.slice(0, 3)) {
      lines.push(`• ${a.title} — ${fmtDate(a.createdAt)}`);
    }
    lines.push("");
  }

  if (info.length > 0) {
    lines.push(`**ℹ Info (${info.length}):**`);
    for (const a of info.slice(0, 2)) {
      lines.push(`• ${a.title}`);
    }
    if (info.length > 2) lines.push(`• _…plus ${info.length - 2} more_`);
  }

  const actions: ChatAction[] = [];
  if (critical.length > 0) {
    actions.push({ type: "view_alerts", label: "View critical alerts", payload: { severity: "critical" } });
  }

  return { message: lines.join("\n"), actions };
}

// ---------------------------------------------------------------------------
// 18. unknown — fallback
// ---------------------------------------------------------------------------

async function handleUnknown(): Promise<ChatResponse> {
  return {
    message:
      "I can help with your cloud infrastructure. Try asking me:\n\n" +
      "• \"What did you find?\"\n" +
      "• \"What should I fix first?\"\n" +
      "• \"Show my biggest savings opportunities\"\n" +
      "• \"What's safe to automate?\"\n" +
      "• \"Apply the safe fixes\"\n" +
      "• \"Generate Terraform for Azure\"\n" +
      "• \"Why is this risky?\"\n" +
      "• \"What changed this week?\"\n" +
      "• \"Can you summarize AWS only?\"\n" +
      "• \"Any new alerts?\"\n" +
      "• \"Scan my account\"",
  };
}

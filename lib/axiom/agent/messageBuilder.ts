import type { CloudProvider } from "../cloudSnapshot";
import type {
  AgentMessage,
  AgentFinding,
  AgentRecommendation,
  AgentActionPlan,
  AgentApplyResult,
} from "./types";

const P: Record<CloudProvider, string> = { aws: "AWS", azure: "Azure", gcp: "Google Cloud" };

export function scanStarted(provider: CloudProvider, accountId: string): AgentMessage {
  return {
    type: "scan_started",
    title: "Scanning your infrastructure",
    body: `I'm connecting to your ${P[provider]} account (${accountId}) and collecting resource data. This usually takes 30–60 seconds.`,
  };
}

export function scanComplete(provider: CloudProvider, resourceCount: number, regionCount: number): AgentMessage {
  return {
    type: "scan_complete",
    title: "Scan complete",
    body: `Found ${resourceCount} resources across ${regionCount} region${regionCount === 1 ? "" : "s"} in ${P[provider]}. Analyzing for cost, resilience, and security opportunities.`,
  };
}

export function findingsSummary(
  findings: AgentFinding[],
  recommendations: AgentRecommendation[],
  totalSavings: { monthly: number; yearly: number },
  nextAction: string | null,
): AgentMessage {
  if (findings.length === 0) {
    return {
      type: "no_action_needed",
      title: "Your infrastructure looks good",
      body: "I didn't find any significant cost or resilience issues. I'll check again on your next scheduled scan.",
    };
  }

  const savingsOpps = recommendations.filter(
    (r) => r.estimatedSavings && (r.estimatedSavings.monthly > 0 || r.estimatedSavings.yearly > 0),
  ).length;
  const safeActions = recommendations.filter((r) => r.disposition === "auto_fix_candidate").length;

  const parts: string[] = [];
  parts.push(
    `I found ${findings.length} issue${findings.length === 1 ? "" : "s"}, ` +
    `${savingsOpps} savings opportunit${savingsOpps === 1 ? "y" : "ies"}, ` +
    `and ${safeActions} safe action${safeActions === 1 ? "" : "s"}.`,
  );

  if (totalSavings.yearly > 0) {
    parts.push(`Estimated annual savings: $${totalSavings.yearly.toLocaleString()}/yr ($${totalSavings.monthly.toLocaleString()}/mo).`);
  }

  if (nextAction) {
    parts.push(`Next recommended action: ${nextAction}`);
  }

  return {
    type: "findings_summary",
    title: `${findings.length} finding${findings.length === 1 ? "" : "s"} identified`,
    body: parts.join(" "),
    data: {
      findingCount: findings.length,
      savingsOpportunities: savingsOpps,
      safeActionCount: safeActions,
      estimatedSavings: totalSavings,
      nextAction,
    },
  };
}

export function approvalRequest(plan: AgentActionPlan, provider: CloudProvider): AgentMessage {
  const auto = plan.autoFixCandidates;
  const approval = plan.approvalRequired;
  const report = plan.reportOnly;

  const parts: string[] = ["Here's my recommended action plan:"];

  if (auto.length > 0) {
    const savings = auto.reduce((s, i) => s + i.estimatedSavings.monthly, 0);
    parts.push(
      `\n• ${auto.length} low-risk ${auto.length === 1 ? "change" : "changes"} I can apply automatically ` +
      `($${savings}/mo savings) — storage lifecycle policies that are non-disruptive and reversible.`,
    );
  }

  if (approval.length > 0) {
    const savings = approval.reduce((s, i) => s + i.estimatedSavings.monthly, 0);
    parts.push(
      `\n• ${approval.length} ${approval.length === 1 ? "change" : "changes"} that ` +
      `${approval.length === 1 ? "needs" : "need"} your approval ($${savings}/mo savings) — ` +
      `compute resizes that require a brief restart.`,
    );
  }

  if (report.length > 0) {
    parts.push(
      `\n• ${report.length} ${report.length === 1 ? "item" : "items"} for your review — ` +
      `commitment purchases or actions that need more data before proceeding.`,
    );
  }

  parts.push("\nI've run prechecks and generated rollback plans for every action. What would you like to do?");

  return {
    type: "approval_request",
    title: "Action plan ready for review",
    body: parts.join(""),
    data: {
      autoFixCount: auto.length,
      approvalCount: approval.length,
      reportCount: report.length,
    },
  };
}

export function applyStarted(actionCount: number): AgentMessage {
  return {
    type: "applying",
    title: "Applying changes",
    body: `Applying ${actionCount} approved ${actionCount === 1 ? "action" : "actions"}. I'll verify each one after it completes.`,
  };
}

export function applyComplete(
  results: AgentApplyResult[],
  savingsRealized: { monthly: number; yearly: number },
): AgentMessage {
  const verified = results.filter((r) => r.status === "verified").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  if (failed === 0 && verified > 0) {
    return {
      type: "apply_complete",
      title: `${verified} ${verified === 1 ? "change" : "changes"} applied and verified`,
      body: `All changes are live and verified. Estimated savings: $${savingsRealized.monthly.toLocaleString()}/mo ($${savingsRealized.yearly.toLocaleString()}/yr). Rollback instructions are saved in your audit log.`,
      data: { verified, failed, skipped, savingsRealized },
    };
  }

  if (verified > 0 && failed > 0) {
    return {
      type: "apply_complete",
      title: `${verified} applied, ${failed} failed`,
      body: `${verified} ${verified === 1 ? "change was" : "changes were"} applied successfully. ${failed} ${failed === 1 ? "action" : "actions"} couldn't be completed — those resources were not modified. Check the details below for error information.`,
      data: { verified, failed, skipped, savingsRealized },
    };
  }

  return {
    type: "error",
    title: "Changes could not be applied",
    body: `${failed} ${failed === 1 ? "action" : "actions"} failed. Your infrastructure was not modified. Review the error details and try again, or export the CLI script to apply manually.`,
    data: { verified, failed, skipped },
  };
}

export function noActionNeeded(): AgentMessage {
  return {
    type: "no_action_needed",
    title: "No action needed right now",
    body: "Your infrastructure is well-optimized based on current data. I'll keep monitoring and let you know if anything changes.",
  };
}

export function agentError(error: string): AgentMessage {
  return {
    type: "error",
    title: "Something went wrong",
    body: `I ran into an issue: ${error}. Your infrastructure was not modified. Check your cloud connector credentials and try again.`,
  };
}

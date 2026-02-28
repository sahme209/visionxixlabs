/**
 * Cloud Automation: Agent loop scaffold.
 * Observe → Plan → Act → Verify → Report.
 * Used by autonomous remediation (cost, drift, security, CI/CD, etc.).
 */

export type AgentPhase = "observe" | "plan" | "act" | "verify" | "report";

export interface AgentContext {
  leadId: string;
  remediationType: string;
  /** Connector credentials (decrypted) - use only in server context */
  connectors?: Record<string, unknown>;
  /** Full payload from lead */
  fullPayload?: Record<string, unknown>;
}

export interface ObserveResult {
  signals: string[];
  rawData?: Record<string, unknown>;
  detectedIssues: Array<{
    id: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    estimatedImpact?: string;
  }>;
}

export interface PlanResult {
  actions: Array<{
    id: string;
    actionType: "github_pr" | "cloud_api" | "manual";
    title: string;
    description: string;
    files?: Array<{ path: string; content: string }>;
    approvalRequired: boolean;
  }>;
  rollbackPlan?: string[];
}

export interface ActResult {
  success: boolean;
  actionId: string;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

export interface VerifyResult {
  verified: boolean;
  actionId: string;
  message?: string;
}

export interface ReportResult {
  phase: AgentPhase;
  success: boolean;
  summary: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Run the full agent loop for a remediation.
 * Each phase can be implemented by playbook-specific logic.
 */
export async function runAgentLoop(opts: {
  context: AgentContext;
  observe: (ctx: AgentContext) => Promise<ObserveResult>;
  plan: (ctx: AgentContext, observeResult: ObserveResult) => Promise<PlanResult>;
  act: (ctx: AgentContext, planResult: PlanResult) => Promise<ActResult[]>;
  verify?: (ctx: AgentContext, actResults: ActResult[]) => Promise<VerifyResult[]>;
  report: (ctx: AgentContext, phase: AgentPhase, result: unknown) => Promise<ReportResult>;
}): Promise<{ reports: ReportResult[]; actResults: ActResult[] }> {
  const reports: ReportResult[] = [];
  let actResults: ActResult[] = [];

  try {
    const observeResult = await opts.observe(opts.context);
    reports.push(await opts.report(opts.context, "observe", observeResult));

    if (observeResult.detectedIssues.length === 0) {
      reports.push(
        await opts.report(opts.context, "report", {
          success: true,
          summary: "No issues detected. No remediation needed.",
        })
      );
      return { reports, actResults };
    }

    const planResult = await opts.plan(opts.context, observeResult);
    reports.push(await opts.report(opts.context, "plan", planResult));

    if (planResult.actions.length === 0) {
      reports.push(
        await opts.report(opts.context, "report", {
          success: true,
          summary: "No actions generated. Manual review recommended.",
        })
      );
      return { reports, actResults };
    }

    actResults = await opts.act(opts.context, planResult);
    reports.push(await opts.report(opts.context, "act", actResults));

    if (opts.verify && actResults.length > 0) {
      const verifyResults = await opts.verify(opts.context, actResults);
      reports.push(await opts.report(opts.context, "verify", verifyResults));
    }

    const summary =
      actResults.filter((r) => r.success).length > 0
        ? `Completed ${actResults.filter((r) => r.success).length}/${actResults.length} actions.`
        : "No actions completed successfully.";
    reports.push(
      await opts.report(opts.context, "report", {
        success: actResults.some((r) => r.success),
        summary,
        actResults,
      })
    );
  } catch (e) {
    reports.push(
      await opts.report(opts.context, "report", {
        success: false,
        summary: e instanceof Error ? e.message : "Agent loop failed",
      })
    );
  }

  return { reports, actResults };
}

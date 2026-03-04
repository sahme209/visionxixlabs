/**
 * Axiom Assistant Agent — AI DevOps engineer for Cloud Operator.
 * Uses TOOL_CALLING, executes real actions via axiomAssistantTools.
 */

import { generate } from "@/lib/ai/orchestrator";
import { appendMessage, getConversation } from "@/lib/axiomChat/storage";
import { buildAxiomEnvironmentContext, type AxiomEnvironmentContext } from "@/lib/axiom/contextBuilder";
import { AXIOM_ASSISTANT_TOOLS, type ToolContext } from "./axiomAssistantTools";
import { mapIntentToPlugin, getMultiStepIntent } from "./intentToPluginMap";
import { executeWorkflow } from "./axiomWorkflowExecutor";

const CONFIRM_APPLY_PHRASE = "CONFIRM APPLY";

/** Tools/args that modify infrastructure. Require CONFIRM APPLY or we force dryRun. */
function isDestructiveToolCall(name: string, args: Record<string, unknown>): boolean {
  if (name === "runExecutionPlugin") {
    return args.apply === true;
  }
  return false;
}

/** Force dryRun=true, apply=false for safety when CONFIRM APPLY is missing. */
function forceDryRunArgs(args: Record<string, unknown>): Record<string, unknown> {
  return { ...args, dryRun: true, apply: false };
}

/** Whitelist of allowed tool names. Reject any tool call not in this list. */
const ALLOWED_TOOL_NAMES = new Set<string>(Object.keys(AXIOM_ASSISTANT_TOOLS));

function formatAxiomContextForPrompt(ctx: AxiomEnvironmentContext): string {
  const lines: string[] = [];
  const conn = ctx.connectors;
  lines.push(`connectors: aws=${conn.aws ? "linked" : "not linked"}, github=${conn.github ? "linked" : "not linked"}, azure=${conn.azure ? "linked" : "not linked"}, gcp=${conn.gcp ? "linked" : "not linked"}`);
  if (ctx.cloudAccountId) lines.push(`cloudAccountId: ${ctx.cloudAccountId}`);
  if (ctx.axiomScore) {
    const s = ctx.axiomScore;
    lines.push(`axiomScore: infrastructure=${s.infrastructureScore ?? "—"}, savings=${s.estimatedAnnualSavings != null ? `$${s.estimatedAnnualSavings}` : "—"}, risk=${s.riskExposureLevel ?? "—"}, tier=${s.complexityTier ?? "—"}`);
  }
  if (ctx.recentFindings.length > 0) {
    lines.push(`recentFindings: ${ctx.recentFindings.slice(0, 10).join(" | ")}`);
  }
  if (ctx.lastExecutions.length > 0) {
    lines.push(
      `lastExecutions: ${ctx.lastExecutions.map((e) => `${e.pluginId} (${e.status}) @ ${e.executedAt.toISOString()}`).join("; ")}`
    );
  }
  lines.push(`environmentSummary: ${ctx.environmentSummary}`);
  return lines.join("\n");
}

export type AxiomAssistantInput = {
  conversationId: string;
  userId?: string | null;
  leadId?: string | null;
  message: string;
  contextSummary?: string;
};

export type AxiomSuggestedAction =
  | { type: "run_plugin"; pluginId: string }
  | { type: "view_execution_history" }
  | { type: "export_report" }
  | { type: "run_analysis" }
  | { type: "generate_report" }
  | { type: "open_connectors" }
  | { type: "connect_aws" }
  | { type: "learn_connect_aws" };

/** DevOps execution plan — structured steps requiring user approval before execution. */
export type DevOpsPlanStep =
  | { action: "run_plugin"; pluginId: string; input?: Record<string, unknown> }
  | { action: "generate_report" }
  | { action: "run_analysis" }
  | { action: "view_execution_history" }
  | { action: "export_report" };

export type DevOpsPlan = {
  goal: string;
  steps: DevOpsPlanStep[];
};

export type AxiomAssistantOutput = {
  assistantMessage: string;
  toolResultsSummary?: string[];
  actions?: AxiomSuggestedAction[];
  /** When present, execution plan requiring approval before running. Do not execute toolCalls. */
  plan?: DevOpsPlan;
  requiresApproval?: boolean;
};

const RESPONSE_TEMPLATE = `
Format assistantMessage in markdown using this structure (include every section; use "None" if not applicable):

**1) Understanding**
- One line summarizing what the user wants.

**2) Missing info**
- Bullet list of info you need (or "None" if you have enough).

**3) Proposed plan**
- 3–7 numbered steps describing what we’ll do.

**4) Actions I can run now**
- List specific actions as buttons/commands (e.g. \`Run analysis\`, \`Export pack\`). One per line.

**5) Safety note**
- State whether actions are read-only or require confirmation (type CONFIRM APPLY to apply).
`;

const SYSTEM_PROMPT = `You are Axiom, an AI DevOps engineer.

Your role is to help users manage cloud infrastructure safely.

You:
- analyze environments
- propose automation plans
- execute approved actions through tools
- never make infrastructure changes without explicit confirmation

Always think like a senior platform engineer responsible for production systems.

RULES:
1. Output STRICT JSON only, no markdown fences. Schema:
   { "assistantMessage": "string", "plan": { "goal": "string", "steps": [...] } | null, "toolCalls": [...], "actions": [...] }
2. DevOps task planning: When the user asks for a multi-step DevOps task (e.g. "secure my AWS account", "audit and fix IAM", "discover infra then run IAM scan"), output a plan instead of toolCalls. Plan format: { goal: "short goal", steps: [{ action: "run_plugin", pluginId: "aws:iam-exposure-scan" }, { action: "run_plugin", pluginId: "aws:disable-unused-access-key" }, { action: "generate_report" }] }. Valid step actions: run_plugin (include pluginId), generate_report, run_analysis, view_execution_history, export_report. Set plan and omit toolCalls — the user must approve before execution. For simple one-off requests (single plugin, export, etc.), use toolCalls as before.
3. actions: Optional array of suggested actions for the UI. Types: run_plugin (include pluginId: "aws:iam-exposure-scan" etc), view_execution_history, export_report, run_analysis, generate_report. Omit if none.
4. assistantMessage: Your reply in markdown. You MUST follow this structure:
   ${RESPONSE_TEMPLATE}
5. toolCalls: Array of tools to run. Use ONLY the allowed tools listed below. Omit if none needed. When plan is present, omit toolCalls — plan requires approval first.
6. INTENT MAPPING — For simple read-only requests, ALWAYS output toolCalls immediately (do NOT output a plan):
   - "scan environment", "discover infra", "show infrastructure", "what do I have" → runExecutionPlugin(pluginId: "aws:infra-discovery")
   - "check IAM security", "analyze security posture", "scan for issues", "IAM audit" → runExecutionPlugin(pluginId: "aws:iam-exposure-scan")
   - "disable unused keys", "cleanup keys" → runExecutionPlugin(pluginId: "aws:disable-unused-access-key") with dryRun: true first; destructive runs require CONFIRM APPLY
7. MULTI-STEP PLANS — For "secure my AWS", "audit and fix IAM", "full security check", output a plan with steps in order: (1) aws:infra-discovery, (2) aws:iam-exposure-scan, (3) aws:disable-unused-access-key (dryRun), (4) generate_report, (5) user approves then execute fixes.
8. Destructive actions (apply=true) require "CONFIRM APPLY" in the user's message. Otherwise the system forces dryRun=true.
9. GUARDRAIL — If the user requests a capability that does NOT exist in the available tools (e.g. custom scripts, unsupported clouds, arbitrary APIs), respond with exactly: "I cannot execute that yet."
10. If you're not sure, ask clarifying questions instead of guessing.
11. You receive ENVIRONMENT CONTEXT below. Reference it when proposing actions (e.g. "AWS is linked" vs "Link AWS first", "IAM scan ran with N findings" vs "Run IAM scan to see findings").
12. PROACTIVE SUGGESTIONS — When recentFindings, lastExecutions, or axiomScore exist, populate the actions array with relevant suggestions (run_plugin, view_execution_history, run_analysis, export_report, generate_report).

Available tools:
- getConnectorStatus: Get AWS/Azure/GCP/GitHub connector status. No args.
- linkConnectorHint: Get instructions for linking a connector. args: { connectorType?: "github"|"aws"|"azure"|"gcp" }
- runAxiomAnalysis: Run Cloud Operator analysis. No args.
- runExecutionPlugin: Run a plugin. args: { pluginId, input?, dryRun?, apply? }
  - pluginId: "aws:iam-exposure-scan" | "aws:disable-unused-access-key" | "aws:infra-discovery" | "aws:cost-explorer-summary" | "aws:s3-public-bucket-scan" | "github:create-cicd-pipeline"
  - dryRun: true (default) for read-only. apply: true to execute (requires CONFIRM APPLY).
- fetchExecutionHistory: Get past scan/execution results. No args.
- generateAndSendReport: Send executive summary email to lead. No args.
- exportPack: Build and get download URL for export ZIP. No args.`;

export async function runAxiomAssistantAgent(input: AxiomAssistantInput): Promise<AxiomAssistantOutput> {
  const { conversationId, userId, leadId, message, contextSummary } = input;

  if (!leadId) {
    return {
      assistantMessage:
        "I need a Cloud Operator session (leadId) to help. Please open the Cloud Operator page with your token.",
    };
  }

  const hasConfirmApply = message.toUpperCase().includes(CONFIRM_APPLY_PHRASE);
  const ctx: ToolContext = {
    leadId,
    userId,
    userConfirmedApply: hasConfirmApply,
  };

  await appendMessage(conversationId, { role: "user", content: message });

  const conv = await getConversation(conversationId, 30);
  if (!conv) {
    return { assistantMessage: "Conversation not found." };
  }

  const axiomContext = await buildAxiomEnvironmentContext({ leadId, userId });

  const envContextBlock = formatAxiomContextForPrompt(axiomContext);

  const historyText = conv.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const contextBlock = contextSummary
    ? `\n\nAdditional context: ${contextSummary}`
    : "";

  const userPrompt = `ENVIRONMENT CONTEXT (reference this when proposing actions):
${envContextBlock}

Recent messages:
${historyText}

Latest user message: ${message}${contextBlock}

Respond with JSON only. Format assistantMessage using the required structure (Understanding, Missing info, Proposed plan, Actions I can run now, Safety note). Reference the environment context in your plan and actions. When the environment has findings, executions, or scores, proactively suggest relevant actions in the actions array (run_plugin, view_execution_history, run_analysis, export_report, generate_report).`;

  let parsed: {
    assistantMessage?: string;
    plan?: { goal?: string; steps?: Array<{ action: string; pluginId?: string; input?: Record<string, unknown> }> };
    toolCalls?: Array<{ name: string; arguments?: Record<string, unknown> }>;
    actions?: Array<{ type: string; pluginId?: string }>;
  };

  try {
    const res = await generate({
      taskType: "TOOL_CALLING",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2048,
      temperature: 0.3,
      responseFormat: "json",
      userId: userId ?? undefined,
    });

    const raw = res.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(raw);
  } catch (e) {
    await appendMessage(conversationId, {
      role: "assistant",
      content: "I had trouble processing that. Please try again.",
    });
    return { assistantMessage: "I had trouble processing that. Please try again." };
  }

  const assistantMessage = parsed.assistantMessage ?? "I'm not sure how to help with that.";
  const rawPlan = parsed.plan;

  const VALID_PLUGIN_IDS = ["aws:iam-exposure-scan", "aws:disable-unused-access-key", "aws:infra-discovery", "aws:cost-explorer-summary", "aws:s3-public-bucket-scan", "github:create-cicd-pipeline"];
  const VALID_STEP_ACTIONS = new Set(["run_plugin", "generate_report", "run_analysis", "view_execution_history", "export_report"]);

  let plan: DevOpsPlan | undefined;
  let requiresApproval = false;
  if (rawPlan?.goal && Array.isArray(rawPlan.steps) && rawPlan.steps.length > 0) {
    const steps: DevOpsPlanStep[] = [];
    for (const s of rawPlan.steps) {
      const action = String(s?.action ?? "").trim();
      if (!VALID_STEP_ACTIONS.has(action)) continue;
      if (action === "run_plugin") {
        const pluginId = String(s?.pluginId ?? "").trim();
        if (VALID_PLUGIN_IDS.includes(pluginId)) {
          steps.push({
            action: "run_plugin",
            pluginId,
            input: (s?.input as Record<string, unknown>) ?? undefined,
          });
        }
      } else {
        steps.push({ action: action as "generate_report" | "run_analysis" | "view_execution_history" | "export_report" });
      }
    }
    if (steps.length > 0) {
      plan = { goal: String(rawPlan.goal).trim() || "Execute DevOps plan", steps };
      requiresApproval = true;
    }
  }

  // Intent fallback: if LLM returned no toolCalls and no plan, try intent mapping
  let resolvedToolCalls = plan ? [] : (parsed.toolCalls ?? []);
  if (resolvedToolCalls.length === 0 && !plan) {
    const multiStep = getMultiStepIntent(message);
    if (multiStep && multiStep.length > 0) {
      const steps: DevOpsPlanStep[] = multiStep
        .filter((id) => VALID_PLUGIN_IDS.includes(id))
        .map((pluginId) => ({ action: "run_plugin" as const, pluginId }));
      if (steps.length > 0) {
        steps.push({ action: "generate_report" });
        plan = { goal: "Secure and analyze AWS environment", steps };
        requiresApproval = true;
      }
    }
    if (!plan) {
      const intent = mapIntentToPlugin(message);
      if (intent && intent.readOnly && intent.confidence === "high" && VALID_PLUGIN_IDS.includes(intent.pluginId)) {
        resolvedToolCalls = [
          { name: "runExecutionPlugin", arguments: { pluginId: intent.pluginId, dryRun: true } },
        ];
      }
    }
  }
  const toolCalls = resolvedToolCalls;

  // Auto-execute read-only workflow steps when plan has run_plugin steps
  let workflowResult: Awaited<ReturnType<typeof executeWorkflow>> | null = null;
  if (plan && leadId && plan.steps.some((s) => s.action === "run_plugin")) {
    try {
      workflowResult = await executeWorkflow(
        plan,
        { leadId, userId: userId ?? undefined, userConfirmedApply: hasConfirmApply },
        { connectors: axiomContext.connectors }
      );
      if (workflowResult.executedSteps.length > 0 && workflowResult.remainingPlan) {
        plan = workflowResult.remainingPlan;
      } else if (workflowResult.executedSteps.length > 0 && !workflowResult.remainingPlan) {
        plan = undefined;
        requiresApproval = false;
      }
    } catch {
      workflowResult = null;
    }
  }

  const rawActions = parsed.actions ?? [];
  const actions: AxiomSuggestedAction[] = [];
  const validPluginIds = ["aws:iam-exposure-scan", "aws:disable-unused-access-key", "aws:infra-discovery", "aws:cost-explorer-summary", "aws:s3-public-bucket-scan", "github:create-cicd-pipeline"];
  for (const a of rawActions) {
    const t = String(a?.type ?? "").trim();
    if (t === "run_plugin" && a?.pluginId && validPluginIds.includes(String(a.pluginId))) {
      actions.push({ type: "run_plugin", pluginId: String(a.pluginId) });
    } else if (t === "view_execution_history" || t === "export_report" || t === "run_analysis" || t === "generate_report") {
      actions.push({ type: t } as AxiomSuggestedAction);
    }
  }

  const toolResults: Array<{ name: string; ok: boolean; data?: unknown; error?: string }> = [];

  for (const tc of toolCalls) {
    const name = String(tc.name ?? "").trim();
    const args = (tc.arguments ?? {}) as Record<string, unknown>;

    if (!ALLOWED_TOOL_NAMES.has(name)) {
      toolResults.push({ name, ok: false, error: "I cannot execute that yet." });
      continue;
    }

    const fn = AXIOM_ASSISTANT_TOOLS[name];

    const isDestructive = isDestructiveToolCall(name, args);
    const safeArgs =
      isDestructive && !hasConfirmApply ? forceDryRunArgs(args) : args;

    try {
      const result = await fn(ctx, safeArgs);
      toolResults.push({
        name,
        ok: result.ok,
        data: result.data,
        error: result.error,
      });
    } catch (e) {
      toolResults.push({
        name,
        ok: false,
        error: e instanceof Error ? e.message : "Tool execution failed",
      });
    }
  }

  const toolResultsSummary = toolResults.map((r) => {
    if (r.ok) return `${r.name}: success`;
    return `${r.name}: ${r.error ?? "failed"}`;
  });

  /** Format structured result for chat display when runExecutionPlugin succeeds. */
  function formatPluginResultForChat(r: { name: string; ok: boolean; data?: unknown }): string | null {
    if (r.name !== "runExecutionPlugin" || !r.ok || !r.data || typeof r.data !== "object") return null;
    const d = r.data as Record<string, unknown>;
    const summary = d.resultSummary as string | undefined;
    if (summary) return summary;
    const findings = d.findings as Array<unknown> | undefined;
    const ec2Count = d.ec2Count as number | undefined;
    const s3Count = d.s3Count as number | undefined;
    if (Array.isArray(findings) && findings.length > 0) {
      return `Found ${findings.length} IAM finding(s). Review the Timeline for details.`;
    }
    if (typeof ec2Count === "number" || typeof s3Count === "number") {
      const parts: string[] = [];
      if (ec2Count != null) parts.push(`${ec2Count} EC2`);
      if (s3Count != null) parts.push(`${s3Count} S3`);
      if (d.rdsCount != null) parts.push(`${d.rdsCount} RDS`);
      if (d.vpcCount != null) parts.push(`${d.vpcCount} VPC`);
      return `Discovery complete: ${parts.join(", ")}. Architecture graph updated.`;
    }
    return null;
  }

  const structuredResultParts = toolResults
    .map(formatPluginResultForChat)
    .filter((s): s is string => Boolean(s));

  const anyToolSucceeded = toolResults.some((r) => r.ok);
  const allRejectedAsUnknown =
    toolCalls.length > 0 &&
    toolResults.every((r) => !r.ok && r.error === "I cannot execute that yet.");

  let finalMessage = assistantMessage;
  if (workflowResult?.blockedByPrerequisites) {
    finalMessage =
      assistantMessage +
      "\n\n---\n" +
      workflowResult.summary +
      "\n\n**Actions available:**\n- Connect AWS\n- Open Connectors";
  } else if (workflowResult && workflowResult.executedSteps.length > 0) {
    const wr = workflowResult;
    const resultLines = wr.executedSteps
      .filter((s) => s.ok && s.summary)
      .map((s) => `- ${s.pluginId ?? s.action}: ${s.summary}`)
      .join("\n");
    const failedLine = wr.executedSteps.find((s) => !s.ok);
    const workflowBlock =
      "\n\n---\n**Workflow results**\n" +
      (resultLines || "No results yet.") +
      (failedLine ? `\n- ${failedLine.pluginId ?? failedLine.action}: ${failedLine.error ?? "failed"}` : "") +
      (wr.confirmationPrompt ? `\n\n${wr.confirmationPrompt}` : "");
    finalMessage = assistantMessage + workflowBlock;
  } else if (allRejectedAsUnknown) {
    finalMessage = "I cannot execute that yet.";
  } else if (toolCalls.length > 0 && anyToolSucceeded && structuredResultParts.length > 0) {
    finalMessage =
      assistantMessage +
      "\n\n---\n**Results**\n" +
      structuredResultParts.map((p) => `- ${p}`).join("\n");
  } else if (toolCalls.length > 0 && !anyToolSucceeded) {
    // Tools were attempted but all failed — do not let message claim success
    if (
      /\b(I\s+(ran|executed|completed|successfully)\b|successfully\s+(ran|executed|completed))/i.test(
        assistantMessage
      )
    ) {
      finalMessage =
        assistantMessage +
        "\n\n**Note:** Some actions did not complete successfully. See the results above.";
    }
  }

  const AWS_PLUGIN_IDS = new Set(["aws:iam-exposure-scan", "aws:disable-unused-access-key", "aws:infra-discovery", "aws:cost-explorer-summary", "aws:s3-public-bucket-scan"]);
  function requestRequiresAws(): boolean {
    const intent = mapIntentToPlugin(message);
    if (intent?.pluginId && AWS_PLUGIN_IDS.has(intent.pluginId)) return true;
    const steps = plan?.steps ?? [];
    if (steps.some((s) => s.action === "run_plugin" && s.pluginId && AWS_PLUGIN_IDS.has(s.pluginId))) return true;
    const multiStep = getMultiStepIntent(message);
    if (multiStep?.some((id) => AWS_PLUGIN_IDS.has(id))) return true;
    for (const tc of toolCalls) {
      if (tc.name === "runExecutionPlugin") {
        const pluginId = String((tc.arguments ?? {}).pluginId ?? "").trim();
        if (AWS_PLUGIN_IDS.has(pluginId)) return true;
      }
    }
    return false;
  }

  let finalActions = actions;
  if (workflowResult?.blockedByPrerequisites) {
    finalActions = [
      { type: "connect_aws" as const },
      { type: "open_connectors" as const },
    ];
  } else if (!axiomContext.connectors.aws && requestRequiresAws() && actions.length === 0) {
    finalMessage = finalMessage.replace(
      /(\*\*4\)\s*Actions I can run now\*\*)[\s\S]*?(?=\n\*\*5\)|$)/i,
      "$1\n\nI cannot run AWS analysis yet because your AWS account is not connected."
    );
    finalActions = [
      { type: "connect_aws" as const },
      { type: "open_connectors" as const },
      { type: "learn_connect_aws" as const },
    ];
  }

  await appendMessage(conversationId, {
    role: "assistant",
    content: finalMessage,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    toolResults: toolResults.length > 0 ? toolResults : undefined,
  });

  return {
    assistantMessage: finalMessage,
    toolResultsSummary: toolResultsSummary.length > 0 ? toolResultsSummary : undefined,
    actions: finalActions.length > 0 ? finalActions : undefined,
    plan: plan ?? undefined,
    requiresApproval: plan ? true : undefined,
  };
}

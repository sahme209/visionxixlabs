/**
 * Contact Resolution Agent — autonomous resolution of contact form submissions.
 * Uses AI to understand, gather info, execute actions, verify, and respond.
 * Escalates only when truly required.
 */

import { prisma } from "@/lib/db";
import { generate } from "@/lib/ai/orchestrator";
import {
  createLeadTicket,
  askFollowupQuestions,
  runAxiomScan,
  runExecutionPlugin,
  generateReportAndSend,
  scheduleOrEscalate,
  sendResolutionEmail,
} from "./contactResolutionTools";
import { logAudit } from "@/lib/security/auditLog";

export type ResolutionStatus = "RESOLVED" | "NEEDS_INFO" | "ESCALATED";

export type ContactResolutionInput = {
  leadId: string;
  name: string;
  email: string;
  company?: string;
  topic?: string;
  message: string;
};

export type ContactResolutionOutput = {
  status: ResolutionStatus;
  userReplyEmail?: string;
  actionsTaken: string[];
  nextQuestions?: string[];
  evidenceLinks?: string[];
  executionLogIds?: string[];
};

const RESOLUTION_SCHEMA = `
Output valid JSON only, no markdown. Schema:
{
  "status": "RESOLVED" | "NEEDS_INFO" | "ESCALATED",
  "userReplyEmail": "string - email body to send user",
  "actionsTaken": ["string"],
  "nextQuestions": ["string"] | null,
  "evidenceLinks": ["string"] | null,
  "executionLogIds": ["string"] | null,
  "toolCalls": [
    { "tool": "createLeadTicket" | "askFollowupQuestions" | "runAxiomScan" | "runExecutionPlugin" | "generateReportAndSend" | "scheduleOrEscalate", "params": {...} }
  ]
}`;

export async function runContactResolutionAgent(input: ContactResolutionInput): Promise<ContactResolutionOutput> {
  const { leadId, name, email, company, topic, message } = input;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return { status: "ESCALATED", actionsTaken: ["Lead not found"] };
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const connectorStatus = (payload.connectors as Record<string, { status?: string }>) || {};
  const awsLinked = connectorStatus.aws?.status === "linked";
  const isCloudOperator = lead.source === "cloud-operator";

  const systemPrompt = `You are the Contact Resolution Agent for Vision XIX Labs. Your job is to autonomously resolve contact form submissions.

Rules:
- RESOLVED: you took real actions, verified results, and can send a complete reply.
- NEEDS_INFO: you need specific info (roleArn, externalId, etc.) before you can proceed. Ask concise questions.
- ESCALATE only when: missing permissions after 2 follow-ups, enterprise custom pricing, repeated execution failure, or truly ambiguous.

Available tools (output in toolCalls; we execute them):
- createLeadTicket(leadId, summary, category, priority): log internal ticket
- askFollowupQuestions(leadId, questions[], context?): email user asking for missing info
- runAxiomScan(leadId): trigger cloud-operator analysis (requires cloud-operator lead)
- runExecutionPlugin(leadId, pluginId, input, dryRun): run e.g. aws:iam-readonly-scan (requires linked AWS)
- generateReportAndSend(leadId, "executive"): send Axiom executive summary (requires cloud-operator lead with axiomResult)
- scheduleOrEscalate(leadId, reason): escalate to human

Context for this lead:
- source: ${lead.source}
- AWS linked: ${awsLinked}
- Has operator output: ${!!payload.operatorOutput}
- Prior follow-ups: ${(payload.agentFollowUps as unknown[])?.length ?? 0}
${RESOLUTION_SCHEMA}`;

  const userPrompt = `Contact submission:
Name: ${name}
Email: ${email}
Company: ${company || "—"}
Topic: ${topic || "—"}

Message:
${message}

Decide status, toolCalls to execute, and userReplyEmail. Be truthful: do not claim actions you did not perform.`;

  let output: ContactResolutionOutput = {
    status: "ESCALATED",
    actionsTaken: [],
  };

  try {
    const res = await generate({
      taskType: "TOOL_CALLING",
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
      temperature: 0.3,
      responseFormat: "json",
    });

    let parsed: {
      status?: string;
      userReplyEmail?: string;
      actionsTaken?: string[];
      nextQuestions?: string[];
      evidenceLinks?: string[];
      executionLogIds?: string[];
      toolCalls?: Array<{ tool: string; params?: Record<string, unknown> }>;
    };

    try {
      const raw = res.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(raw);
    } catch {
      output.actionsTaken.push("AI response was not valid JSON");
      await logAudit({ leadId, action: "agent_parse_error", actor: "system" });
      return output;
    }

    const status = (parsed.status ?? "ESCALATED") as ResolutionStatus;
    if (!["RESOLVED", "NEEDS_INFO", "ESCALATED"].includes(status)) {
      output.status = "ESCALATED";
    } else {
      output.status = status;
    }
    output.userReplyEmail = parsed.userReplyEmail;
    output.actionsTaken = parsed.actionsTaken ?? [];
    output.nextQuestions = parsed.nextQuestions ?? undefined;
    output.evidenceLinks = parsed.evidenceLinks ?? undefined;
    output.executionLogIds = parsed.executionLogIds ?? [];

    const toolCalls = parsed.toolCalls ?? [];
    const execIds: string[] = [];

    for (const tc of toolCalls) {
      const t = String(tc.tool || "");
      const params = (tc.params || {}) as Record<string, unknown>;

      try {
        if (t === "createLeadTicket") {
          const r = await createLeadTicket(
            leadId,
            String(params.summary ?? ""),
            String(params.category ?? "general"),
            String(params.priority ?? "medium")
          );
          if (r.ok) output.actionsTaken.push(`Created ticket: ${params.summary}`);
          else output.actionsTaken.push(`Ticket failed: ${r.message}`);
        } else if (t === "askFollowupQuestions") {
          const qs = Array.isArray(params.questions) ? params.questions.map(String) : [];
          const r = await askFollowupQuestions(leadId, qs, params.context as string | undefined);
          if (r.ok) output.actionsTaken.push(`Sent ${qs.length} follow-up question(s)`);
          else output.actionsTaken.push(`Follow-up failed: ${r.message}`);
        } else if (t === "runAxiomScan") {
          const r = await runAxiomScan(leadId, params.scanType as string | undefined);
          if (r.ok) output.actionsTaken.push("Triggered Axiom scan");
          else output.actionsTaken.push(`Axiom scan: ${r.message}`);
        } else if (t === "runExecutionPlugin") {
          const r = await runExecutionPlugin(
            leadId,
            String(params.pluginId ?? "aws:iam-readonly-scan"),
            (params.input as Record<string, unknown>) || {},
            params.dryRun !== false
          );
          if (r.ok) {
            output.actionsTaken.push(`Ran plugin: ${params.pluginId}`);
            if ((r.data as { executionId?: string })?.executionId) {
              execIds.push((r.data as { executionId: string }).executionId);
            }
          } else {
            output.actionsTaken.push(`Plugin failed: ${r.message}`);
          }
        } else if (t === "generateReportAndSend") {
          const r = await generateReportAndSend(leadId, String(params.templateType ?? "executive"));
          if (r.ok) output.actionsTaken.push("Sent executive report");
          else output.actionsTaken.push(`Report failed: ${r.message}`);
        } else if (t === "scheduleOrEscalate") {
          const r = await scheduleOrEscalate(leadId, String(params.reason ?? "Agent could not resolve"));
          if (r.ok) output.actionsTaken.push(`Escalated: ${params.reason}`);
        }
      } catch (e) {
        output.actionsTaken.push(`Tool ${t} error: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    if (execIds.length > 0) {
      output.executionLogIds = [...(output.executionLogIds ?? []), ...execIds];
    }

    if (output.userReplyEmail && output.status !== "ESCALATED") {
      const subject = output.status === "RESOLVED"
        ? "Vision XIX Labs — Your request has been resolved"
        : "Vision XIX Labs — Quick follow-up";
      await sendResolutionEmail(leadId, subject, output.userReplyEmail, output.actionsTaken);
    }

    return output;
  } catch (e) {
    output.actionsTaken.push(`Agent error: ${e instanceof Error ? e.message : "Unknown"}`);
    await logAudit({ leadId, action: "agent_error", actor: "system", metadata: { error: String(e) } });
    return output;
  }
}

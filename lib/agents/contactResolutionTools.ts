/**
 * Contact Resolution Agent — real server-side tools.
 * All tools are executed in trusted context (worker).
 */

import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { executePlugin } from "@/lib/execution/pluginEngine";
import { createStarterToken } from "@/lib/starterToken";
import { logAudit } from "@/lib/security/auditLog";
import { executiveSummaryEmail } from "@/lib/axiom/emailTemplates";

const SYSTEM_USER_ID = process.env.CONTACT_AGENT_USER_ID || "system-contact-agent";

export type ToolResult = { ok: boolean; message?: string; data?: Record<string, unknown> };

export async function createLeadTicket(
  leadId: string,
  summary: string,
  category: string,
  priority: string
): Promise<ToolResult> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { ok: false, message: "Lead not found" };
    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const tickets = (payload.agentTickets as Array<Record<string, unknown>>) || [];
    tickets.push({
      summary,
      category,
      priority,
      createdAt: new Date().toISOString(),
    });
    await prisma.lead.update({
      where: { id: leadId },
      data: { fullPayload: { ...payload, agentTickets: tickets } as object },
    });
    await logAudit({ leadId, action: "agent_ticket_created", actor: "system", metadata: { category, priority } });
    return { ok: true, data: { ticketCount: tickets.length } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed" };
  }
}

export async function askFollowupQuestions(
  leadId: string,
  questions: string[],
  context?: string
): Promise<ToolResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, message: "Email not configured" };
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { ok: false, message: "Lead not found" };
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const qList = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
    const body = context
      ? `${context}\n\nWe need a few details:\n\n${qList}\n\nPlease reply to this email with your answers.`
      : `We need a few details to proceed:\n\n${qList}\n\nPlease reply to this email with your answers.`;
    await resend.emails.send({
      from: from.includes("<") ? from : `Vision XIX Labs <${from}>`,
      to: lead.email,
      subject: "Vision XIX Labs — Quick follow-up",
      text: body,
      html: `<p>${body.replace(/\n/g, "</p><p>")}</p>`,
    });
    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const followUps = (payload.agentFollowUps as Array<{ questions: string[]; sentAt: string }>) || [];
    followUps.push({ questions, sentAt: new Date().toISOString() });
    await prisma.lead.update({
      where: { id: leadId },
      data: { fullPayload: { ...payload, agentFollowUps: followUps } as object },
    });
    await logAudit({ leadId, action: "agent_followup_sent", actor: "system", metadata: { questionCount: questions.length } });
    return { ok: true, data: { questionsSent: questions.length } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to send" };
  }
}

export async function runAxiomScan(leadId: string, _scanType?: string): Promise<ToolResult> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.source !== "cloud-operator") {
      return { ok: false, message: "Lead must complete cloud-operator flow first. Direct them to /cloud-operator." };
    }
    const token = createStarterToken(leadId);
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/cloud-operator/trigger?token=${encodeURIComponent(token)}`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.error || "Trigger failed" };
    return { ok: true, data: { status: data.status || "triggered" } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Trigger failed" };
  }
}

export async function runExecutionPlugin(
  leadId: string,
  pluginId: string,
  input: Record<string, unknown>,
  dryRun: boolean
): Promise<ToolResult> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { ok: false, message: "Lead not found" };
    const userId = lead.userId || SYSTEM_USER_ID;
    const result = await executePlugin({
      pluginId,
      input,
      ctx: {
        userId,
        leadId,
        dryRun,
        userPlan: lead.userId ? (await prisma.user.findUnique({ where: { id: lead.userId }, select: { plan: true } }))?.plan ?? null : null,
        credentialsKey: leadId,
      },
      skipEntitlementCheck: true,
    });
    return {
      ok: result.status === "success",
      data: {
        executionId: result.executionId,
        status: result.status,
        summary: result.resultSummary,
        error: result.error,
      },
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Plugin execution failed" };
  }
}

export async function linkConnector(
  _leadId: string,
  _connectorType: string,
  _payload: Record<string, unknown>
): Promise<ToolResult> {
  return { ok: false, message: "Connector linking requires user interaction. Direct user to Connectors tab with their token." };
}

export async function generateReportAndSend(leadId: string, templateType: string): Promise<ToolResult> {
  if (templateType !== "executive") {
    return { ok: false, message: "Only executive template supported" };
  }
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.source !== "cloud-operator") {
      return { ok: false, message: "Report requires cloud-operator lead" };
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: false, message: "Email not configured" };
    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const axiomResult = payload.axiomResult as Record<string, unknown> | undefined;
    const scores = (axiomResult?.scores as Record<string, unknown>) || {};
    const operatorOutput = payload.operatorOutput as { business?: { recommendedNextAction?: string } } | undefined;
    const emailContent = executiveSummaryEmail({
      infrastructureScore: (scores.infrastructureScore as number) ?? null,
      savingsDelta: null,
      riskDelta: null,
      driftDetected: false,
      topAction: operatorOutput?.business?.recommendedNextAction ?? "Review your 30-day roadmap.",
    });
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM || "Axiom <onboarding@resend.dev>";
    const { error } = await resend.emails.send({
      from,
      to: lead.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
    if (error) return { ok: false, message: "Failed to send email" };
    await logAudit({ leadId, action: "agent_report_sent", actor: "system" });
    return { ok: true, data: { template: templateType } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed" };
  }
}

export async function scheduleOrEscalate(leadId: string, reason: string): Promise<ToolResult> {
  try {
    const payload = (await prisma.lead.findUnique({ where: { id: leadId }, select: { fullPayload: true } }))?.fullPayload as Record<string, unknown> || {};
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        fullPayload: {
          ...payload,
          agentEscalation: { reason, escalatedAt: new Date().toISOString() },
        } as object,
      },
    });
    await logAudit({ leadId, action: "agent_escalated", actor: "system", metadata: { reason } });
    return { ok: true, data: { escalated: true, reason } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed" };
  }
}

export async function sendResolutionEmail(
  leadId: string,
  subject: string,
  body: string,
  actionsTaken: string[]
): Promise<ToolResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, message: "Email not configured" };
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { ok: false, message: "Lead not found" };
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM || "onboarding@resend.dev";
    const actionsSection = actionsTaken.length > 0
      ? `\n\nActions we took:\n${actionsTaken.map((a) => `• ${a}`).join("\n")}`
      : "";
    const fullBody = `${body}${actionsSection}\n\n— Vision XIX Labs`;
    await resend.emails.send({
      from: from.includes("<") ? from : `Vision XIX Labs <${from}>`,
      to: lead.email,
      subject,
      text: fullBody,
      html: `<p>${fullBody.replace(/\n/g, "</p><p>")}</p>`,
    });
    const p = (lead.fullPayload as Record<string, unknown>) || {};
    const sent = (p.agentEmailsSent as Array<{ subject: string; sentAt: string }>) || [];
    sent.push({ subject, sentAt: new Date().toISOString() });
    await prisma.lead.update({
      where: { id: leadId },
      data: { fullPayload: { ...p, agentEmailsSent: sent } as object },
    });
    return { ok: true, data: { subject } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to send" };
  }
}

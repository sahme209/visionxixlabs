/**
 * Reads recent company activity for the founder console from V19's records across all workspaces.
 * Founder-only: callers must have passed the founder gate. Each source is read on its own and a
 * source that cannot be read is listed as unavailable rather than guessed. Events carry no customer
 * content (no emails, messages, repository names or targets).
 */
import "server-only";
import { prisma } from "@/lib/db";
import { ACTIVITY_SIGNAL, mergeActivity, type ActivityEvent, type ActivityKind } from "./activity";
import type { StatusTone } from "@/lib/cockpit/statusTone";

const DAY = 86_400_000;
const PER_SOURCE = 40;
const FAILED = new Set(["failure", "timed_out", "startup_failure", "cancelled"]);

function ev(kind: ActivityKind, sourceId: string, at: Date, title: string, detail: string, tone: StatusTone): ActivityEvent {
  return { id: `${kind}:${sourceId}`, kind, at: at.toISOString(), signal: ACTIVITY_SIGNAL[kind], title, detail, tone };
}

export interface FounderActivity { events: ActivityEvent[]; unavailable: string[]; readAt: string }

/** Activity since `since` (default: the last 7 days), newest first, at most 200 events. */
export async function readFounderActivity(since?: Date, now = new Date()): Promise<FounderActivity> {
  const floor = new Date(now.getTime() - 7 * DAY);
  const from = since && since > floor ? since : floor;
  const unavailable: string[] = [];
  const read = async (name: string, fn: () => Promise<ActivityEvent[]>) => { try { return await fn(); } catch { unavailable.push(name); return []; } };

  const sources = await Promise.all([
    read("workspaces", async () => (await prisma.orgMembership.findMany({ where: { role: "owner", createdAt: { gte: from } }, orderBy: { createdAt: "desc" }, take: PER_SOURCE, select: { id: true, createdAt: true } }))
      .map((m) => ev("workspace_created", m.id, m.createdAt, "New workspace", "Someone signed up and created a workspace.", "success"))),
    read("leads", async () => (await prisma.lead.findMany({ where: { createdAt: { gte: from } }, orderBy: { createdAt: "desc" }, take: PER_SOURCE, select: { id: true, createdAt: true, source: true } }))
      .map((l) => ev("lead_received", l.id, l.createdAt, "New lead", `From ${l.source.replaceAll("_", " ").slice(0, 40)}.`, "running"))),
    read("feedback", async () => (await prisma.feedbackRecord.findMany({ where: { createdAt: { gte: from } }, orderBy: { createdAt: "desc" }, take: PER_SOURCE, select: { id: true, createdAt: true, sentiment: true } }))
      .map((f) => ev("feedback_received", f.id, f.createdAt, "Feedback received", `Sentiment: ${f.sentiment.slice(0, 20)}.`, f.sentiment === "negative" ? "attention" : "running"))),
    read("deployments", async () => {
      const rows = await prisma.deploymentExecution.findMany({ where: { OR: [{ createdAt: { gte: from } }, { completedAt: { gte: from } }] }, orderBy: { updatedAt: "desc" }, take: PER_SOURCE, select: { id: true, createdAt: true, completedAt: true, status: true, conclusion: true, source: true } });
      const out: ActivityEvent[] = [];
      for (const d of rows) {
        if (d.createdAt >= from) out.push(ev("deployment_started", d.id, d.createdAt, "Deployment started", d.source === "agent" ? "Started by an agent." : "Started from the desktop app.", "running"));
        if (d.completedAt && d.completedAt >= from && d.status === "completed") {
          const failed = d.conclusion ? FAILED.has(d.conclusion) : false;
          out.push(failed ? ev("deployment_failed", d.id, d.completedAt, "Deployment failed", `Ended: ${(d.conclusion ?? "failed").replaceAll("_", " ")}.`, "failed")
            : ev("deployment_succeeded", d.id, d.completedAt, "Deployment succeeded", "Finished and recorded.", "success"));
        }
      }
      return out;
    }),
    read("incidents", async () => {
      const rows = await prisma.deploymentIncident.findMany({ where: { OR: [{ reportedAt: { gte: from } }, { resolvedAt: { gte: from } }] }, orderBy: { updatedAt: "desc" }, take: PER_SOURCE, select: { id: true, reportedAt: true, resolvedAt: true, severity: true } });
      const out: ActivityEvent[] = [];
      for (const i of rows) {
        if (i.reportedAt >= from) out.push(ev("incident_opened", i.id, i.reportedAt, "Incident opened", `Severity ${i.severity.slice(0, 12)}.`, "failed"));
        if (i.resolvedAt && i.resolvedAt >= from) out.push(ev("incident_resolved", i.id, i.resolvedAt, "Incident resolved", `Severity ${i.severity.slice(0, 12)}.`, "success"));
      }
      return out;
    }),
    read("freezes", async () => (await prisma.auditEvent.findMany({ where: { kind: { in: ["environment.freeze", "environment.freeze_end"] }, createdAt: { gte: from } }, orderBy: { createdAt: "desc" }, take: PER_SOURCE, select: { id: true, kind: true, createdAt: true } }))
      .map((a) => a.kind === "environment.freeze" ? ev("freeze_started", a.id, a.createdAt, "Deployments frozen", "A team froze deployments.", "attention") : ev("freeze_ended", a.id, a.createdAt, "Freeze ended", "Deployments can go out again.", "success"))),
    read("agent requests", async () => {
      const rows = await prisma.agentGatewayRequest.findMany({ where: { OR: [{ createdAt: { gte: from } }, { decidedAt: { gte: from } }] }, orderBy: { updatedAt: "desc" }, take: PER_SOURCE, select: { id: true, createdAt: true, decidedAt: true, status: true, actionKind: true, riskLevel: true } });
      const out: ActivityEvent[] = [];
      for (const r of rows) {
        const action = r.actionKind.replaceAll("_", " ").slice(0, 40);
        if (r.createdAt >= from) out.push(ev("agent_request", r.id, r.createdAt, "Agent asked to act", `${action}, ${r.riskLevel.slice(0, 12)} risk.`, r.status === "pending" ? "attention" : "running"));
        if (r.decidedAt && r.decidedAt >= from) out.push(ev("agent_request_decided", r.id, r.decidedAt, r.status === "approved" ? "Agent action approved" : "Agent action decided", `${action}: ${r.status.replaceAll("_", " ").slice(0, 20)}.`, r.status === "approved" ? "success" : "idle"));
      }
      return out;
    }),
    read("webhooks", async () => (await prisma.webhookDelivery.findMany({ where: { status: "deadletter", eventKind: { not: "webhook.ping" }, createdAt: { gte: from } }, orderBy: { createdAt: "desc" }, take: PER_SOURCE, select: { id: true, createdAt: true, eventKind: true } }))
      .map((w) => ev("webhook_given_up", w.id, w.createdAt, "Webhook delivery given up", `${w.eventKind.slice(0, 60)} could not be delivered.`, "failed"))),
  ]);

  return { events: mergeActivity([], sources.flat()), unavailable, readAt: now.toISOString() };
}

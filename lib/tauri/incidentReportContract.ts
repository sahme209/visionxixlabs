import {z} from "zod";
import {ticketLinkId} from "./ticketDirectoryContract";

const identity = z.string().min(1).max(240);
const scope = {workspaceId: identity, actorId: identity};

export function canReportDeploymentIncident(role: string | null | undefined) {
  return role === "owner" || role === "admin" || role === "operator" || role === "security_reviewer";
}

export const incidentReportSeverities = ["low", "medium", "high", "critical"] as const;
export const incidentReportRequest = z.object({
  ...scope,
  attemptId: z.string().uuid(),
  releaseId: ticketLinkId,
  severity: z.enum(incidentReportSeverities),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(600),
}).strict();
export type IncidentReportRequest = z.infer<typeof incidentReportRequest>;

export const incidentReportReleases = z.object({
  ...scope,
  releases: z.array(z.object({id: ticketLinkId, tag: z.string().max(120).nullable()}).strict()).max(80),
}).strict();

export const incidentReportReceipt = z.object({
  ...scope,
  attemptId: z.string().uuid(),
  releaseId: ticketLinkId,
  incidentId: ticketLinkId,
}).strict();

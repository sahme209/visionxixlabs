import {z} from "zod";
import {INCIDENT_STATUSES, INCIDENT_TRANSITIONS, planTransition} from "../releaseops/deploymentIncidentLifecycle";
import {ticketLinkId} from "./ticketDirectoryContract";

export function canChangeIncidentStatus(role: string | null | undefined) {
  return role === "owner" || role === "admin" || role === "operator";
}

const instant = z.string().datetime();
const identity = z.string().min(1).max(240);
const incidentStatus = z.enum(INCIDENT_STATUSES);

export const incidentTransitionRequest = z.object({
  workspaceId: identity, actorId: identity, incidentId: ticketLinkId, releaseId: ticketLinkId,
  expectedRevision: instant, previousStatus: incidentStatus, action: z.enum(INCIDENT_TRANSITIONS),
  attemptId: z.string().uuid(),
}).strict();
export const incidentTransitionReceipt = incidentTransitionRequest.extend({
  status: incidentStatus, revision: instant,
}).strict().refine(receipt => {
  const plan = planTransition(receipt.previousStatus, receipt.action, {actorUserId: receipt.actorId, now: new Date(receipt.revision)});
  return plan.ok && plan.next === receipt.status && Date.parse(receipt.revision) > Date.parse(receipt.expectedRevision);
});

export type IncidentTransitionRequest = z.infer<typeof incidentTransitionRequest>;
export type IncidentTransitionReceipt = z.infer<typeof incidentTransitionReceipt>;

export function matchesIncidentTransition(receipt: IncidentTransitionReceipt, request: IncidentTransitionRequest) {
  return receipt.workspaceId === request.workspaceId && receipt.actorId === request.actorId &&
    receipt.incidentId === request.incidentId && receipt.releaseId === request.releaseId &&
    receipt.previousStatus === request.previousStatus && receipt.expectedRevision === request.expectedRevision &&
    receipt.action === request.action && receipt.attemptId === request.attemptId;
}

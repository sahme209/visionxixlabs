import {z} from "zod";
import {ticketLinkId} from "./ticketDirectoryContract";

export const incidentUpdateLimit = 20;
const scope = {
  workspaceId: z.string().min(1).max(240),
  actorId: z.string().min(1).max(240),
  incidentId: ticketLinkId,
  releaseId: ticketLinkId,
};
const body = z.string().trim().min(1).max(1200).refine(value => !value.includes("\0"));
const evidenceIdentity = z.object({
  commit: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/i),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const incidentUpdateEvidence = evidenceIdentity.extend({
  generatedAt: z.string().datetime(),
  branchCheckCount: z.number().int().nonnegative(),
  changeTicketCount: z.number().int().nonnegative(),
}).strict();
export type IncidentUpdateEvidence = z.infer<typeof incidentUpdateEvidence>;
const note = z.object({
  id: ticketLinkId,
  body,
  recordedAt: z.string().datetime(),
  authoredByYou: z.boolean(),
  evidence: incidentUpdateEvidence.optional(),
}).strict();

export const incidentUpdateRequest = z.object({...scope, attemptId: z.string().uuid(), body, evidence: evidenceIdentity.strict().optional()}).strict();
export const incidentUpdateList = z.object({
  ...scope, canWrite: z.boolean(), attachableEvidence: incidentUpdateEvidence.nullable().optional(), limited: z.boolean(), notes: z.array(note).max(incidentUpdateLimit),
}).strict();
export const incidentUpdateReceipt = z.object({...scope, attemptId: z.string().uuid(), note}).strict();

export type IncidentUpdateRequest = z.infer<typeof incidentUpdateRequest>;
export type IncidentUpdateList = z.infer<typeof incidentUpdateList>;
export type IncidentUpdateReceipt = z.infer<typeof incidentUpdateReceipt>;

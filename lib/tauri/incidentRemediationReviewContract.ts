import {z} from "zod";
import {ticketLinkId} from "./ticketDirectoryContract";

export const remediationReviewBinding = z.object({
  incidentRevision: z.string().datetime(),
  applicationId: ticketLinkId,
  environmentId: ticketLinkId,
  commit: z.string().regex(/^[0-9a-f]{40}([0-9a-f]{24})?$/i),
}).strict();

export const incidentRemediationReviewSchema = z.object({
  workspaceId: z.string().min(1).max(240), actorId: z.string().min(1).max(240),
  incidentId: ticketLinkId, releaseId: ticketLinkId, incidentRevision: z.string().datetime(),
  proposal: z.object({
    id: ticketLinkId, title: z.string().min(1).max(160), generatedAt: z.string().datetime(),
    decision: z.enum(["pending","accepted","rejected","implemented","dismissed","superseded"]),
    decidedAt: z.string().datetime().nullable(), binding: z.enum(["current","historical"]),
  }).strict().nullable(),
}).strict();

export type IncidentRemediationReview = z.infer<typeof incidentRemediationReviewSchema>;
export type IncidentRemediationBinding = z.infer<typeof remediationReviewBinding>;

import {z} from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
const actor = z.string().min(1).max(240);
const instant = z.string().datetime();
export const assignmentCandidate = z.object({userId:actor,displayName:z.string().min(1).max(120)}).strict();
export const incidentOwner = z.discriminatedUnion("state",[
  z.object({state:z.literal("assigned"),...assignmentCandidate.shape}).strict(),
  z.object({state:z.literal("unassigned")}).strict(),
  z.object({state:z.literal("unavailable")}).strict(),
]);
export type IncidentOwner = z.infer<typeof incidentOwner>;
const scope = {workspaceId:actor,actorId:actor,incidentId:id,releaseId:id,incidentRevision:instant};
export const incidentAssignmentOptions = z.object({
  ...scope,assignmentRevision:instant.nullable(),candidates:z.array(assignmentCandidate).max(100),limited:z.boolean(),
}).strict();
export const incidentAssignmentRequest = z.object({
  ...scope,expectedAssignmentRevision:instant.nullable(),ownerUserId:actor.nullable(),attemptId:z.string().uuid(),
}).strict();
export const incidentAssignmentReceipt = incidentAssignmentRequest.extend({assignmentRevision:instant}).strict();
export type IncidentAssignmentRequest = z.infer<typeof incidentAssignmentRequest>;
export type IncidentAssignmentReceipt = z.infer<typeof incidentAssignmentReceipt>;
export function matchesAssignment(receipt:IncidentAssignmentReceipt, request:IncidentAssignmentRequest) {
  const fields = incidentAssignmentRequest.strip().parse(receipt);
  return (Object.keys(fields) as Array<keyof IncidentAssignmentRequest>).every(key => fields[key] === request[key]);
}

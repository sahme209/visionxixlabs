import {z} from "zod";
import {githubCommit, githubRepositoryName, incidentWorkflowRun} from "./incidentSourceEvidenceContract";
import {ticketLinkId} from "./ticketDirectoryContract";

const instant = z.string().datetime();
const scope = {incidentId:ticketLinkId, releaseId:ticketLinkId, incidentRevision:instant};
const actor = {workspaceId:z.string().min(1).max(240), actorId:z.string().min(1).max(240)};
const sources = {
  repository:githubRepositoryName, commit:githubCommit, baselineCommit:githubCommit,
  runId:incidentWorkflowRun.shape.runId, observedAt:instant,
};
export const incidentCollectionRequest = z.object({...scope,...actor,...sources,attemptId:z.string().uuid()}).strict();
export const incidentCollectionReceipt = incidentCollectionRequest.extend({recordedAt:instant,releaseRevision:instant}).strict();
export const incidentCollectionStatus = z.object({...scope,...actor,collectedAt:instant.nullable()}).strict();
export type IncidentCollectionRequest = z.infer<typeof incidentCollectionRequest>;
export type IncidentCollectionReceipt = z.infer<typeof incidentCollectionReceipt>;

export function sameCollection(receipt: IncidentCollectionReceipt, request: IncidentCollectionRequest) {
  const read = incidentCollectionRequest.strip().parse(receipt);
  return (Object.keys(read) as Array<keyof IncidentCollectionRequest>).every(key => read[key] === request[key]);
}

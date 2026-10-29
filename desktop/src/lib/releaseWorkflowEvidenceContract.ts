import {parseReleaseWorkflowEvidenceResponse,type ReleaseWorkflowEvidenceResponse} from '../../../lib/tauri/releaseWorkflowEvidenceContract';
export type {ReleaseWorkflowEvidenceResponse};
export function isReleaseWorkflowEvidenceResponse(value:unknown,requestId:string,planId:string,digest:string):value is ReleaseWorkflowEvidenceResponse {
 try {
  const response=parseReleaseWorkflowEvidenceResponse(value);
  return new Set(response.evidence.map(row=>row.id)).size===response.evidence.length&&response.evidence.every(row=>row.binding.releaseId===requestId&&row.binding.planId===planId&&row.binding.planDigest===digest);
 } catch {return false}
}

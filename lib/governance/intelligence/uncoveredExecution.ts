import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {createGovernanceRequestService} from './requestService';
import type {RevisionScope} from './revisionStore';

/** A refusal fence, never policy admission or a coverage registration. An
 * uncovered server executor cannot safely map every enrolled resource, so any
 * enrollment in this tenant blocks it. Reader authority is independently
 * verified, including while feature configuration is OFF. No source is read. */
export async function assertNoUncoveredGovernanceExecution(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:RevisionScope,parent:AbortSignal){
 const signal=AbortSignal.any([request.signal,parent,AbortSignal.timeout(15000)]);
 try{
  signal.throwIfAborted();
  const service=createGovernanceRequestService(request,repo as ReleaseOperationPlanRepo&AwsConnectionReadRepo,structuredClone(scope),()=>false);
  const enrolled=await withGithubAbort(service.hasAnyEnrollment(),signal);
  signal.throwIfAborted();
  if(enrolled!==false)throw Error();
 }catch{throw Error('governance_execution_coverage_unavailable')}
}

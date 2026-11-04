import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {RevisionScope} from './revisionStore';
import {createGovernanceRequestAuthority} from './requestAuthority';
import {createGovernanceExecutionPolicyRequestServiceCore} from './executionPolicyRequestServiceCore';
export function createGovernanceExecutionPolicyRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:RevisionScope,isEnabled:()=>boolean){return createGovernanceExecutionPolicyRequestServiceCore(request,repo,scope,isEnabled,createGovernanceRequestAuthority(request))}

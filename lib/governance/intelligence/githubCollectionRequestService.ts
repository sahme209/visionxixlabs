import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {EvidenceStoreScope} from './evidenceStore';
import {createGovernanceRequestAuthority} from './requestAuthority';
import {resolveReleaseInstallationToken} from '@/lib/connectors/github/githubAppAuth';
import {createGithubGovernanceCollectionRequestServiceCore} from './githubCollectionRequestServiceCore';
export function createGithubGovernanceCollectionRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:EvidenceStoreScope,isEnabled:()=>boolean,options:{revalidationOnly?:boolean}={}){return createGithubGovernanceCollectionRequestServiceCore(request,repo,scope,isEnabled,options,{authority:createGovernanceRequestAuthority(request),resolveToken:resolveReleaseInstallationToken,fetch,now:Date.now})}

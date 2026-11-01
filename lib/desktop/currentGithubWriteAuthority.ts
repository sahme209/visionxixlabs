import 'server-only';
import type {NextRequest} from 'next/server';
import {resolveRequestDesktopSession,type DesktopRequestPrincipal} from './resolveRequestDesktopSession';
import {assertNoGovernanceEnrollmentForMutation,type GovernanceEnrollmentMetadataRepo} from '@/lib/governance/intelligence/enrollmentMetadata';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
/** Current paired actor + unenrolled legacy authority only. This cannot issue
 * baseline admission, provider credentials or a Governance coverage receipt. */
export function createCurrentGithubWriteGuard(request:NextRequest,initial:DesktopRequestPrincipal,repo:GovernanceEnrollmentMetadataRepo){
 const bound={id:initial.id,userId:initial.userId,organizationId:initial.organizationId,credentialKind:initial.credentialKind};
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
 async function current(){
  signal.throwIfAborted();
  const actor=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'github:write',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'github mutation current authority'}),signal);
  if(bound.credentialKind!=='desktop_session'||!bound.id||!bound.userId||!bound.organizationId||!actor||actor.credentialKind!=='desktop_session'||actor.id!==bound.id||actor.userId!==bound.userId||actor.organizationId!==bound.organizationId||!actor.capabilities?.includes('github:write'))throw Error('github_write_authority_unavailable');
  signal.throwIfAborted();
 }
 return async()=>{await current();await assertNoGovernanceEnrollmentForMutation(repo,bound.organizationId,signal);await current()};
}

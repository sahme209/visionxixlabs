import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {identifier} from './contracts';
import type {RevisionScope} from './revisionStore';
import {createGovernanceRequestAuthority} from './requestAuthority';
import {readGovernanceEnrollmentMetadata} from './enrollmentMetadata';
import {readNativeGitCredentialLeaseBlockers} from './nativeGitCredentialLeaseStore';
const unavailable=()=>({status:'unavailable' as const,executionAuthorized:false as const,catalogQualification:'unavailable' as const,legacyQualification:'unavailable' as const});
/** Read-only prerequisite, never a coverage receipt. No reconstructable trusted
 * runtime catalog currently exists, so source classification stays unavailable.
 * Caller manifests, source paths and build hashes cannot qualify this result. */
export function createGovernanceReadinessService(request:NextRequest,repo:ReleaseOperationPlanRepo,rawScope:RevisionScope){
 const authority=createGovernanceRequestAuthority(request);
 return{async read(){try{
  const scope={organizationId:identifier.parse(rawScope.organizationId),actorUserId:identifier.parse(rawScope.actorUserId),sessionId:identifier.parse(rawScope.sessionId)};
  const deadline=Date.now()+15000,ready=()=>{request.signal.throwIfAborted();if(!Number.isFinite(Date.now())||Date.now()>=deadline)throw Error('governance_readiness_unavailable')};
  async function current(tx:Tx,org:string){ready();if(org!==scope.organizationId)throw Error('governance_readiness_unavailable');await authority(tx,scope,'reader');
   const rows=await tx.$queryRaw<Array<{expiresAt:Date;live:boolean}>>`SELECT "expiresAt",("revokedAt" IS NULL AND "expiresAt">clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${scope.sessionId} AND "organizationId"=${org} AND "userId"=${scope.actorUserId} FOR SHARE`;
   const expiry=rows[0]?.expiresAt?.getTime();if(rows.length!==1||rows[0].live!==true||!Number.isFinite(expiry))throw Error('governance_readiness_unavailable');
   const fresh=()=>{ready();if(Date.now()>=expiry)throw Error('governance_readiness_unavailable')};fresh();return fresh;
  }
  let finalFresh:(()=>void)|undefined;
  const metadata=await repo.$transaction(async tx=>{
   ready();await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(scope.organizationId)}))`;
   let fresh=await current(tx,scope.organizationId);
   const anyEnrollment=await readGovernanceEnrollmentMetadata(tx,scope.organizationId,request.signal);fresh();
   const {pendingCount,liveIssuedCount,expiredIssuedCount}=await readNativeGitCredentialLeaseBlockers(tx,scope.organizationId,{assertCurrent:current,signal:request.signal});
   fresh=await current(tx,scope.organizationId);fresh();finalFresh=fresh;
   return{anyEnrollment,pendingCount,liveIssuedCount,expiredIssuedCount};
  },{maxWait:15000,timeout:15000});
  if(!finalFresh)throw Error('governance_readiness_unavailable');finalFresh();return{...unavailable(),metadata};
 }catch{return unavailable()}}};
}

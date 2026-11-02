import 'server-only';
import type {NextRequest} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {currentContext} from '@/lib/auth/currentContext';
import {isSameOriginRequest} from '@/lib/auth/requestOrigin';
import {prisma} from '@/lib/db';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readGovernanceEnrollmentMetadata} from '@/lib/governance/intelligence/enrollmentMetadata';
import {readEnrollmentDrainBarrierLocked} from '@/lib/governance/intelligence/enrollmentDrainStore';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
const refuse=():never=>{throw Error('notification_mutation_unavailable')};
/** Existing browser administrator authority only. This refusal-only helper
 * never registers coverage or proves physical network/drain atomicity. */
export async function createWebNotificationMutationAuthority(request:NextRequest,repo:ReleaseOperationPlanRepo=prisma as unknown as ReleaseOperationPlanRepo){
 if(!isSameOriginRequest(request))refuse();
 const started=Date.now(),signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
 const ready=()=>{signal.throwIfAborted();const at=Date.now();if(!Number.isFinite(at)||!Number.isFinite(started)||at<started||at>=started+15000)refuse()};
 async function browser(){
  ready();const c=await withGithubAbort(currentContext(),signal),session=await withGithubAbort(getServerSession(authOptions),signal);ready();
  const user=session?.user as {id?:unknown}|undefined,expiresAt=Date.parse(session?.expires??'');
  if(!c.isAuthenticated||!c.organizationId||!c.userId||!c.sessionUserId||String(c.userId)!==String(c.sessionUserId)||user?.id!==String(c.userId)||!c.roles.some(role=>role==='owner'||role==='admin')||!Number.isFinite(expiresAt)||expiresAt<=Date.now())refuse();
  return {organizationId:String(c.organizationId),userId:String(c.userId),expiresAt};
 }
 const initial=Object.freeze(await browser());
 async function current(tx:ReleaseOperationPlanTransaction){
  const c=await browser();if(c.organizationId!==initial.organizationId||c.userId!==initial.userId)refuse();
  const rows=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${initial.organizationId} AND "userId"=${initial.userId} FOR SHARE`;
  const m=rows[0];if(rows.length!==1||!m||m.organizationId!==initial.organizationId||m.userId!==initial.userId||!['owner','admin'].includes(m.role)||!(m.acceptedAt instanceof Date)||!Number.isFinite(m.acceptedAt.getTime()))refuse();
  const expiry=Math.min(initial.expiresAt,c.expiresAt),fresh=()=>{ready();if(Date.now()>=expiry)refuse()};fresh();return fresh;
 }
 async function transaction<T>(work:(tx:ReleaseOperationPlanTransaction,assertAbsent:()=>Promise<void>)=>Promise<T>){
  ready();let finalFresh:(()=>void)|undefined;
  const result=await repo.$transaction(async tx=>{
   await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(initial.organizationId)}))`;
   let fresh=await current(tx);
   const assertAbsent=async()=>{ready();if(await readGovernanceEnrollmentMetadata(tx,initial.organizationId,signal)!==false)refuse();const barrier=await readEnrollmentDrainBarrierLocked(tx,initial.organizationId,signal);if(barrier!==null&&barrier.status!=='aborted')refuse();fresh();fresh=await current(tx);fresh()};
   const value=await work(tx,assertAbsent);fresh=await current(tx);fresh();finalFresh=fresh;return value;
  },{maxWait:5000,timeout:10000});
  if(!finalFresh)refuse();finalFresh!();return {value:result,assertFresh:finalFresh!};
 }
 return {organizationId:initial.organizationId,transaction,
  async beforeSend(){const result=await transaction(async(_tx,assertAbsent)=>{await assertAbsent()});result.assertFresh();return result.assertFresh;},
 };
}

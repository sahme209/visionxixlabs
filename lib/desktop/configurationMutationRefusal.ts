import 'server-only';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readGovernanceEnrollmentMetadata} from '@/lib/governance/intelligence/enrollmentMetadata';
const id=z.string().min(1).max(240).refine(value=>value===value.trim()&&!/[\x00-\x1f\x7f]/.test(value));
const identity=z.object({organizationId:id,userId:id,sessionId:id.optional()}).strict();
type Tx=Pick<Prisma.TransactionClient,'$queryRaw'|'durableAgentWorkflow'>;
interface Repo{$transaction<T>(run:(tx:Tx)=>Promise<T>,options?:{timeout:number;maxWait:number}):Promise<T>}
/** Existing configuration authority only. The same organization lock used by
 * baseline activation serializes positive absence with the whole DB mutation.
 * Callers supply server-authenticated identity and DB-only reauthentication/
 * mutation closures. Never provider traffic, policy admission or activation. */
export async function withUnenrolledConfigurationMutation<T>(repo:Repo,raw:z.input<typeof identity>,signal:AbortSignal,assertCurrent:()=>Promise<void>,mutate:(tx:Tx)=>Promise<T>):Promise<T>{
 const scope=identity.parse(raw);
 try{
  signal.throwIfAborted();
  return await repo.$transaction(async tx=>{
   await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(scope.organizationId)}))`;
   signal.throwIfAborted();await assertCurrent();signal.throwIfAborted();
   const members=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${scope.organizationId} AND "userId"=${scope.userId} FOR SHARE`;
   const member=members[0];if(members.length!==1||member.organizationId!==scope.organizationId||member.userId!==scope.userId||!['owner','admin'].includes(member.role)||!(member.acceptedAt instanceof Date)||!Number.isFinite(member.acceptedAt.getTime()))throw Error();
   let expiresAt:Date|undefined;
   if(scope.sessionId){
    const sessions=await tx.$queryRaw<Array<{id:string;organizationId:string;userId:string;expiresAt:Date;live:boolean}>>`SELECT "id","organizationId","userId","expiresAt",("revokedAt" IS NULL AND "expiresAt">clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${scope.sessionId} AND "organizationId"=${scope.organizationId} AND "userId"=${scope.userId} FOR SHARE`;
    const session=sessions[0];if(sessions.length!==1||session.id!==scope.sessionId||session.organizationId!==scope.organizationId||session.userId!==scope.userId||session.live!==true||!(session.expiresAt instanceof Date)||!Number.isFinite(session.expiresAt.getTime()))throw Error();expiresAt=session.expiresAt;
   }
   if(await readGovernanceEnrollmentMetadata(tx,scope.organizationId,signal)!==false)throw Error();
   signal.throwIfAborted();const result=await mutate(tx);signal.throwIfAborted();
   if(expiresAt){const rows=await tx.$queryRaw<Array<{live:boolean}>>`SELECT clock_timestamp()<${expiresAt} AS "live"`;if(rows.length!==1||rows[0].live!==true)throw Error()}
   signal.throwIfAborted();return result;
  },{timeout:10000,maxWait:5000});
 }catch{throw Error('governance_configuration_mutation_unavailable')}
}

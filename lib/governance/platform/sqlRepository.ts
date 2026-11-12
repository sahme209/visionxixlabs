import 'server-only';
import {randomUUID} from 'node:crypto';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readPlatformAction} from './kernel';
import type {PlatformRepository,PlatformTransaction} from './actionStore';
interface Sql{
 $queryRawUnsafe<T=unknown>(sql:string,...values:unknown[]):Promise<T>;
 $executeRawUnsafe(sql:string,...values:unknown[]):Promise<number>;
}
export interface PlatformSqlDatabase{$transaction<T>(fn:(tx:Sql)=>Promise<T>,options:{isolationLevel:'ReadCommitted';timeout:number;maxWait:number}):Promise<T>}
const fail=():never=>{throw Error('platform_governance_storage_unavailable')};
/** Dedicated platform tables, never a tenant alias. All values parameterized.
 * No retry; uncertain transaction outcomes cannot issue a send proof. */
export function createPlatformSqlRepository(db:PlatformSqlDatabase):PlatformRepository{
 return {transaction:fn=>db.$transaction(async sql=>{
  let locked:string|null=null;
  const check=(id:string)=>{if(locked!==id)fail()};
  const tx:PlatformTransaction={
   async readGrowthPostingSource(draftId,connectionId){
    if(!locked)fail();
    const drafts=await sql.$queryRawUnsafe<unknown[]>('SELECT id,title,hook,body,cta,hashtags,"imageUrn",status,"scheduledFor","updatedAt" FROM "LinkedInPostDraft" WHERE id=$1 FOR SHARE',draftId);
    const connections=await sql.$queryRawUnsafe<unknown[]>('SELECT id,"linkedinUrn","organizationUrn",scopes,status,"expiresAt","updatedAt" FROM "LinkedInAccountConnection" WHERE id=$1 FOR SHARE',connectionId);
    if(drafts.length!==1||connections.length!==1)fail();return {draft:drafts[0],connection:connections[0]};
   },
   async readSessionPrincipal(sessionId){
    if(!locked)fail();
    const rows=await sql.$queryRawUnsafe<Array<{userId:string;sessionId:string}>>('SELECT u.id AS "userId", s.id AS "sessionId" FROM "DesktopSessionRecord" s JOIN "User" u ON u.id=s."userId" WHERE s.id=$1 FOR SHARE OF s,u',sessionId);
    if(rows.length!==1)fail();return rows[0];
   },
   async readPrincipal(principal){
    if(!locked)fail();
    const rows=await sql.$queryRawUnsafe<Array<{userId:string;sessionId:string;email:string;live:boolean}>>('SELECT u.id AS "userId", s.id AS "sessionId", u.email, (s."revokedAt" IS NULL AND s."issuedAt" <= clock_timestamp() AND s."expiresAt" > clock_timestamp() AND m."acceptedAt" IS NOT NULL) AS live FROM "DesktopSessionRecord" s JOIN "User" u ON u.id=s."userId" JOIN "OrgMembership" m ON m."userId"=s."userId" AND m."organizationId"=s."organizationId" WHERE s.id=$1 AND u.id=$2 FOR SHARE OF s,u,m',principal.sessionId,principal.userId);
    if(rows.length!==1)fail();return rows[0];
   },
   async lock(id){if(locked!==null)fail();await sql.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','axiom-platform-governance:'+id);locked=id},
   async now(){if(!locked)fail();const rows=await sql.$queryRawUnsafe<Array<{now:number}>>('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::double precision AS now');if(rows.length!==1||!Number.isSafeInteger(rows[0].now))fail();return rows[0].now},
   async read(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{stateJson:unknown;planDigest:string;version:number}>>('SELECT "stateJson","planDigest",version FROM "PlatformGovernanceAction" WHERE id=$1',id);
    if(!rows.length)return null;if(rows.length!==1)fail();const state=readPlatformAction(rows[0].stateJson);if(state.plan.digest!==rows[0].planDigest||state.version!==rows[0].version)fail();return state},
   async insert(id,raw){check(id);const state=readPlatformAction(raw);await sql.$executeRawUnsafe('INSERT INTO "PlatformGovernanceAction" (id,"planDigest","stateJson",version,"updatedAt") VALUES ($1,$2,$3::jsonb,$4,clock_timestamp())',id,state.plan.digest,JSON.stringify(state),state.version)},
   async replace(id,version,raw){check(id);const state=readPlatformAction(raw);if(state.version!==version+1)fail();
    const count=await sql.$executeRawUnsafe('UPDATE "PlatformGovernanceAction" SET "stateJson"=$1::jsonb,version=$2,"updatedAt"=clock_timestamp() WHERE id=$3 AND version=$4 AND "planDigest"=$5',JSON.stringify(state),state.version,id,version,state.plan.digest);if(count!==1)fail()},
   async event(event){check(event.actionId);readPlatformAction(event.state);
    const sequence=await sql.$queryRawUnsafe<Array<{next:number}>>('SELECT COALESCE(max(sequence),-1)+1 AS next FROM "PlatformGovernanceEvent" WHERE "actionId"=$1',event.actionId);
    if(sequence.length!==1||!Number.isSafeInteger(sequence[0].next)||sequence[0].next<0||sequence[0].next>1000)fail();
    const detail={planDigest:event.state.plan.digest,stateDigest:sha256ContentHash(event.state),status:event.state.status,attemptCount:event.state.attemptCount,...(event.effectIndex===undefined?{}:{effectIndex:event.effectIndex}),...(event.outcome?{outcome:event.outcome}:{})};
    await sql.$executeRawUnsafe('INSERT INTO "PlatformGovernanceEvent" (id,"actionId",sequence,kind,"detailJson") VALUES ($1,$2,$3,$4,$5::jsonb)',randomUUID(),event.actionId,sequence[0].next,event.kind,JSON.stringify(detail));
   },
   async readEffect(id,index){check(id);if(!Number.isSafeInteger(index)||index<0||index>31)fail();const rows=await sql.$queryRawUnsafe<Array<{status:string}>>('SELECT status FROM "PlatformGovernanceEffect" WHERE "actionId"=$1 AND index=$2',id,index);
    if(!rows.length)return null;if(rows.length!==1||!['claimed','confirmed','refused','unknown'].includes(rows[0].status))fail();return rows[0].status},
   async writeEffect(id,index,expected,status){check(id);if(!Number.isSafeInteger(index)||index<0||index>31||!['claimed','confirmed','refused','unknown'].includes(status))fail();
    if(expected===null){if(status!=='claimed')fail();await sql.$executeRawUnsafe('INSERT INTO "PlatformGovernanceEffect" ("actionId",index,status) VALUES ($1,$2,$3)',id,index,status)}
    else{if(expected!=='claimed'||status==='claimed')fail();const count=await sql.$executeRawUnsafe('UPDATE "PlatformGovernanceEffect" SET status=$1 WHERE "actionId"=$2 AND index=$3 AND status=$4',status,id,index,expected);if(count!==1)fail()}
   },
  };
  return fn(tx);
 },{isolationLevel:'ReadCommitted',timeout:10000,maxWait:5000})};
}

/** Repo-scoped native Git credentials. Read operations receive contents_read.
 * Push is fenced at issuance; an already-issued bearer remains usable until its
 * provider expiry/revocation and is repository-wide, not branch-bound. This is
 * NOT enrollment-safe outstanding-token policy. */
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {createCurrentGithubWriteGuard} from '@/lib/desktop/currentGithubWriteAuthority';
import {hasDesktopCapability,type DesktopWorkspaceRole} from '@/lib/desktop/desktopAuthorization';
import {resolveTenantScopedToken,parseRepositoryFullName} from '@/lib/connectors/github/resolveTenantScopedToken';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {record as recordAudit} from '@/lib/audit/secureAudit';
import {id as idFactory} from '@/lib/domain/ids';
import {getRepositoryDefaultBranch} from '@/lib/connectors/github/githubWriteClient';
import {isAgentGithubBranchReference} from '@/lib/tauri/agentGithubBranchReview';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const payload=z.object({repositoryFullName:z.string().trim().min(1).max(201),purpose:z.enum(['clone','pull','push']).default('clone'),branch:z.string().trim().refine(isAgentGithubBranchReference).optional()}).strict();
class Refusal extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
export async function POST(request:NextRequest):Promise<Response>{
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
 try{
  if(request.method!=='POST'||request.url.length>2048||request.nextUrl.search||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)throw new Refusal('invalid_payload',400);
  const boundedRequest=new NextRequest(request.url,{method:'POST',headers:request.headers,signal});
  const principal=()=>withGithubAbort(resolveRequestDesktopSession(boundedRequest,{requiredScope:'pipeline:read',route:'POST /api/desktop/github/clone-token',allowApiKey:false,requiredCapability:'github:write',requireWorkspaceMembership:true,recordHeartbeat:false}),signal);
  const session=await principal();
  if(!session||session.credentialKind!=='desktop_session'||!session.id||!session.organizationId||!session.userId||!session.capabilities.includes('github:write'))throw new Refusal('desktop_session_required',401);
  const bound={id:session.id,userId:session.userId,organizationId:session.organizationId};
  const current=async()=>{const actor=await principal();if(!actor||actor.credentialKind!=='desktop_session'||actor.id!==bound.id||actor.userId!==bound.userId||actor.organizationId!==bound.organizationId||!actor.capabilities.includes('github:write'))throw new Refusal('github_token_unavailable',409);signal.throwIfAborted()};
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const next=await withGithubAbort(reader.read(),signal);if(next.done)break;size+=next.value.byteLength;if(size>2048)throw new Refusal('invalid_payload',400);chunks.push(next.value)}}finally{void reader.cancel().catch(()=>{});try{reader.releaseLock()}catch{}}
  let raw:unknown;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}catch{throw new Refusal('invalid_payload',400)}
  const {repositoryFullName,purpose,branch}=payload.parse(raw),repo=parseRepositoryFullName(repositoryFullName);
  if(!repo)throw new Refusal('invalid_repository_full_name',400);
  // Refuse an unspecified push target before any provider credential is minted.
  if(purpose==='push'&&!branch)throw new Refusal('push_branch_required',400);
  let token:string,final:()=>Promise<void>;
  const nonDefault=async()=>{const result=await withGithubAbort(getRepositoryDefaultBranch({...repo,installationToken:token}),signal);if(!result.ok)throw new Refusal('github_token_unavailable',409);if(branch===result.data)throw new Refusal('github_pull_request_cycle_required',409)};
  if(purpose==='push'){
   const guard=createCurrentGithubWriteGuard(boundedRequest,session,prisma);
   await guard();const result=await guard.resolveToken(repo);if(!result.ok)throw new Refusal('github_token_unavailable',409);token=result.token;
   await nonDefault();final=async()=>{await nonDefault();await guard()};
  }else{
   await current();
   const row=await withGithubAbort(prisma.gitHubInstallation.findFirst({where:{organizationId:bound.organizationId,status:'active'},orderBy:{installedAt:'desc'},select:{id:true,githubInstallationId:true,updatedAt:true,revokedAt:true,suspendedAt:true}}),signal);
   if(!row||!row.id||! /^[1-9][0-9]*$/.test(row.githubInstallationId)||!Number.isSafeInteger(Number(row.githubInstallationId))||!(row.updatedAt instanceof Date)||!Number.isFinite(row.updatedAt.getTime())||row.revokedAt!==null||row.suspendedAt!==null)throw new Refusal('github_token_unavailable',409);
   const pin=Object.freeze({id:row.id,githubInstallationId:row.githubInstallationId,updatedAt:new Date(row.updatedAt.getTime())});
   const result=await withGithubAbort(resolveTenantScopedToken(bound.organizationId,repo,{...pin,permissionProfile:'contents_read',signal},prisma),signal);
   if(!result.ok)throw new Refusal('github_token_unavailable',409);token=result.token;
   final=async()=>{
    await current();
    // Last read observes current session, accepted membership and pinned latest
    // connection together. No subsequent authority/network await before return.
    const rows=await withGithubAbort(prisma.$queryRaw<Array<{sessionId:string;userId:string;organizationId:string;sessionLive:boolean;role:string;acceptedAt:Date|null;connectionId:string;githubInstallationId:string;connectionRevision:Date;connectionRevokedAt:Date|null;connectionSuspendedAt:Date|null;connectionStatus:string}>>`SELECT s."id" AS "sessionId",s."userId",s."organizationId",(s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp()) AS "sessionLive",m."role",m."acceptedAt",i."id" AS "connectionId",i."githubInstallationId",i."updatedAt" AS "connectionRevision",i."revokedAt" AS "connectionRevokedAt",i."suspendedAt" AS "connectionSuspendedAt",i."status" AS "connectionStatus" FROM "DesktopSessionRecord" s JOIN "OrgMembership" m ON m."organizationId"=s."organizationId" AND m."userId"=s."userId" JOIN "GitHubInstallation" i ON i."organizationId"=s."organizationId" AND i."id"=${pin.id} WHERE s."id"=${bound.id} AND s."userId"=${bound.userId} AND s."organizationId"=${bound.organizationId} AND i."id"=(SELECT latest."id" FROM "GitHubInstallation" latest WHERE latest."organizationId"=${bound.organizationId} AND latest."status"='active' ORDER BY latest."installedAt" DESC LIMIT 1)`,signal);
    const r=rows[0];if(rows.length!==1||!r||r.sessionId!==bound.id||r.userId!==bound.userId||r.organizationId!==bound.organizationId||r.sessionLive!==true||!(r.acceptedAt instanceof Date)||!Number.isFinite(r.acceptedAt.getTime())||!hasDesktopCapability(r.role as DesktopWorkspaceRole,'github:write')||r.connectionId!==pin.id||r.githubInstallationId!==pin.githubInstallationId||!(r.connectionRevision instanceof Date)||r.connectionRevision.getTime()!==pin.updatedAt.getTime()||r.connectionRevokedAt!==null||r.connectionSuspendedAt!==null||r.connectionStatus!=='active')throw new Refusal('github_token_unavailable',409);
    signal.throwIfAborted();
   };
   await final();
  }
  if(typeof token!=='string'||!token||token.length>4096||/[\s\x00-\x1f\x7f]/.test(token))throw new Refusal('github_token_unavailable',409);
  try{await withGithubAbort(recordAudit({organizationId:idFactory.organization(bound.organizationId),actorUserId:idFactory.user(bound.userId),actorKind:'user',action:`github.${purpose}_token_minted`,outcome:'success',entityRef:`github_repo:${repositoryFullName}`,correlationId:idFactory.correlation(`github_clone_${Date.now().toString(36)}`),source:'live',detail:{repositoryFullName,purpose,...(branch?{branch}:{})}}),signal)}catch{/* Best effort; current authority must still pass below. */}
  await final();signal.throwIfAborted();
  return reply({ok:true,data:{cloneUrl:`https://x-access-token:${encodeURIComponent(token)}@github.com/${repo.owner}/${repo.repo}.git`}});
 }catch(error){return reply({ok:false,error:error instanceof Refusal?error.code:error instanceof z.ZodError?'invalid_payload':'github_token_unavailable'},error instanceof Refusal?error.status:error instanceof z.ZodError?400:409)}
}

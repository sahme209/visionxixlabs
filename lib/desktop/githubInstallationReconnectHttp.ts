import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {consumeToken} from '@/lib/api/rateLimiter';
import {readGithubAppInstallation} from '@/lib/connectors/github/githubAppAuth';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {readDesktopCommercialAccess} from './desktopCommercialAccess';
import {hasDesktopCapability,type DesktopWorkspaceRole} from './desktopAuthorization';
import {githubReconnectRequestSchema} from './githubInstallationReconnectContract';
import {createGithubInstallationReconnectStore,type GithubReconnectRepo,type GithubReconnectScope} from './githubInstallationReconnectStore';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
class AuthenticationRequired extends Error{}
/** Explicit local reconnect, never a provider grant, installation-token mint or callback simulation. */
export async function handleGithubInstallationReconnect(request:NextRequest){let stage:'authorization'|'local_storage'|'provider_verification'|'challenge_write'|'connection_restore'|'challenge_consume'='authorization';try{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 if(request.nextUrl.searchParams.size||request.url.length>2048||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)return reply({ok:false,error:'invalid_github_reconnect'},400);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]);
 const principal=async()=>{signal.throwIfAborted();const p=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'connections:manage',requireWorkspaceAdmin:true,requireWorkspaceMembership:true,allowApiKey:false,route:'GitHub existing installation reconnect'}),signal);if(!p||p.credentialKind!=='desktop_session'||!p.id||!p.userId||!p.organizationId||!['owner','admin'].includes(p.role??'')||!p.capabilities.includes('connections:manage'))throw new AuthenticationRequired();return p};
 const initial=await principal(),scope={organizationId:initial.organizationId,userId:initial.userId,sessionId:initial.id};
 if(!consumeToken(`github-reconnect:${scope.organizationId}:${scope.userId}`,{capacity:4,tokensPerSecond:1/60}).allowed)return reply({ok:false,error:'rate_limited'},429);
 const bytes=await readBoundedGithubBody(new Response(request.body),signal,512),input=githubReconnectRequestSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
 const current=async()=>{const p=await principal();if(p.id!==scope.sessionId||p.userId!==scope.userId||p.organizationId!==scope.organizationId)throw new AuthenticationRequired()};
 const assertCurrent=async(tx:ReleaseOperationPlanTransaction,s:GithubReconnectScope)=>{if(s.organizationId!==scope.organizationId||s.userId!==scope.userId||s.sessionId!==scope.sessionId)throw new AuthenticationRequired();signal.throwIfAborted();if(!(await withGithubAbort(readDesktopCommercialAccess(scope.organizationId),signal)).allowed)throw new AuthenticationRequired();
 const members=await tx.$queryRaw<Array<{organizationId:string;userId:string;acceptedAt:Date|null;role:DesktopWorkspaceRole}>>`SELECT "organizationId","userId","acceptedAt","role" FROM "OrgMembership" WHERE "organizationId"=${scope.organizationId} AND "userId"=${scope.userId} FOR SHARE`;
 if(!(await withGithubAbort(readDesktopCommercialAccess(scope.organizationId),signal)).allowed)throw new AuthenticationRequired();
 const sessions=await tx.$queryRaw<Array<{id:string;organizationId:string;userId:string;live:boolean}>>`SELECT "id","organizationId","userId",("revokedAt" IS NULL AND "expiresAt">clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${scope.sessionId} AND "organizationId"=${scope.organizationId} AND "userId"=${scope.userId} FOR SHARE`;
 const d=sessions[0],m=members[0];if(sessions.length!==1||!d||d.id!==scope.sessionId||d.organizationId!==scope.organizationId||d.userId!==scope.userId||!d.live||members.length!==1||!m||m.organizationId!==scope.organizationId||m.userId!==scope.userId||!m.acceptedAt||!['owner','admin'].includes(m.role)||!hasDesktopCapability(m.role,'connections:manage'))throw new AuthenticationRequired();signal.throwIfAborted()};
 const store=createGithubInstallationReconnectStore(prisma as unknown as GithubReconnectRepo,{assertCurrent,onStage:value=>{stage=value},readInstallation:(id,s)=>withGithubAbort(readGithubAppInstallation(id,s),s)});
 stage='local_storage';const data=await withGithubAbort<unknown>(input.action==='verify'?store.verify(scope,signal):store.confirm(scope,input.challengeId,input.expectedVersion,signal),signal);await current();return reply({ok:true,data});
 }catch(e){return e instanceof AuthenticationRequired?reply({ok:false,error:'desktop_session_required'},401):e instanceof z.ZodError||e instanceof SyntaxError?reply({ok:false,error:'invalid_github_reconnect'},400):reply({ok:false,error:'github_reconnect_unavailable',stage},409)}}

import {jiraRecordedScopesSchema} from '@/lib/integrations/jira/jiraRecordedScopes';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession,type DesktopRequestPrincipal} from '@/lib/desktop/resolveRequestDesktopSession';
import {readJiraCreateMetadata} from '@/lib/releaseops/readJiraCreateMetadata';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;
const policy={requiredScope:'pipeline:read' as const,requiredCapability:'connections:manage' as const,requireWorkspaceAdmin:true,allowApiKey:false,route:'GET /api/desktop/integrations/jira/create-metadata'};
const identifier=z.string().min(1).max(512).refine(v=>v.trim()===v&&!/[\x00-\x1f\x7f-\x9f]/.test(v)&&Buffer.byteLength(v,'utf8')<=512);
const querySchema=z.object({connectionId:identifier,revision:z.string().max(32).refine(v=>{try{return new Date(v).toISOString()===v;}catch{return false;}}),projectIdOrKey:z.string().regex(/^(?:[A-Z][A-Z0-9_]{0,99}|[0-9]{1,20})$/),issueTypeId:z.string().regex(/^[0-9]{1,20}$/)}).strict();
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
function paired(p:DesktopRequestPrincipal|undefined):p is DesktopRequestPrincipal{return Boolean(p&&p.credentialKind==='desktop_session'&&(p.role==='owner'||p.role==='admin')&&p.capabilities.includes('connections:manage')&&[p.id,p.userId,p.organizationId].every(v=>identifier.safeParse(v).success));}
/** Discovery only. Refresh is restricted to the current consenting administrator;
 * provider credentials, current health and issue-write authority are never returned. */
export async function GET(request:NextRequest):Promise<Response>{
 try{
  const principal=await resolveRequestDesktopSession(request,policy);
  if(!paired(principal))return reply({ok:false,error:'desktop_session_required'},401);
  const params=request.nextUrl.searchParams;
  if(Buffer.byteLength(request.url,'utf8')>2048||[...params.keys()].some(key=>params.getAll(key).length!==1))return reply({ok:false,error:'invalid_jira_metadata_request'},400);
  const parsed=querySchema.safeParse(Object.fromEntries(params));
  if(!parsed.success)return reply({ok:false,error:'invalid_jira_metadata_request'},400);
  const row=await prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:principal.organizationId,provider:'jira'}},select:{id:true,organizationId:true,provider:true,status:true,revokedAt:true,consentedByUserId:true,externalAccountId:true,scopesJson:true,updatedAt:true}});
  const scopes=jiraRecordedScopesSchema.safeParse(row?.scopesJson);
  if(!row||row.id!==parsed.data.connectionId||row.organizationId!==principal.organizationId||row.provider!=='jira'||row.status!=='active'||row.revokedAt||row.consentedByUserId!==principal.userId||row.updatedAt.toISOString()!==parsed.data.revision||!z.string().uuid().safeParse(row.externalAccountId).success||!scopes.success||!scopes.data.includes('read:jira-work')||new Set(scopes.data).size!==scopes.data.length)return reply({ok:false,error:'jira_create_metadata_unavailable'},409);
  const scope={sessionId:principal.id,organizationId:principal.organizationId,userId:principal.userId};
  const readCurrentActor=async()=>{
   const current=await resolveRequestDesktopSession(request,policy);
   return paired(current)&&current.id===scope.sessionId&&current.organizationId===scope.organizationId&&current.userId===scope.userId?{organizationId:scope.organizationId,userId:scope.userId,canManageConnections:true}:null;
  };
  // Do not materialize platform secrets before current authority and stored
  // connection fences. Missing config only prevents refresh, not unexpired reads.
  const actor=await readCurrentActor();
  if(!actor)return reply({ok:false,error:'jira_create_metadata_unavailable'},409);
  const result=await readJiraCreateMetadata({organizationId:scope.organizationId,projectIdOrKey:parsed.data.projectIdOrKey,issueTypeId:parsed.data.issueTypeId,signal:request.signal,authorization:{actor,readCurrentActor,connectionId:row.id,revision:parsed.data.revision,refresh:{clientId:process.env.JIRA_CLIENT_ID?.trim()??'',clientSecret:process.env.JIRA_CLIENT_SECRET?.trim()??'',transport:fetch}}});
  if(!result.ok)return reply(result.error==='jira_refresh_persistence_outcome_unknown'?{ok:false,error:result.error,retryAllowed:false}:{ok:false,error:'jira_create_metadata_unavailable'},409);
  const body={ok:true,data:{connectionId:result.connectionId,connectionRevision:result.connectionRevision,projectIdOrKey:result.projectIdOrKey,issueTypeId:result.issueTypeId,metadata:result.metadata}};
  if(Buffer.byteLength(JSON.stringify(body),'utf8')>256*1024)return reply({ok:false,error:'jira_metadata_response_too_large'},502);
  return reply(body);
 }catch{return reply({ok:false,error:'jira_create_metadata_unavailable'},503);}
}

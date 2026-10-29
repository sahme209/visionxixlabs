import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession,type DesktopRequestPrincipal} from '@/lib/desktop/resolveRequestDesktopSession';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const policy={requiredScope:'pipeline:read' as const,requiredCapability:'connections:manage' as const,requireWorkspaceAdmin:true,allowApiKey:false,route:'GET /api/desktop/integrations/jira/connections'};
const identifier=z.string().min(1).max(512).refine(v=>v.trim()===v&&!/[\x00-\x1f\x7f-\x9f]/.test(v)&&Buffer.byteLength(v,'utf8')<=512);
const paired=(p:DesktopRequestPrincipal|undefined):p is DesktopRequestPrincipal=>Boolean(p&&p.credentialKind==='desktop_session'&&(p.role==='owner'||p.role==='admin')&&p.capabilities.includes('connections:manage')&&[p.id,p.organizationId,p.userId].every(v=>identifier.safeParse(v).success));
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
/** Unique workspace/provider record, current consenter only. Recorded validation
 * is historical evidence; no credentials, health read, consent or activation. */
export async function GET(request:NextRequest):Promise<Response>{
 try{
  const principal=await resolveRequestDesktopSession(request,policy);
  if(!paired(principal))return reply({ok:false,error:'desktop_session_required'},401);
  if(request.nextUrl.search)return reply({ok:false,error:'invalid_jira_connection_request'},400);
  const owner={sessionId:principal.id,organizationId:principal.organizationId,userId:principal.userId};
  request.signal.throwIfAborted();
  const row=await prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:owner.organizationId,provider:'jira'}},select:{id:true,organizationId:true,provider:true,status:true,revokedAt:true,consentedByUserId:true,updatedAt:true,lastValidatedAt:true}});
  const connections:Array<{connectionId:string;revision:string;label:'Jira connection';recordedState:'read_validation_recorded';lastValidatedAt:string}>=[];
  if(row&&row.organizationId===owner.organizationId&&row.provider==='jira'&&row.consentedByUserId===owner.userId&&row.status==='active'&&!row.revokedAt&&row.lastValidatedAt){
   const connectionId=identifier.parse(row.id);
   if(!Number.isFinite(row.updatedAt.getTime())||!Number.isFinite(row.lastValidatedAt.getTime()))throw Error('invalid_metadata');
   connections.push({connectionId,revision:row.updatedAt.toISOString(),label:'Jira connection',recordedState:'read_validation_recorded',lastValidatedAt:row.lastValidatedAt.toISOString()});
  }
  const current=await resolveRequestDesktopSession(request,policy);
  if(!paired(current)||current.id!==owner.sessionId||current.organizationId!==owner.organizationId||current.userId!==owner.userId)return reply({ok:false,error:'workspace_authority_changed'},403);
  request.signal.throwIfAborted();
  const body={ok:true,data:{connections,hasMore:false,currentHealth:'not_checked',capability:'jira_ticket_discovery_v1',issueWritePermissionVerified:false}};
  if(Buffer.byteLength(JSON.stringify(body),'utf8')>16*1024)throw Error('metadata_too_large');
  return reply(body);
 }catch{return reply({ok:false,error:'jira_connection_summary_unavailable'},503);}
}

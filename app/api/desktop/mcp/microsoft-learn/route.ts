import {NextResponse,type NextRequest} from 'next/server';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {prisma} from '@/lib/db';
import type {AgentSkillRepo} from '@/lib/axiom/agentRuntime/skillCatalog';
import {checkMicrosoftLearn,searchInstalledMicrosoftLearn} from '@/lib/integrations/mcp/microsoftLearn';
import {consumeToken} from '@/lib/api/rateLimiter';
import {recordRequiredAudit} from '@/lib/audit/requiredAudit';
import {id} from '@/lib/domain/ids';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function smallJson(request:NextRequest):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)return null;let bytes=0,text='';const decoder=new TextDecoder();
 try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>2048){await reader.cancel();return null;}text+=decoder.decode(chunk.value,{stream:true});}return JSON.parse(text+decoder.decode());}catch{return null;}finally{reader.releaseLock();}
}
export async function POST(request:NextRequest){
 try{
  const context=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',route:'POST /api/desktop/mcp/microsoft-learn',allowApiKey:false});
  if(!context)return reply({ok:false,error:'desktop_session_required'},401);
  const body=await smallJson(request);
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({ok:false,error:'invalid_payload'},400);
  const input=body as Record<string,unknown>;
  if(!['check','search'].includes(String(input.action))||Object.keys(input).some(key=>key!=='action'&&(input.action!=='search'||key!=='query')))return reply({ok:false,error:'invalid_payload'},400);
  if(!consumeToken(`mcp-learn:${context.organizationId}:${context.userId}`,{capacity:10,tokensPerSecond:1/6}).allowed)return reply({ok:false,error:'documentation_rate_limited'},429);
  const result=input.action==='check'?await checkMicrosoftLearn():await searchInstalledMicrosoftLearn(prisma as unknown as AgentSkillRepo,String(context.organizationId),input.query);
  try{await recordRequiredAudit({organizationId:id.organization(String(context.organizationId)),actorUserId:id.user(String(context.userId)),actorKind:'user',action:'mcp.documentation_read',outcome:result.ok?'success':'failure',entityRef:'mcp:microsoft-learn',correlationId:id.correlation(`mcp_${crypto.randomUUID()}`),source:'live',detail:{operation:String(input.action),provider:'microsoft_learn',...(result.ok&&'results' in result.data?{resultCount:result.data.results.length}:{})}});}catch{return reply({ok:false,error:'documentation_audit_unconfirmed'},503);}
  return reply(result,result.ok?200:result.error==='mcp_not_enabled'?409:result.error==='invalid_documentation_query'?400:503);
 }catch{return reply({ok:false,error:'microsoft_learn_unavailable'},503);}
}

import { NextResponse,type NextRequest } from 'next/server';
import { currentContext } from '@/lib/auth/currentContext';
import { isSameOriginRequest } from '@/lib/auth/requestOrigin';
import { readDesktopCommercialAccess } from '@/lib/desktop/desktopCommercialAccess';
import { updateWorkspaceSkill } from '@/lib/axiom/agentRuntime/skillManagement';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const response=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:NextRequest){
 try{
  if(!isSameOriginRequest(request))return response({ok:false,error:'same_origin_required'},403);
  const context=await currentContext();
  if(!context.isAuthenticated || !context.organizationId || !context.userId)return response({ok:false,error:'sign_in_required'},401);
  if(!context.roles.some(role=>role==='owner'||role==='admin'))return response({ok:false,error:'workspace_admin_required'},403);
  if(!(await readDesktopCommercialAccess(String(context.organizationId))).allowed)return response({ok:false,error:'workspace_access_required'},403);
  const body=await request.json().catch(()=>null) as {skillId?:unknown;action?:unknown}|null;
  if(typeof body?.skillId!=='string' || typeof body.action!=='string' || !['install','enable','disable','remove'].includes(body.action))return response({ok:false,error:'invalid_payload'},400);
  const result=await updateWorkspaceSkill({organizationId:String(context.organizationId),userId:String(context.userId),skillId:body.skillId,action:body.action});
  const {statusCode,...resultBody}=result;
  return response(resultBody,statusCode);
 }catch{return response({ok:false,error:'skill_update_unavailable'},503);}
}

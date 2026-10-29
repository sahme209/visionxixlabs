import {NextResponse,type NextRequest} from 'next/server';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {readCloudOnboardingReadiness} from '@/lib/cloud/onboardingReadiness';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest):Promise<Response>{
 try{
  const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',allowApiKey:false,route:'GET /api/desktop/cloud/onboarding-readiness'});
  if(!actor||actor.credentialKind!=='desktop_session'||!actor.capabilities.includes('workspace:read'))return reply({ok:false,error:'desktop_session_required'},401);
  if(request.nextUrl.search)return reply({ok:false,error:'invalid_cloud_readiness_request'},400);
  return reply({ok:true,data:readCloudOnboardingReadiness()});
 }catch{return reply({ok:false,error:'cloud_readiness_unavailable'},503);}
}

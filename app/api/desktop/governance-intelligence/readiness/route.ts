/**
 * POST /api/desktop/governance-intelligence/readiness — metadata-only readiness
 * read (coverage catalog §6 "Safe readiness read, before activation").
 *
 * Off unless AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED=true. Desktop session with
 * workspace read only. Returns blocked/unavailable, uncovered family IDs and
 * lease/drain counts; always executionAuthorized: false. It never claims,
 * activates, consents, retries or exposes a credential, and its response is
 * not a permission receipt for any later activation.
 */
import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createGovernanceReadinessService} from '@/lib/governance/intelligence/readinessService';
import {readinessBlockers} from '@/lib/governance/intelligence/uncoveredFamilies';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const enabled=()=>process.env.AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED==='true';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});

export async function POST(request:NextRequest){
 try{
  if(request.nextUrl.search||request.url.length>2048)return reply({ok:false,error:'invalid_governance_readiness_request'},400);
  if(!enabled())return reply({ok:false,error:'governance_intelligence_disabled'},503);
  const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'governance intelligence readiness'});
  if(!actor||actor.credentialKind!=='desktop_session'||!actor.id||!actor.userId||!actor.organizationId)return reply({ok:false,error:'desktop_session_required'},401);
  if(!consumeToken(`governance-readiness:${actor.organizationId}:${actor.userId}`,{capacity:5,tokensPerSecond:1/12}).allowed)return reply({ok:false,error:'rate_limited'},429);
  const service=createGovernanceReadinessService(request,prisma as unknown as ReleaseOperationPlanRepo,{organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id});
  const readiness=await service.read();
  // Static blockers can only make this stricter: overall status is never better than blocked.
  const blockers=readinessBlockers();
  return reply({ok:true,data:{...readiness,status:readiness.status==='unavailable'?'unavailable':blockers.status,executionAuthorized:false,uncoveredFamilies:blockers.uncoveredFamilies}});
 }catch{
  return reply({ok:false,error:'governance_readiness_unavailable'},409);
 }
}

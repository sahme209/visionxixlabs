import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {resolveRequestDesktopSession} from "@/lib/desktop/resolveRequestDesktopSession";
import {hasDesktopCapability} from "@/lib/desktop/desktopAuthorization";
import {appendAuditEvent,type AuditEventRepo} from "@/lib/releaseops/auditEventResponder";
import type {CustomerPlanPrincipal} from "./customerPlanAuthority";
import {configureCustomerPlanProfile,revokeCustomerPlanProfile,readCustomerPlanProfile,importCustomerSavedPlan,type CustomerPlanServiceDatabase,type CustomerPlanFailure} from "./customerPlanService";
const headers={"cache-control":"no-store"};
const deny=(status:number,error:string,message?:string)=>NextResponse.json({ok:false,error,...(message?{message}:{})},{status,headers});
class Invalid extends Error {}
function closed(body:unknown,keys:string[]):body is Record<string,unknown>{return !!body&&typeof body==="object"&&!Array.isArray(body)&&Object.keys(body).length===keys.length&&keys.every(k=>Object.hasOwn(body,k));}
export async function customerPlanPrincipal(request:NextRequest,operation:"read"|"profile"|"import"):Promise<CustomerPlanPrincipal|undefined>{
 const session=await resolveRequestDesktopSession(request,{requiredScope:operation==="read"?"pipeline:read":"pipeline:trigger",allowApiKey:false,requireWorkspaceAdmin:operation!=="read",requiredCapability:operation==="read"?"workspace:read":operation==="profile"?"policy:manage":"connections:manage",route:`${request.method} ${request.nextUrl.pathname}`});
 if(!session||session.credentialKind!=="desktop_session"||operation!=="read"&&!hasDesktopCapability(session.role,"connections:manage"))return undefined;
 return {organizationId:String(session.organizationId),userId:String(session.userId),sessionId:session.id};
}
/** Bounded JSON only, not a plan/artifact upload surface. */
async function body(request:NextRequest):Promise<unknown>{
 if(!request.body||request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")throw new Invalid();
 const declared=request.headers.get("content-length");if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>16384))throw new Invalid();
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let bytes=0,timer:ReturnType<typeof setTimeout>|undefined;
 let reject!:()=>void;const stopped=new Promise<never>((_,fail)=>{reject=()=>fail(new Invalid());timer=setTimeout(reject,5000);});request.signal.addEventListener("abort",reject,{once:true});
 try{if(request.signal.aborted)throw new Invalid();while(true){const value=await Promise.race([reader.read(),stopped]);if(value.done)break;bytes+=value.value.byteLength;if(bytes>16384)throw new Invalid();chunks.push(value.value);}return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));}
 catch{throw new Invalid();}finally{if(timer)clearTimeout(timer);request.signal.removeEventListener("abort",reject);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
function result(value:Awaited<ReturnType<typeof readCustomerPlanProfile>>|Awaited<ReturnType<typeof importCustomerSavedPlan>>):NextResponse{
 if(value.kind==="customer_plan_profile"||value.kind==="customer_plan_imported")return NextResponse.json({ok:true,data:value},{headers});
 const failure=value as CustomerPlanFailure,status={invalid:400,forbidden:403,not_found:404,conflict:409,unavailable:503}[failure.kind];
 return deny(status,failure.reason,failure.reason==="customer_plan_environment_immutable_new_request"?"This profile's environment is immutable. Create a new deployment request for a different environment.":failure.kind==="conflict"?"Current request, profile or connection state changed. Refresh and review again.":failure.kind==="unavailable"?"Customer plan evidence is unavailable. Ask an administrator to review optional storage, the reviewed producer and connected read access. Approval and apply remain unavailable.":undefined);
}
export async function handleCustomerPlanProfile(request:NextRequest,requestId:string):Promise<NextResponse>{
 try{
  const operation=request.method==="GET"?"read":"profile",principal=await customerPlanPrincipal(request,operation);if(!principal)return deny(401,"desktop_session_required");if(request.nextUrl.search)throw new Invalid();
  const deps={db:prisma as unknown as CustomerPlanServiceDatabase,now:()=>new Date(),signal:request.signal};
  if(request.method==="GET")return result(await readCustomerPlanProfile(deps,principal,requestId));
  if(request.method!=="POST")throw new Invalid();const input=await body(request);
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Invalid();const raw=input as Record<string,unknown>;
  let value:Awaited<ReturnType<typeof readCustomerPlanProfile>>;
  if((raw.operation==="configure"||raw.operation==="revise")&&closed(raw,["operation","requestVersion","expectedRevision","profileInput"])&&(raw.operation==="configure"?raw.expectedRevision===0:typeof raw.expectedRevision==="number"&&raw.expectedRevision>0))value=await configureCustomerPlanProfile(deps,principal,requestId,{requestVersion:raw.requestVersion,expectedRevision:raw.expectedRevision,profileInput:raw.profileInput});
  else if(raw.operation==="revoke"&&closed(raw,["operation","requestVersion","profileId","expectedRevision"]))value=await revokeCustomerPlanProfile(deps,principal,requestId,{requestVersion:raw.requestVersion,profileId:raw.profileId,expectedRevision:raw.expectedRevision});
  else throw new Invalid();
  if(value.kind==="customer_plan_profile")try{await appendAuditEvent(prisma as unknown as AuditEventRepo,{organizationId:principal.organizationId,actorUserId:principal.userId,kind:value.status==="revoked"?"terraform.plan.profile.revoked":"terraform.plan.profile.configured",subjectKind:"policy",subjectId:value.profile?.id??requestId,summary:value.status==="revoked"?"Revoked customer Terraform evidence profile locally; provider resources and issued credentials were not revoked":"Configured immutable customer Terraform evidence profile; approval and execution remain unavailable",detailJson:{deploymentRequestId:requestId,revision:value.profile?.revision,status:value.status}});}catch{/* best-effort existing audit */}
  return result(value);
 }catch(error){return error instanceof Invalid?deny(400,"customer_plan_input_invalid"):deny(503,"customer_plan_unavailable");}
}
export async function handleCustomerPlanImport(request:NextRequest,requestId:string):Promise<NextResponse>{
 try{
  const principal=await customerPlanPrincipal(request,"import");if(!principal)return deny(401,"desktop_session_required");if(request.method!=="POST"||request.nextUrl.search)throw new Invalid();
  const input=await body(request);if(!closed(input,["requestVersion","profileId","profileRevision","runId","runAttempt"]))throw new Invalid();const value=await importCustomerSavedPlan({db:prisma as unknown as CustomerPlanServiceDatabase,now:()=>new Date(),signal:request.signal},principal,requestId,input);
  if(value.kind==="customer_plan_imported")try{await appendAuditEvent(prisma as unknown as AuditEventRepo,{organizationId:principal.organizationId,actorUserId:principal.userId,kind:"terraform.plan.evidence.imported",subjectKind:"deployment_execution",subjectId:value.artifactId,summary:"Imported verified customer Terraform review evidence; no approval or execution authority",detailJson:{deploymentRequestId:requestId,reused:value.reused}});}catch{/* best-effort existing audit */}
  return result(value);
 }catch(error){return error instanceof Invalid?deny(400,"customer_plan_input_invalid"):deny(503,"customer_plan_unavailable");}
}

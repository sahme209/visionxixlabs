import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {ZodError} from "zod";
import {prisma} from "@/lib/db";
import {resolveRequestDesktopSession} from "@/lib/desktop/resolveRequestDesktopSession";
import {consumeToken} from "@/lib/api/rateLimiter";
import {parseSavedBotTaskCreate,parseSavedBotTaskUpdate} from "./savedTaskSchema";
import {createSavedBotTask,updateSavedBotTask,getSavedBotTask,listSavedBotTasks,listSavedBotTaskHistory,SavedBotTaskConflictError,SavedBotTaskNotFoundError,type SavedBotTaskRepo,type SavedBotTaskRow,type SavedBotTaskSummary,type SavedBotTaskScope} from "./savedTaskRepo";
const db=prisma as unknown as SavedBotTaskRepo;
const idPattern=/^bot_[a-f0-9]{64}$/;
class Invalid extends Error {}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const fail=(error:string,status:number)=>reply({ok:false,error},status);
async function principal(request:NextRequest):Promise<SavedBotTaskScope|null>{
 const session=await resolveRequestDesktopSession(request,{requiredScope:"pipeline:read",requiredCapability:"workspace:read",requireWorkspaceMembership:true,allowApiKey:false,route:`${request.method} ${request.nextUrl.pathname}`});
 return session?.credentialKind==="desktop_session"?{organizationId:String(session.organizationId),userId:String(session.userId)}:null;
}
function query(request:NextRequest,allowed:string[]):URLSearchParams {
 const params=request.nextUrl.searchParams;
 for(const key of params.keys())if(!allowed.includes(key)||params.getAll(key).length!==1)throw new Invalid();
 return params;
}
async function body(request:NextRequest):Promise<unknown>{
 if(!request.body||request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")throw new Invalid();
 const declared=request.headers.get("content-length");if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>20480))throw new Invalid();
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0,timer:ReturnType<typeof setTimeout>|undefined;
 let stop!:()=>void;const stopped=new Promise<never>((_,reject)=>{stop=()=>reject(new Invalid());timer=setTimeout(stop,5000)});request.signal.addEventListener("abort",stop,{once:true});
 try{
  if(request.signal.aborted)throw new Invalid();
  while(true){const part=await Promise.race([reader.read(),stopped]);if(part.done)break;size+=part.value.byteLength;if(size>20480)throw new Invalid();chunks.push(part.value)}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));
 }catch{throw new Invalid()}finally{clearTimeout(timer);request.signal.removeEventListener("abort",stop);void reader.cancel().catch(()=>{});reader.releaseLock()}
}
async function currentScope(request:NextRequest,previous:SavedBotTaskScope):Promise<boolean>{
 if(request.signal.aborted)return false;const current=await principal(request);return current?.organizationId===previous.organizationId&&current?.userId===previous.userId;
}
function summary(row:SavedBotTaskSummary){return {id:row.id,title:row.title,status:"draft" as const,version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()}}
function detail(row:SavedBotTaskRow){return {...summary(row),instruction:row.instruction,context:row.context}}
function failure(error:unknown):NextResponse {
 if(error instanceof Invalid||error instanceof ZodError)return fail("saved_task_input_invalid",400);
 if(error instanceof SavedBotTaskConflictError)return fail("saved_task_conflict_reload_before_saving",409);
 if(error instanceof SavedBotTaskNotFoundError)return fail("saved_task_not_found",404);
 return fail("saved_task_service_unavailable",503);
}
function allowed(scope:SavedBotTaskScope,write:boolean):boolean{return consumeToken(`bot-saved-tasks:${scope.organizationId}:${scope.userId}:${write?"write":"read"}`,write?{capacity:10,tokensPerSecond:0.2}:{capacity:30,tokensPerSecond:2}).allowed}
export async function handleSavedBotTasks(request:NextRequest):Promise<NextResponse>{
 try{
  const scope=await principal(request);if(!scope)return fail("desktop_session_required",401);
  if(request.method!=="GET"&&request.method!=="POST")return fail("method_not_allowed",405);
  if(!allowed(scope,request.method==="POST"))return fail("saved_task_rate_limited",429);
  const params=query(request,request.method==="GET"?["cursor"]:[]);
  if(request.method==="GET"){
   const cursor=params.get("cursor")??undefined;if(cursor!==undefined&&!idPattern.test(cursor))throw new Invalid();
   const page=await listSavedBotTasks(db,scope,cursor);return reply({ok:true,data:{tasks:page.tasks.map(summary),nextCursor:page.nextCursor}});
  }
  const input=parseSavedBotTaskCreate(await body(request));if(!await currentScope(request,scope))return fail("desktop_session_required",401);
  return reply({ok:true,data:{task:detail(await createSavedBotTask(db,scope,input))}},201);
 }catch(error){return failure(error)}
}
export async function handleSavedBotTask(request:NextRequest,id:string):Promise<NextResponse>{
 try{
  const scope=await principal(request);if(!scope)return fail("desktop_session_required",401);
  if(!idPattern.test(id))throw new Invalid();query(request,[]);
  if(request.method!=="GET"&&request.method!=="PUT")return fail("method_not_allowed",405);
  if(!allowed(scope,request.method==="PUT"))return fail("saved_task_rate_limited",429);
  if(request.method==="GET"){const task=await getSavedBotTask(db,scope,id);return task?reply({ok:true,data:{task:detail(task)}}):fail("saved_task_not_found",404)}
  const input=parseSavedBotTaskUpdate(await body(request));if(!await currentScope(request,scope))return fail("desktop_session_required",401);
  return reply({ok:true,data:{task:detail(await updateSavedBotTask(db,scope,id,input))}});
 }catch(error){return failure(error)}
}
export async function handleSavedBotTaskHistory(request:NextRequest,id:string):Promise<NextResponse>{
 try{
  const scope=await principal(request);if(!scope)return fail("desktop_session_required",401);
  if(request.method!=="GET")return fail("method_not_allowed",405);
  if(!idPattern.test(id))throw new Invalid();const params=query(request,["beforeVersion"]);const raw=params.get("beforeVersion");
  if(raw!==null&&(!/^(0|[1-9]\d{0,9})$/.test(raw)||Number(raw)>2147483647))throw new Invalid();
  if(!allowed(scope,false))return fail("saved_task_rate_limited",429);
  const page=await listSavedBotTaskHistory(db,scope,id,raw===null?undefined:Number(raw));
  return reply({ok:true,data:{taskId:id,events:page.events.map(event=>({version:event.version,eventType:event.eventType,content:event.contentJson,occurredAt:event.occurredAt.toISOString()})),nextBeforeVersion:page.nextBeforeVersion}});
 }catch(error){return failure(error)}
}

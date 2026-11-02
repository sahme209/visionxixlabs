import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {agentRestartRepositorySchema,agentRestartTagSchema,agentRestartWorkflowSourceSchema,type AgentRestartWorkflowSource} from '@/lib/tauri/agentRestartWorkflowSource';
import {AWS_ECS_DEPLOY_WORKFLOW_FILENAME,AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE} from '@/lib/releaseops/awsEcsDeployWorkflowTemplate';
export const AGENT_RESTART_WORKFLOW_CONTENT_SHA256=createHash('sha256').update(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE).digest('hex');
const sha=z.string().regex(/^[a-f0-9]{40}$/),number=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const inputSchema=z.object({repositoryFullName:agentRestartRepositorySchema,sourceKind:z.literal('tag'),sourceRef:agentRestartTagSchema,installationToken:z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/),signal:z.custom<AbortSignal>(v=>v instanceof AbortSignal)}).strict();
export interface AgentRestartSourceObservation{readonly source:Readonly<AgentRestartWorkflowSource>;readonly observedAt:number;readonly expiresAt:number}
/** Fixed GET-only observation. Caller must obtain current tenant-scoped credentials
 * separately and bind these facts into review/current admission. No fake release
 * plan, permission callback, dispatch or credential issuer exists here. */
export async function observeAgentRestartWorkflowSource(raw:z.input<typeof inputSchema>):Promise<AgentRestartSourceObservation|null>{
 const parsed=inputSchema.safeParse(raw);if(!parsed.success)return null;const input=parsed.data;
 const controller=new AbortController(),signal=AbortSignal.any([input.signal,controller.signal]);
 const deadline=Date.now()+8000,timer=setTimeout(()=>controller.abort(),8000),budget={remainingBytes:512*1024};
 const guard=()=>{signal.throwIfAborted();if(Date.now()>=deadline)throw Error('restart_source_deadline')};
 const root='https://api.github.com/repos/'+input.repositoryFullName.split('/').map(encodeURIComponent).join('/');
 async function get(path:string):Promise<unknown>{
  guard();const url=root+path,pending=Promise.resolve().then(()=>{guard();return fetch(url,{method:'GET',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${input.installationToken}`,'X-GitHub-Api-Version':'2022-11-28'},redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal})});
  void pending.then(response=>{if(signal.aborted)void response.body?.cancel().catch(()=>{})},()=>{});
  const response=await withGithubAbort(pending,signal);guard();
  if(response.status!==200||response.redirected||response.url&&response.url!==url||response.headers.has('link')){void response.body?.cancel().catch(()=>{});throw Error('restart_source_unavailable')}
  const bytes=await readBoundedGithubBody(response,signal,128*1024,budget);guard();return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }
 try{
  const repository=z.object({id:number,full_name:z.string(),archived:z.literal(false),disabled:z.literal(false)}).passthrough().parse(await get(''));
  if(repository.full_name.toLowerCase()!==input.repositoryFullName.toLowerCase())return null;
  const tagSchema=z.object({ref:z.literal(`refs/tags/${input.sourceRef}`),object:z.object({type:z.enum(['commit','tag']),sha}).passthrough()}).passthrough();
  const tag=tagSchema.parse(await get('/git/ref/tags/'+encodeURIComponent(input.sourceRef)));
  let sourceCommitSha=tag.object.sha;
  if(tag.object.type==='tag'){
   const annotated=z.object({sha:z.literal(tag.object.sha),object:z.object({type:z.literal('commit'),sha}).passthrough()}).passthrough().parse(await get('/git/tags/'+tag.object.sha));sourceCommitSha=annotated.object.sha;
  }
  const releaseSchema=z.object({id:number,tag_name:z.literal(input.sourceRef),draft:z.literal(false),immutable:z.literal(true),published_at:z.string().datetime()}).passthrough();
  const release=releaseSchema.parse(await get('/releases/tags/'+encodeURIComponent(input.sourceRef)));
  if(Date.parse(release.published_at)>Date.now())return null;
  const workflowPath='.github/workflows/'+AWS_ECS_DEPLOY_WORKFLOW_FILENAME;
  const file=z.object({type:z.literal('file'),path:z.literal(workflowPath),encoding:z.literal('base64'),sha,size:z.number().int().min(1).max(64*1024),content:z.string().max(128*1024)}).passthrough().parse(await get('/contents/'+workflowPath+'?ref='+sourceCommitSha));
  const encoded=file.content.replace(/\r?\n/g,''),bytes=Buffer.from(encoded,'base64');
  if(bytes.toString('base64')!==encoded||bytes.length!==file.size||new TextDecoder('utf-8',{fatal:true}).decode(bytes)!==AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE)return null;
  const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');if(blob!==file.sha)return null;
  const finalTag=tagSchema.parse(await get('/git/ref/tags/'+encodeURIComponent(input.sourceRef)));
  if(finalTag.object.type!==tag.object.type||finalTag.object.sha!==tag.object.sha)return null;
  const finalRelease=releaseSchema.parse(await get('/releases/tags/'+encodeURIComponent(input.sourceRef)));
  if(finalRelease.id!==release.id||finalRelease.published_at!==release.published_at)return null;
  guard();const observedAt=Date.now();
  const source=agentRestartWorkflowSourceSchema.parse({kind:'github_immutable_restart_source_v1',repositoryFullName:input.repositoryFullName,repositoryId:String(repository.id),tagName:input.sourceRef,ref:tag.ref,tagObjectType:tag.object.type,tagObjectSha:tag.object.sha,sourceCommitSha,releaseId:String(release.id),publishedAt:release.published_at,workflowFile:AWS_ECS_DEPLOY_WORKFLOW_FILENAME,workflowBlobSha:blob,workflowContentSha256:createHash('sha256').update(bytes).digest('hex')});
  return Object.freeze({source:Object.freeze(source),observedAt,expiresAt:observedAt+10000});
 }catch{return null}finally{clearTimeout(timer);controller.abort()}
}

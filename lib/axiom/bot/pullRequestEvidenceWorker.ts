import {randomUUID} from 'node:crypto';
import {claimPullRequestEvidenceRun,finishPullRequestEvidenceRun,getPullRequestEvidenceRun,type PullRequestEvidenceRepo,type PullRequestEvidenceBinding,type PullRequestEvidenceRow} from './pullRequestEvidenceRepo';
import {parsePullRequestEvidence,matchPullRequestEvidence,botPullRequestObservationSchema} from './pullRequestEvidenceContract';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {savedBotTaskContentHash} from './savedTaskSchema';
import type {SavedBotTaskScope} from './savedTaskRepo';
export interface PullRequestEvidenceReaders {
 readAuthority(signal:AbortSignal):Promise<string|null>;
 readBinding(input:{releaseId:string;expectedReleaseVersion:number;pullRequestNumber:number},signal:AbortSignal):Promise<PullRequestEvidenceBinding|null>;
 readEvidence(binding:PullRequestEvidenceBinding,signal:AbortSignal):Promise<unknown>;
}
const terminal=(row:PullRequestEvidenceRow)=>['completed','failed','canceled','outcome_unknown'].includes(row.status);
/** Internal fixed read. No models, agent tools, arbitrary URL, retry or provider write. */
export async function runPullRequestEvidence(repo:PullRequestEvidenceRepo,scope:SavedBotTaskScope,id:string,readers:PullRequestEvidenceReaders){
 const original=await getPullRequestEvidenceRun(repo,scope,id);if(original.status!=='queued')return original;
 const workerId='worker_'+randomUUID().replaceAll('-','');
 const claimed=await claimPullRequestEvidenceRun(repo,scope,{runId:id,expectedRevision:original.revision,snapshotDigest:original.snapshotDigest,workerId});
 const worker={runId:id,expectedRevision:claimed.revision,snapshotDigest:claimed.snapshotDigest,workerId};
 const binding=claimed.snapshotJson.binding,controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let settled=false;
 const budget=Math.min(20000,claimed.deadlineAt.getTime()-Date.now(),(claimed.leaseExpiresAt?.getTime()??0)-Date.now()-5000);
 const bounded=async<T>(work:Promise<T>):Promise<T>=>{controller.signal.throwIfAborted();return await work};
 const taskCurrent=async()=>{const task=await bounded(repo.botTaskDraft.findFirst({where:{id:claimed.taskId,organizationId:scope.organizationId,createdByUserId:scope.userId}}));controller.signal.throwIfAborted();if(!task||task.id!==claimed.taskId||task.organizationId!==scope.organizationId||task.createdByUserId!==scope.userId||task.status!=='draft'||task.version!==claimed.taskVersion||task.contentHash!==claimed.snapshotJson.contentHash||savedBotTaskContentHash({title:task.title,instruction:task.instruction,context:task.context})!==task.contentHash)throw Error('stored_task_changed')};
 const sourceCurrent=async()=>{const current=await bounded(readers.readBinding({releaseId:binding.releaseId,expectedReleaseVersion:binding.releaseVersion,pullRequestNumber:binding.pullRequestNumber},controller.signal));controller.signal.throwIfAborted();if(!current||sha256ContentHash(current)!==sha256ContentHash(binding))throw Error('stored_release_changed')};
 const phase=async()=>{try{
  const before=await bounded(readers.readAuthority(controller.signal));controller.signal.throwIfAborted();if(!before)throw Error('current_access_changed');
  await taskCurrent();await sourceCurrent();
  const observation=botPullRequestObservationSchema.parse(await bounded(readers.readEvidence(binding,controller.signal)));controller.signal.throwIfAborted();
  await sourceCurrent();await taskCurrent();
  const after=await bounded(readers.readAuthority(controller.signal));controller.signal.throwIfAborted();if(!after||before!==after)throw Error('current_access_changed');
  const facts=parsePullRequestEvidence({kind:'release_pull_request_evidence_v1',authority:'evidence_only',observedAt:new Date().toISOString(),...binding,pullRequest:observation});
  if(!matchPullRequestEvidence(facts,binding))throw Error('read_unavailable');return facts;
 }finally{settled=true}};
 try{
  if(budget<=0)throw Error('read_deadline_expired');
  const timeout=new Promise<never>((_r,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('read_deadline_expired'))},budget)});
  const facts=await Promise.race([phase(),timeout]);controller.signal.throwIfAborted();
  const current=await getPullRequestEvidenceRun(repo,scope,id);controller.signal.throwIfAborted();
  if(terminal(current))return current;
  if(current.status==='cancel_requested')return await finishPullRequestEvidenceRun(repo,scope,worker,{status:'canceled',reason:'user_canceled'});
  return await finishPullRequestEvidenceRun(repo,scope,worker,{status:'completed',content:JSON.stringify(facts),observedAt:new Date(facts.observedAt)});
 }catch{
  controller.abort();const current=await getPullRequestEvidenceRun(repo,scope,id);if(terminal(current))return current;
  const status=current.status==='cancel_requested'&&settled?'canceled':settled?'failed':'outcome_unknown';
  return finishPullRequestEvidenceRun(repo,scope,worker,{status,reason:status==='canceled'?'user_canceled':status==='failed'?'read_refused':'read_deadline_expired'});
 }finally{clearTimeout(timer);controller.abort()}
}

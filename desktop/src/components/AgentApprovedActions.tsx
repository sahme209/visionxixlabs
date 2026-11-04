import {useEffect,useRef,useState} from 'react';
import type {AgentActionRecoveryResult} from '../lib/agentActionExecutionRecovery';
import {agentActionEligibilitySchema,type AgentActionEligibility,type AgentActionEligibilityResult,type AgentActionMutation,type AgentActionMutationResult} from '../lib/agentActionExecutionControls';
const REFERENCE_LABELS={github_branch:'Branch',github_commit:'Commit',github_pull_request:'Pull request',github_workflow:'Workflow reference',environment:'Environment',deployment_target:'Deployment target',identity_provider:'Identity provider'};
interface Action{id:string;toolName:string}
interface Props{actions:Action[];read:(proposalId:string,signal?:AbortSignal)=>Promise<AgentActionRecoveryResult>;eligibility?:(proposalId:string,signal?:AbortSignal)=>Promise<AgentActionEligibilityResult>;mutate?:(input:AgentActionMutation,signal?:AbortSignal)=>Promise<AgentActionMutationResult>}
const REASONS:Record<AgentActionEligibility['reason'],string>={
 ready_to_prepare:'The exact review is eligible for a saved requester action. Preparation does not execute it.',ready_to_execute:'This saved action is ready for one deliberate execution.',execution_disabled:'Requester execution is not enabled for this workspace.',requester_required:'Only the original requester can prepare or execute this action.',review_unavailable:'A current exact independent review could not be verified.',review_expired:'The exact review has expired. Read history; it cannot be reused.',current_access_required:'Current workspace or tool access could not be verified.',tool_unsupported:'This tool is not supported by the separate execution workflow.',governance_coverage_unavailable:'Required Governance enforcement is unavailable. Execution stays blocked.',operation_consumed:'This saved action has already been attempted or stopped. Read its outcome; do not resend.',operation_session_changed:'This action belongs to the original paired session. Its outcome remains readable.',workflow_incomplete:'Separate execution is not available in this service version.',unavailable:'Execution readiness could not be verified. No action was prepared or run.',
};
export function AgentApprovedActions({actions,...ports}:Props){
 return actions.length?<section aria-label="Approved Agent actions" className="space-y-3">{actions.map(action=><ApprovedAction key={action.id} action={action} {...ports}/>)}</section>:null;
}
function ApprovedAction({action,read,eligibility,mutate}:Omit<Props,'actions'>&{action:Action}){
 const [result,setResult]=useState<AgentActionRecoveryResult|null>(null),[readiness,setReadiness]=useState<AgentActionEligibility|null>(null),[busy,setBusy]=useState<'read'|'readiness'|'prepare'|'execute'|'cancel'|null>(null),[notice,setNotice]=useState(''),[uncertainCommand,setUncertainCommand]=useState<'prepare'|'execute'|'cancel'|null>(null),epoch=useRef(0),pending=useRef<AbortController|null>(null);
 const hold=uncertainCommand!==null;
 useEffect(()=>()=>{epoch.current++;pending.current?.abort()},[]);
 useEffect(()=>{if(!readiness?.expiresAt)return;const remaining=Date.parse(readiness.expiresAt)-Date.now();if(remaining<=0){setReadiness(null);setNotice('Readiness expired. Check current readiness again.');return}const timer=setTimeout(()=>{setReadiness(null);setNotice('Readiness expired. Check current readiness again.')},Math.min(remaining,2147483647));return()=>clearTimeout(timer)},[readiness]);
 async function run(kind:NonNullable<typeof busy>,work:(signal:AbortSignal,owned:()=>boolean)=>Promise<void>){
  if(pending.current)return;const generation=++epoch.current,abort=new AbortController();pending.current=abort;setBusy(kind);
  const owned=()=>generation===epoch.current&&!abort.signal.aborted;
  try{await work(abort.signal,owned)}catch{if(owned()){setReadiness(null);if(kind==='prepare'||kind==='execute'||kind==='cancel')setUncertainCommand(kind);setResult({ok:false,error:kind==='prepare'||kind==='execute'||kind==='cancel'?'Action outcome could not be confirmed. Check saved action history; do not resend.':'Saved action outcome could not be verified. No action was repeated.'})}}finally{if(owned()){pending.current=null;setBusy(null)}}
 }
 async function check(){await run('read',async(signal,owned)=>{setReadiness(null);const next=await read(action.id,signal);if(!owned())return;setResult(next);if(next.ok&&((uncertainCommand==='prepare'&&(next.data===null||next.data.proposalId===action.id&&next.data.state==='prepared'))||(next.data?.proposalId===action.id&&['confirmed','refused','unknown','cancelled'].includes(next.data.state))))setUncertainCommand(null)})}
 async function checkReady(){if(!eligibility||hold)return;await run('readiness',async(signal,owned)=>{setReadiness(null);setNotice('');const next=await eligibility(action.id,signal);if(!owned())return;if(!next.ok){setNotice(next.error);return}const parsed=agentActionEligibilitySchema.safeParse(next.data);if(!parsed.success||parsed.data.proposalId!==action.id){setNotice(REASONS.unavailable);return}setReadiness(parsed.data)})}
 async function command(input:AgentActionMutation){
  if(!mutate||hold)return;
  if(input.operation==='prepare'&&!canPrepare||input.operation==='execute'&&!canExecute||input.operation==='cancel'&&!canCancel)return;
  await run(input.operation,async(signal,owned)=>{setReadiness(null);setNotice('');const next=await mutate(input,signal);if(!owned())return;
   if(!next.ok){setUncertainCommand(next.outcomeUnconfirmed?input.operation:null);setResult({ok:false,error:next.error});return}
   if(next.data.proposalId!==action.id||(input.operation!=='prepare'&&next.data.id!==input.id)){setUncertainCommand(input.operation);setResult({ok:false,error:'Action outcome could not be confirmed. Check saved action history; do not resend.'});return}
   setResult({ok:true,data:next.data});if(input.operation==='prepare')setNotice('Saved action prepared. Check execution readiness before executing.');
  });
 }
 const saved=result?.ok?result.data:null,uncertain=saved?.state==='unknown'||saved?.state==='dispatching';
 const fresh=Boolean(readiness?.expiresAt&&Date.parse(readiness.expiresAt)>Date.now());
 const canPrepare=Boolean(mutate&&!hold&&fresh&&readiness?.canPrepare&&!saved);
 const canExecute=Boolean(mutate&&!hold&&fresh&&readiness?.canExecute&&saved?.state==='prepared'&&saved.proposalId===action.id&&saved.id===readiness.operationId);
 const canCancel=Boolean(mutate&&!hold&&saved?.state==='prepared'&&saved.proposalId===action.id);
 const heading=saved?.state==='confirmed'?'Action completed':saved?.state==='refused'?'Action refused before dispatch':saved?.state==='cancelled'?'Saved action cancelled':uncertain?'Outcome unconfirmed':'Approval recorded';
 return <article className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
  <p className="text-xs font-medium text-zinc-200">{heading}</p>
  <p className="mt-1 text-xs text-zinc-400">{(saved?.toolName??action.toolName).replaceAll('_',' ')} · proposal <span className="font-mono">{action.id}</span></p>
  {saved?.receipt?.references?.length ? <ul aria-label="Recorded action references" className="mt-2 space-y-1 break-all text-xs text-zinc-300">{saved.receipt.references.map((reference,index)=><li key={`${reference.kind}:${reference.id}:${index}`}>{REFERENCE_LABELS[reference.kind]}: {reference.id}</li>)}</ul> : null}
  <p className="mt-2 text-xs leading-5 text-zinc-400">{uncertain?'The provider outcome is not confirmed. Do not resend. This read cannot claim or repeat the action.':saved?.state==='confirmed'?'The saved execution record confirms completion. This does not establish deployment health.':saved?.state==='refused'?'The saved attempt is consumed. Review its recorded refusal; this panel cannot repeat it.':saved?.state==='cancelled'?'The unused saved execution was stopped. Its history remains available.':'No new action runs automatically. Check saved action history to verify its outcome. A saved approval alone does not establish execution eligibility.'}</p>
  {result?.ok&&result.data===null&&<p role="status" className="mt-2 text-xs text-zinc-400">No saved execution record was found for this requester. No action was prepared or run.</p>}
  {result&&!result.ok&&<p role="alert" className="mt-2 text-xs text-amber-200">{result.error}</p>}
  {hold&&<p className="mt-2 text-xs text-amber-200">Only read-only outcome checks are available until this uncertain response is reconciled. Do not resend.</p>}
  {notice&&<p role="status" className="mt-2 text-xs text-zinc-400">{notice}</p>}
  {readiness&&<div className="mt-3 space-y-1 text-xs text-zinc-400"><p>{REASONS[readiness.reason]}</p>{fresh&&readiness.effect&&(readiness.canPrepare||readiness.canExecute)&&<><p className="font-medium text-zinc-200">Exact reviewed change</p><p>{readiness.effect}</p><p>Review expires {readiness.expiresAt}</p></>}{readiness.canExecute&&!canExecute&&<p>Check saved action outcome to verify the original prepared record before execution.</p>}</div>}
  {saved&&<p className="mt-2 text-[11px] text-zinc-500">Attempt {saved.attemptCount} · last checked {saved.observedAt}{saved.recoveryState==='lease_elapsed_unconfirmed'?' · worker lease elapsed; outcome still unconfirmed':''}</p>}
  <div className="mt-3 flex flex-wrap gap-2">
   <button data-help-id="agent.workspace.action-outcome" type="button" disabled={busy!==null} onClick={()=>void check()} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50">{busy==='read'?'Checking saved outcome…':'Check saved action outcome'}</button>
   {eligibility&&!hold&&<button data-help-id="agent.workspace.action-readiness" type="button" disabled={busy!==null} onClick={()=>void checkReady()} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50">{busy==='readiness'?'Checking readiness…':'Check execution readiness'}</button>}
   {canPrepare&&<button data-help-id="agent.workspace.action-prepare" type="button" disabled={busy!==null} onClick={()=>void command({operation:'prepare',proposalId:action.id})} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-50">Prepare reviewed action</button>}
   {canExecute&&<button data-help-id="agent.workspace.action-execute" type="button" disabled={busy!==null} onClick={()=>void command({operation:'execute',id:saved!.id})} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-50">Execute approved action once</button>}
   {canCancel&&<button data-help-id="agent.workspace.action-cancel" type="button" disabled={busy!==null} onClick={()=>void command({operation:'cancel',id:saved!.id})} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50">Cancel unused action</button>}
  </div>
 </article>;
}

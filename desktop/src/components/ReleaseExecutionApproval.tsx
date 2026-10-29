import {useEffect,useRef,useState} from 'react';
import {desktopClient} from '../lib/desktopClient';
import {isExecutionApprovalState,type ExecutionApprovalState} from '../lib/releaseExecutionApprovalContract';
const recovery='Reload execution approval to confirm its outcome. If the plan changed, read and save a fresh plan.';
export function ReleaseExecutionApproval({requestId,planId,planDigest}:{requestId:string;planId:string;planDigest:string}){
 const config=useRef(desktopClient.config).current,revision=useRef(desktopClient.getContextRevision()).current;
 const mounted=useRef(true),flight=useRef<AbortController|null>(null);const[state,setState]=useState<ExecutionApprovalState>(),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(false),[stale,setStale]=useState(false);
 useEffect(()=>{mounted.current=true;const unsubscribe=desktopClient.subscribeContext(()=>{flight.current?.abort();setState(undefined);setStale(true)});return()=>{mounted.current=false;flight.current?.abort();unsubscribe()}},[]);
 async function run(kind:'read'|'approve'|'revoke'){
  if(flight.current||stale||kind!=='read'&&uncertain||kind==='approve'&&(!state?.canApprove||state.approval)||kind==='revoke'&&(!state?.approval?.canRevoke||state.approval.version!==0))return;
  const controller=new AbortController();flight.current=controller;setBusy(true);setError(false);if(kind!=='read')setUncertain(true);
  const owns=()=>mounted.current&&!controller.signal.aborted&&flight.current===controller&&desktopClient.config===config&&desktopClient.getContextRevision()===revision;
  try{const result=kind==='read'?await desktopClient.releaseExecutionApproval(requestId,planId,planDigest,controller.signal):kind==='approve'?await desktopClient.approveReleaseExecution(requestId,planId,planDigest,{expectedPlanVersion:1,clientRequestId:crypto.randomUUID()},controller.signal):await desktopClient.revokeReleaseExecutionApproval(requestId,planId,planDigest,{id:state!.approval!.id,expectedVersion:0,clientRequestId:crypto.randomUUID()},controller.signal);
   if(!owns())return;if(result.ok&&isExecutionApprovalState(result.data,planId,planDigest)){setState(result.data);setUncertain(false)}else{setError(true);if(kind==='read')setState(undefined)}
  }catch{if(owns()){setError(true);if(kind==='read')setState(undefined)}}finally{if(flight.current===controller){flight.current=null;if(mounted.current)setBusy(false)}}
 }
 return <section aria-label="Independent execution approval" className="space-y-2 border-t border-white/10 pt-3">
  <h5 className="font-medium text-zinc-200">Independent execution approval</h5>
  <p className="text-xs leading-5 text-zinc-500">Separate from advisory review. The release requester is the designated executor. Approval supports local simulation only; real merge and deployment remain unavailable.</p>
  {stale?<p className="text-xs text-zinc-400">Workspace changed. Reopen this release.</p>:<><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('read')}>Reload execution approval</button>
  {busy&&<p role="status" className="text-xs text-zinc-400">Confirming execution approval…</p>}{(error||uncertain)&&<p role="alert" className="text-xs text-zinc-300">{recovery}</p>}
  {state&&<>{!state.enabled&&<p className="text-xs text-zinc-400">Execution approval is not enabled on this service.</p>}{state.approval?<><p className="text-xs text-zinc-300">{state.approval.status==='approved'?'Independently approved for simulation':state.approval.status==='consumed'?'Consumed by one simulation':state.approval.status==='revoked'?'Approval revoked':'Plan needs refreshing'}</p><p className="text-xs text-zinc-500">Expires {new Date(state.approval.expiresAt).toLocaleString()}</p>{state.approval.canRevoke&&state.approval.version===0&&<button type="button" className="btn-secondary" disabled={busy||uncertain} onClick={()=>void run('revoke')}>Revoke execution approval</button>}</>:<><p className="text-xs text-zinc-500">No execution approval recorded.</p>{state.enabled&&state.canApprove?<button type="button" className="btn-secondary" disabled={busy||uncertain} onClick={()=>void run('approve')}>Approve exact plan for simulation</button>:state.enabled&&<p className="text-xs text-zinc-400">A different eligible person must approve this exact plan.</p>}</>}</>}
  </>}
 </section>;
}

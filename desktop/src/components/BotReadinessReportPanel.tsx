import {useEffect,useRef,useState} from 'react';
import {RecordedReportContent} from './RecordedReportContent';
import {isReadinessReportResponse} from '../../../lib/axiom/bot/readinessRunDto';
import {desktopClient} from '../lib/desktopClient';
import type {SavedBotTaskDto} from '../../../lib/axiom/bot/savedTaskContract';
import type {ReadinessCapabilitiesDto,ReadinessRunDto,ReadinessRunResponseDto,ReadinessReportResponseDto} from '../../../lib/axiom/bot/readinessRunDto';
interface Props {task:SavedBotTaskDto|null;dirty:boolean;active:boolean}
const terminal=(run:ReadinessRunDto)=>!['queued','running','cancel_requested'].includes(run.status);
const labels:Record<ReadinessRunDto['status'],string>={queued:'Queued',running:'Reading recorded metadata',completed:'Report saved',failed:'Report could not finish',canceled:'Canceled',cancel_requested:'Stop requested',needs_attention:'Start deadline expired',outcome_unknown:'Interrupted — outcome unconfirmed'};
/** Key this component by saved task id/version. Local recovery stores only a
 * request UUID, never instructions, credentials, provider payloads or reports. */
export function BotReadinessReportPanel({task,dirty,active}:Props){
 const config=useRef(desktopClient.config).current,revision=useRef(desktopClient.getContextRevision()).current;
 const mounted=useRef(true),operation=useRef<AbortController|null>(null),requestId=useRef<string|null>(null),recoveryLoaded=useRef(false);
 const [capabilities,setCapabilities]=useState<ReadinessCapabilitiesDto>(),[runs,setRuns]=useState<ReadinessRunDto[]>([]),[truncated,setTruncated]=useState(false),[loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState<'load'|'start'|'check'|'cancel'>(),[confirmed,setConfirmed]=useState(false),[error,setError]=useState<string>(),[run,setRun]=useState<ReadinessRunDto>(),[report,setReport]=useState<ReadinessReportResponseDto['report']>(null),[unconfirmed,setUnconfirmed]=useState(false);
 const recoveryKey=task?`axiom-readiness-pending:${config.apiBase}:${task.id}:${task.version}`:null;
 const owns=(controller:AbortController)=>mounted.current&&operation.current===controller&&!controller.signal.aborted&&desktopClient.config===config&&desktopClient.getContextRevision()===revision;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current?.abort();operation.current=null}},[]);
 useEffect(()=>{if(!active){operation.current?.abort();operation.current=null;setBusy(undefined)}},[active]);
 function begin(kind:NonNullable<typeof busy>){if(!active)return null;if(operation.current&&kind!=='cancel')return null;if(kind==='cancel')operation.current?.abort();const controller=new AbortController();operation.current=controller;setBusy(kind);setError(undefined);return controller}
 function finish(controller:AbortController){if(operation.current===controller){operation.current=null;if(mounted.current)setBusy(undefined)}}
 function recoverReference(){
  if(recoveryLoaded.current||!recoveryKey||!task)return;
  const raw=localStorage.getItem(recoveryKey);if(raw===null){recoveryLoaded.current=true;return}
  const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||!('clientRequestId' in value)||typeof value.clientRequestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.clientRequestId))throw new Error('invalid recovery reference');
  requestId.current=value.clientRequestId;recoveryLoaded.current=true;setUnconfirmed(true);
 }
 function clearReference(){if(recoveryKey)localStorage.removeItem(recoveryKey);requestId.current=null;setUnconfirmed(false)}
 async function apply(data:ReadinessRunResponseDto,controller:AbortController,resolvePending=false){
  if(!owns(controller)||!task||data.run.taskId!==task.id)return;
  if(report?.id!=='botartifact_'+data.run.id.slice(7))setReport(null);
  setRun(data.run);setRuns(previous=>[data.run,...previous.filter(r=>r.id!==data.run.id)].slice(0,5));
  if(data.run.status==='completed'){
   const detail=isReadinessReportResponse(data)?{ok:true as const,data}:await desktopClient.getReadinessReport(data.run.id,controller.signal);if(!owns(controller))return;
   if(!detail.ok){setError(detail.error);return}setReport(detail.data.report);if(resolvePending)clearReference();
  }else{setReport(null);if(terminal(data.run)){if(resolvePending)clearReference()}else setUnconfirmed(true)}
 }
 async function load(){
  const controller=begin('load');if(!controller||!task)return;
  try{
   try{recoverReference()}catch{setError('Stored report recovery needs attention. Check recent reports before starting another.')}
   const cap=await desktopClient.readinessCapabilities(controller.signal);if(!owns(controller))return;
   if(!cap.ok){setError(cap.error);return}setCapabilities(cap.data);
   const list=await desktopClient.readinessReportsForTask(task.id,controller.signal);if(!owns(controller))return;
   if(list.ok){setRuns(list.data.runs);setTruncated(list.data.truncated)}else setError(list.error);
  }catch{if(owns(controller))setError('Report recovery is unavailable. Your saved task is retained; check recent reports before starting another.')}
  finally{if(owns(controller))setLoaded(true);finish(controller)}
 }
 useEffect(()=>{if(active&&task&&!loaded&&!operation.current)void load()},[active,task?.id,loaded]);
 async function start(){
  if(!task||dirty||!confirmed||!capabilities?.canStart||run&&!terminal(run))return;
  const controller=begin('start');if(!controller)return;
  try{
   recoverReference();if(!requestId.current){const id=crypto.randomUUID();if(!recoveryKey)throw new Error('recovery unavailable');localStorage.setItem(recoveryKey,JSON.stringify({clientRequestId:id}));requestId.current=id}
   setUnconfirmed(true);
   const result=await desktopClient.createReadinessReport({taskId:task.id,expectedVersion:task.version,adapter:'workspace_readiness_v1',clientRequestId:requestId.current,confirmRecordedMetadata:true},controller.signal);if(!owns(controller))return;
   if(result.ok){await apply(result.data,controller,true);setConfirmed(false)}else{setError(result.error);/* Keep the original identity until its stored outcome is confirmed. */}
  }catch{if(owns(controller))setError('The report outcome is unconfirmed. Check the same report before another attempt.')}
  finally{finish(controller)}
 }
 async function check(id?:string,cancel=false){
  const controller=begin(cancel?'cancel':'check');if(!controller)return;
  try{
   let current=run;
   if(id){if(report?.id!=='botartifact_'+id.slice(7))setReport(null);const result=await desktopClient.getReadinessReport(id,controller.signal);if(!owns(controller))return;if(!result.ok){setError(result.error);return}await apply(result.data,controller);return}
   if(requestId.current){const found=await desktopClient.findReadinessReport(requestId.current,controller.signal);if(!owns(controller))return;if(!found.ok){setError(found.error);return}current=found.data.run}
   if(!current){setError('No confirmed report was found. Retry the same report request.');return}
   if(cancel&&!terminal(current)){const result=await desktopClient.cancelReadinessReport(current.id,current.revision,controller.signal);if(!owns(controller))return;if(!result.ok){setError(result.error);return}await apply(result.data,controller,true)}
   else{const result=await desktopClient.getReadinessReport(current.id,controller.signal);if(!owns(controller))return;if(result.ok)await apply(result.data,controller,true);else setError(result.error)}
  }catch{if(owns(controller))setError('The current report could not be checked. Your saved task is retained.')}
  finally{finish(controller)}
 }
 if(!task)return <><h2 className="text-sm font-medium text-zinc-200">No task outputs yet.</h2><p className="mt-3 text-xs leading-6 text-zinc-500">Save a task draft to prepare a recorded workspace report. General AI and computer execution are separate capabilities.</p></>;
 return <section aria-label="Recorded readiness report" className="space-y-4">
  <div><h2 className="text-sm font-medium text-zinc-200">Recorded workspace metadata only</h2><p className="mt-2 text-xs leading-6 text-zinc-400">Current workspace access, recorded app connections and the latest 25 releases. No AI model or connected app is contacted. This does not execute your saved instructions.</p></div>
  {!capabilities&&busy==='load'&&<p role="status" className="text-xs text-zinc-400">Checking report availability…</p>}
  {capabilities&&!capabilities.enabled&&<p className="text-xs text-zinc-400">Reports are not enabled for this service yet.</p>}
  {dirty&&<p className="text-xs text-zinc-400">Save your changes before creating a report.</p>}
  <label className="flex items-start gap-2 text-xs leading-5 text-zinc-400"><input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={event=>setConfirmed(event.target.checked)} />I confirm this report uses recorded workspace metadata only.</label>
  <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={!confirmed||dirty||!capabilities?.canStart||Boolean(busy)||Boolean(run&&!terminal(run))} onClick={()=>void start()}>{unconfirmed&&requestId.current?'Retry same report':'Create readiness report'}</button><button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={()=>void load()}>Refresh reports</button>{(unconfirmed||run)&&<button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={()=>void check()}>Check report</button>}{(busy==='start'||run&&['queued','running','cancel_requested'].includes(run.status))&&<button type="button" className="btn-secondary" disabled={busy==='cancel'} onClick={()=>void check(undefined,true)}>Cancel report</button>}</div>
  {busy==='start'&&<p role="status" className="text-xs text-zinc-400">Creating the recorded report…</p>}
  {run&&<p role="status" className="text-xs text-zinc-400">{labels[run.status]} · saved task version {run.taskVersion}</p>}
  {error&&<p role="alert" className="text-xs leading-5 text-zinc-300">{error}</p>}
  {report?<article aria-label="Saved readiness report" className="rounded-xl border border-white/10 p-3"><p className="mb-3 text-xs text-zinc-500">Observed {new Date(report.observedAt).toLocaleString()}</p><RecordedReportContent content={report.content}/></article>:<p className="text-xs text-zinc-500">No task outputs yet.</p>}
  {runs.length>0&&<div className="space-y-2"><h3 className="text-xs font-medium text-zinc-400">Recent reports{truncated?' · latest five':''}</h3>{runs.map(item=><button key={item.id} type="button" className="block w-full rounded-lg border border-white/10 p-2 text-left text-xs text-zinc-400" disabled={Boolean(busy)} aria-label={`Open report from version ${item.taskVersion}`} onClick={()=>void check(item.id)}>Version {item.taskVersion} · {labels[item.status]} · {new Date(item.createdAt).toLocaleString()}</button>)}</div>}
 </section>;
}

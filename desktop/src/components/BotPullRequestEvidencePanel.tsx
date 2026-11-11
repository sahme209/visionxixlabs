import {useEffect,useRef,useState} from 'react';
import type {SavedBotTaskDto} from '../../../lib/axiom/bot/savedTaskContract';
import type {BotPrCapabilitiesDto,BotPrEvidenceResponseDto,BotPrRunDto,BotPrRunResponseDto} from '../../../lib/axiom/bot/pullRequestEvidenceDto';
import {isBotPrUuid,parseBotPrEvidence} from '../../../lib/axiom/bot/pullRequestEvidenceDto';
import type {BotAiEvidenceContext} from '../../../lib/axiom/bot/aiTaskDto';
import type {ReleaseMergeTargets} from '../lib/releaseMergeContract';
import {desktopClient} from '../lib/desktopClient';
export interface SelectedBotEvidence {taskId:string;taskVersion:number;observedAt:string;repositoryFullName:string;pullRequestNumber:number;evidenceContext:BotAiEvidenceContext}
interface Props {onSelectEvidence?:(value:SelectedBotEvidence)=>void;selectionDisabled?:boolean;ownerKey:string;task:SavedBotTaskDto|null;dirty:boolean;active:boolean}
const terminal=(run:BotPrRunDto)=>!['queued','running','cancel_requested'].includes(run.status);
const labels:Record<BotPrRunDto['status'],string>={queued:'Preparing read',running:'Reading pull request evidence',cancel_requested:'Stop requested',completed:'Evidence saved',failed:'Read could not finish',canceled:'Canceled',outcome_unknown:'Read interrupted — check its outcome'};
/** A separate fixed app read. Never sends the instruction to a model or grants write authority. */
export function BotPullRequestEvidencePanel({ownerKey,task,dirty,active,onSelectEvidence,selectionDisabled=false}:Props){
 const initialOwner=useRef(ownerKey).current;
 const config=useRef(desktopClient.config).current,revision=useRef(desktopClient.getContextRevision()).current;
 const mounted=useRef(true),op=useRef<AbortController|null>(null),pending=useRef<string|null>(null),recoveryScope=useRef<string|null>(null);
 const [cap,setCap]=useState<BotPrCapabilitiesDto>(),[loaded,setLoaded]=useState(false),[listReady,setListReady]=useState(false),[stale,setStale]=useState(false),[busy,setBusy]=useState(false),[starting,setStarting]=useState(false),[error,setError]=useState<string>();
 const [releases,setReleases]=useState<Array<{id:string;title:string;version:number;status:string}>>([]),[releaseId,setReleaseId]=useState(''),[targets,setTargets]=useState<ReleaseMergeTargets>(),[pr,setPr]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [runs,setRuns]=useState<BotPrRunDto[]>([]),[truncated,setTruncated]=useState(false),[run,setRun]=useState<BotPrRunDto>(),[evidence,setEvidence]=useState<BotPrEvidenceResponseDto['evidence']>(null),[uncertain,setUncertain]=useState(false);
 const [selection,setSelection]=useState<BotPrEvidenceResponseDto['selection']>(null);
 const blocked=uncertain||Boolean(run&&(!terminal(run)||run.status==='outcome_unknown'))||runs.some(item=>!terminal(item)||item.status==='outcome_unknown');
 const recoveryKey=()=>task&&recoveryScope.current?`axiom-bot-pr-pending:${encodeURIComponent(config.apiBase)}:${recoveryScope.current}:${task.id}:${task.version}`:null;
 const owns=(controller:AbortController)=>mounted.current&&ownerKey===initialOwner&&op.current===controller&&!controller.signal.aborted&&desktopClient.config===config&&desktopClient.getContextRevision()===revision;
 useEffect(()=>{mounted.current=true;const stop=desktopClient.subscribeContext(()=>{op.current?.abort();op.current=null;setStale(true);setBusy(false);setStarting(false)});return()=>{mounted.current=false;op.current?.abort();op.current=null;stop()}},[]);
 useEffect(()=>{if(!active){op.current?.abort();op.current=null;setBusy(false);setStarting(false)}},[active]);
 function begin(){if(op.current||stale||!active)return null;const controller=new AbortController();op.current=controller;setBusy(true);setError(undefined);return controller}
 function finish(controller:AbortController){if(op.current===controller){op.current=null;if(mounted.current)setBusy(false)}}
 function readPending(){const key=recoveryKey();if(!key)return;const value=localStorage.getItem(key);if(value!==null){if(!isBotPrUuid(value))throw new Error('invalid pending reference');pending.current=value;setUncertain(true)}}
 function clearPending(){const key=recoveryKey();if(key)localStorage.removeItem(key);pending.current=null;setUncertain(false)}
 async function apply(data:BotPrRunResponseDto,controller:AbortController,resolve=false){
  if(!owns(controller)||!task||data.run.taskId!==task.id||(resolve&&data.run.taskVersion!==task.version)){if(owns(controller))setError('The returned read belongs to another task. Refresh saved reads.');return}
  setRun(data.run);setEvidence(null);setSelection(null);setRuns(old=>[data.run,...old.filter(r=>r.id!==data.run.id)].slice(0,5));
  if(data.run.status==='completed'){
   const result=await desktopClient.getBotPrEvidence(data.run.id,controller.signal);if(!owns(controller))return;
   if(!result.ok){setError(result.error);return}
   if(result.data.run.taskId!==task.id||(resolve&&data.run.taskVersion!==task.version)){setError('Evidence does not match this task.');return}
   setRun(result.data.run);setEvidence(result.data.evidence);setSelection(result.data.selection??null);
  }
  if(resolve&&terminal(data.run)&&data.run.status!=='outcome_unknown')clearPending();
 }
 async function load(){const controller=begin();if(!controller||!task)return;setListReady(false);setReleaseId('');setTargets(undefined);setPr('');setConfirmed(false);try{
  const capability=await desktopClient.botPrCapabilities(controller.signal);if(!owns(controller))return;
  if(!capability.ok){setCap(undefined);setError('Release evidence reads are unavailable on this service. Your task is retained.');return}setCap(capability.data);recoveryScope.current=capability.data.recoveryScope;
  try{readPending()}catch{setUncertain(true);setError('Saved read recovery needs attention. Review recent reads before starting another.')}
  const list=await desktopClient.botPrRunsForTask(task.id,controller.signal);if(!owns(controller))return;
  if(list.ok){setListReady(true);setRuns(list.data.runs);setRun(previous=>previous?list.data.runs.find(item=>item.id===previous.id)??previous:previous);setTruncated(list.data.truncated)}else setError(list.error);
  if(capability.data.canStart){const result=await desktopClient.botPrReleases(controller.signal);if(!owns(controller))return;if(result.ok)setReleases(result.data.filter(r=>r.status==='submitted'));else setError(result.error)}else{setReleases([]);setReleaseId('');setTargets(undefined);setPr('');setConfirmed(false)}
 }catch{if(owns(controller))setError('Evidence reads could not be loaded. Your saved task is retained.')}finally{if(owns(controller))setLoaded(true);finish(controller)}}
 useEffect(()=>{if(active&&task&&!loaded&&!op.current)void load()},[active,task?.id,loaded]);
 async function chooseRelease(id:string){setReleaseId(id);setTargets(undefined);setPr('');setConfirmed(false);const release=releases.find(r=>r.id===id);if(!release)return;const controller=begin();if(!controller)return;try{const result=await desktopClient.botPrTargets(id,release.version,controller.signal);if(!owns(controller))return;if(result.ok)setTargets(result.data);else setError(result.error)}finally{finish(controller)}}
 async function start(){
  const release=releases.find(r=>r.id===releaseId),number=Number(pr);
  if(!task||dirty||!listReady||!cap?.canStart||!confirmed||blocked||pending.current||run&&!terminal(run)||!release||!targets||targets.requestId!==release.id||targets.requestVersion!==release.version||!targets.targets.some(t=>t.number===number))return;
  const controller=begin();if(!controller)return;try{
   readPending();if(pending.current){setError('Check the saved read before starting another.');return}
   const key=recoveryKey();if(!key)throw new Error('no recovery key');const id=crypto.randomUUID();localStorage.setItem(key,id);pending.current=id;setUncertain(true);setEvidence(null);setSelection(null);setStarting(true);
   const result=await desktopClient.createBotPrEvidence({taskId:task.id,expectedVersion:task.version,releaseId:release.id,expectedReleaseVersion:release.version,pullRequestNumber:number,clientRequestId:id,confirmRead:true},controller.signal);
   if(!owns(controller))return;if(result.ok){await apply(result.data,controller,true);setConfirmed(false)}else{setError(result.error);/* Never redispatch an uncertain identity automatically. */}
  }catch{if(owns(controller))setError('The read outcome is unconfirmed. Check the saved read before another action.')}finally{if(owns(controller))setStarting(false);finish(controller)}
 }
 async function check(id?:string,cancel=false){if(cancel&&starting&&op.current){op.current.abort();op.current=null;setStarting(false)}const controller=begin();if(!controller||!task)return;try{
  readPending();let current=run;let resolvingPending=false;
  if(id){const result=await desktopClient.getBotPrEvidence(id,controller.signal);if(!owns(controller))return;if(!result.ok){setError(result.error);return}if(!cancel){await apply(result.data,controller);return}current=result.data.run}
  else if(pending.current){const found=await desktopClient.findBotPrEvidence(pending.current,controller.signal);if(!owns(controller))return;if(!found.ok){setError(found.error);return}current=found.data.run;resolvingPending=true}
  if(!current||current.taskId!==task.id||(resolvingPending&&current.taskVersion!==task.version)){setError('No matching read is confirmed for this saved version. Review recent reads.');return}
  const result=cancel&&!terminal(current)?await desktopClient.cancelBotPrEvidence(current.id,current.revision,controller.signal):await desktopClient.getBotPrEvidence(current.id,controller.signal);
  if(!owns(controller))return;if(result.ok)await apply(result.data,controller,resolvingPending);else setError(result.error);
 }catch{if(owns(controller))setError('The existing read could not be checked. Your task is retained.')}finally{finish(controller)}}
 const card=evidence?parseBotPrEvidence(evidence.content):null;
 if(stale)return <p role="status" className="text-xs text-zinc-400">Workspace changed. Reopen this task to review evidence.</p>;
 if(!task)return <p className="text-xs text-zinc-500">Save a task to read a release’s pull request evidence.</p>;
 return <section aria-label="Read release evidence" className="space-y-3 border-t border-white/10 pt-4">
  <h2 className="text-sm font-medium text-zinc-200">Read release evidence</h2><p className="text-xs leading-5 text-zinc-400">Read a stored release target using the existing GitHub connection. No AI call or changes. Evidence is a snapshot, never approval or readiness.</p>
  {busy&&!loaded&&<p role="status" className="text-xs text-zinc-500">Checking evidence availability…</p>}
  {cap&&!cap.enabled&&<p className="text-xs text-zinc-400">Release evidence reads are not enabled on this service yet.</p>}
  {cap?.enabled&&!cap.canStart&&<p className="text-xs text-zinc-400">A current GitHub connection and read permissions are required. Review shared connections in Connect apps.</p>}
  {dirty&&<p className="text-xs text-zinc-400">Save your changes before reading evidence for this task.</p>}
  {cap?.canStart&&<><label className="block text-xs text-zinc-400">Submitted release<select aria-label="Evidence release" className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 p-2" disabled={busy||dirty||blocked} value={releaseId} onChange={e=>void chooseRelease(e.target.value)}><option value="">Choose a release</option>{releases.map(r=><option key={r.id} value={r.id}>{r.title} · version {r.version}</option>)}</select></label>{releases.length===0&&<p className="text-xs text-zinc-500">No submitted releases are available. Prepare one in Releases.</p>}
  {targets&&<label className="block text-xs text-zinc-400">Stored pull request<select aria-label="Evidence pull request" className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 p-2" disabled={busy||dirty||blocked} value={pr} onChange={e=>{setPr(e.target.value);setConfirmed(false)}}><option value="">Choose a pull request</option>{targets.targets.map(t=><option key={t.number} value={t.number}>{targets.repositoryFullName} #{t.number}</option>)}</select></label>}
  <label className="flex items-start gap-2 text-xs leading-5 text-zinc-400"><input type="checkbox" checked={confirmed} disabled={busy||dirty||!pr||blocked} onChange={e=>setConfirmed(e.target.checked)}/>Read pull request evidence only — no changes.</label>
  <button type="button" className="btn-secondary" disabled={busy||dirty||!listReady||blocked||!confirmed||!pr||!targets} onClick={()=>void start()}>Read evidence</button></>}
  <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void load()}>Refresh evidence</button>{(blocked||run)&&<button type="button" className="btn-secondary" disabled={busy} onClick={()=>void check()}>Check saved read</button>}{(starting||run&&!terminal(run))&&<button type="button" className="btn-secondary" disabled={!starting&&(busy||run?.status==='cancel_requested')} onClick={()=>void check(starting?undefined:run?.id,true)}>Cancel read</button>}</div>
  {busy&&loaded&&<p role="status" className="text-xs text-zinc-400">Checking the saved read…</p>}{run&&<p role="status" className="text-xs text-zinc-400">{labels[run.status]} · task version {run.taskVersion}</p>}
  {blocked&&<p className="text-xs leading-5 text-zinc-400">Check the existing read before starting another. No read is automatically retried.</p>}{error&&<p role="alert" className="text-xs leading-5 text-zinc-300">{error}</p>}
  {evidence&&<article aria-label="Saved pull request evidence" className="rounded-xl border border-white/10 p-3"><p className="mb-3 text-xs text-zinc-500">Observed {new Date(evidence.observedAt).toLocaleString()}</p>{card?<>{onSelectEvidence&&selection&&run?.status==='completed'&&run.taskId===task.id&&run.taskVersion===task.version&&!dirty&&<button type="button" className="btn-secondary mb-3" disabled={busy||selectionDisabled} onClick={()=>onSelectEvidence({taskId:task.id,taskVersion:task.version,observedAt:evidence.observedAt,repositoryFullName:card.repositoryFullName,pullRequestNumber:card.pullRequestNumber,evidenceContext:{...selection,confirmUse:true}})}>Use in next AI response</button>}<h3 className="wrap-break-word text-sm font-medium text-zinc-200">{card.repositoryFullName} #{card.pullRequestNumber}</h3><dl className="mt-3 space-y-3 wrap-break-word text-xs text-zinc-400">{[['State',`${card.pullRequest.state}${card.pullRequest.draft?' · draft':''}${card.pullRequest.merged?' · merged':''}`],['Head',`${card.pullRequest.headRepositoryFullName} · ${card.pullRequest.headRef}`],['Head SHA',card.pullRequest.headSha],['Base',card.pullRequest.baseRef],['Base SHA',card.pullRequest.baseSha],['Release',`${card.releaseId} · version ${card.releaseVersion}`],['Release digest',card.releaseDigest],['Connection revision',card.connectionRevision]].map(([label,value])=><div key={label}><dt className="text-zinc-500">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>)}</dl><p className="mt-4 text-xs text-zinc-500">Observed evidence only. Source may have changed; this does not authorize a merge or deployment.</p></>:<p className="text-xs text-zinc-400">The recorded evidence format could not be verified. Refresh this saved read.</p>}</article>}
  {runs.length>0&&<div className="space-y-2"><h3 className="text-xs font-medium text-zinc-400">Recent evidence reads{truncated?' · latest five':''}</h3>{runs.map(item=><button type="button" key={item.id} className="block w-full rounded-lg border border-white/10 p-2 text-left text-xs text-zinc-400" disabled={busy} onClick={()=>void check(item.id)}>Task version {item.taskVersion} · {labels[item.status]} · {new Date(item.createdAt).toLocaleString()}</button>)}</div>}
 </section>;
}

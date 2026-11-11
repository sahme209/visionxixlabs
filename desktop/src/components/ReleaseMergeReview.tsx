import {ReleaseOperationPlans} from './ReleaseOperationPlans';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import {isReleaseMergeTargets,isReleaseMergePlanEvidence,type ReleaseMergeTargets,type ReleaseMergePlanEvidence,type ReleaseMergeMethod} from '../lib/releaseMergeContract';

export function ReleaseMergeReview({requestId,version}:{requestId:string;version:number}){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const key=JSON.stringify([requestId,version,revision]);
 const owner=useRef<string|null>(key);owner.current=key;
 useEffect(()=>{owner.current=key;return()=>{owner.current=null}},[key]);
 type Entry={key:string;config:typeof desktopClient.config;busy:boolean;targets?:ReleaseMergeTargets;number?:string;method?:ReleaseMergeMethod|'';plan?:ReleaseMergePlanEvidence;error?:string};
 const [entry,setEntry]=useState<Entry>();
 const flight=useRef<{key:string;config:typeof desktopClient.config}|null>(null);
 const current=entry?.key===key&&entry.config===desktopClient.config?entry:undefined;
 async function perform(mode:'targets'|'plan'){
  const config=desktopClient.config,selected=key,before=current;
  if(flight.current?.key===selected&&flight.current.config===config)return;
  const number=Number(before?.number),method=before?.method,repository=before?.targets?.repositoryFullName;
  if(mode==='plan'&&(!repository||!method||!before?.targets?.targets.some(t=>t.number===number)))return;
  const operation={key:selected,config};flight.current=operation;
  const owned=()=>owner.current===selected&&desktopClient.config===config;
  setEntry({...before,key:selected,config,busy:true,plan:undefined,error:undefined});
  try{
   if(mode==='targets'){
    const result=await desktopClient.releaseMergeTargets(requestId,version);
    if(!owned())return;
    if(result.ok&&isReleaseMergeTargets(result.data,requestId,version))setEntry({key:selected,config,busy:false,targets:result.data,number:'',method:''});
    else setEntry({key:selected,config,busy:false,error:'Linked pull requests are unavailable. Refresh the release and try again.'});
   }else{
    const result=await desktopClient.releaseMergePlan(requestId,version,number,method as ReleaseMergeMethod,repository!);
    if(!owned())return;
    if(result.ok&&isReleaseMergePlanEvidence(result.data,requestId,version,number,method as ReleaseMergeMethod,repository!))setEntry({...before,key:selected,config,busy:false,plan:result.data});
    else setEntry({...before,key:selected,config,busy:false,plan:undefined,error:'Merge evidence is unavailable or changed. Refresh the linked pull requests.'});
   }
  }catch{if(owned())setEntry({...before,key:selected,config,busy:false,plan:undefined,error:'Merge evidence could not be read. Refresh the linked pull requests.'})}
  finally{if(flight.current===operation)flight.current=null}
 }
 const targets=current?.targets,plan=current?.plan?.plan;
 return <section aria-label="Merge review" className="mt-3 rounded-lg border border-white/10 p-3 text-xs text-zinc-300">
  <div className="flex items-center justify-between gap-3"><p className="font-medium text-zinc-100">Merge review</p><button type="button" disabled={current?.busy} onClick={()=>void perform('targets')} className="rounded-sm border border-white/15 px-3 py-1.5 disabled:opacity-50">{current?.busy?'Reading…':targets?'Refresh merge targets':'Review merge'}</button></div>
  <p className="mt-1 text-zinc-500">Review only. No merge will run.</p>
  {current?.error&&<p role="alert" className="mt-2 text-amber-200">{current.error}</p>}
  {targets&&<div className="mt-3 space-y-3">
   <p>{targets.repositoryFullName}</p>
   <div className="flex flex-wrap items-end gap-3">
    <label className="grid gap-1">Linked pull request<select aria-label="Linked pull request" disabled={current?.busy} value={current?.number??''} onChange={event=>{const value=event.target.value;setEntry({...current!,number:targets.targets.some(t=>String(t.number)===value)?value:'',plan:undefined,error:undefined})}} className="rounded-sm border border-white/15 bg-zinc-900 px-2 py-1.5"><option value="">Choose a pull request</option>{targets.targets.map(t=><option key={t.number} value={t.number}>#{t.number}</option>)}</select></label>
    <label className="grid gap-1">Merge method<select aria-label="Merge method" disabled={current?.busy} value={current?.method??''} onChange={event=>{const value=event.target.value;setEntry({...current!,method:['merge','squash','rebase'].includes(value)?value as ReleaseMergeMethod:'',plan:undefined,error:undefined})}} className="rounded-sm border border-white/15 bg-zinc-900 px-2 py-1.5"><option value="">Choose a method</option><option value="merge">Merge commit</option><option value="squash">Squash</option><option value="rebase">Rebase</option></select></label>
    <button type="button" disabled={current?.busy||!current?.number||!current?.method} onClick={()=>void perform('plan')} className="rounded-sm border border-white/15 px-3 py-1.5 disabled:opacity-50">Read merge plan</button>
   </div>
   {plan&&<div className="rounded-sm border border-white/10 bg-white/2 p-3"><p className="font-medium text-zinc-100">{plan.pullRequest.headRef} → {plan.pullRequest.baseRef}</p><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1"><dt>Pull request</dt><dd>#{plan.pullRequest.number}</dd><dt>Source commit</dt><dd className="font-mono">{plan.pullRequest.headSha.slice(0,12)}</dd><dt>Observed base commit</dt><dd className="font-mono">{plan.pullRequest.baseSha.slice(0,12)}</dd></dl><p className="mt-2 text-zinc-500">Current permissions, checks and independent approval must be verified before a merge.</p></div>}
  </div>}
  <ReleaseOperationPlans requestId={requestId} version={version}/>
 </section>;
}

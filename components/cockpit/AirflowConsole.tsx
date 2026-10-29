'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AirflowDag, AirflowDagRun, AirflowTaskPage } from '@/lib/integrations/airflow/airflowClient';
import { SectionTabs } from './SectionTabs';

type Overview={connection:{status:string;version?:string|null;lastValidatedAt?:string|null;dagCount?:number|null};automations:Array<{id:string;name:string;dagId:string;enabled:boolean;triggerMode:string;scheduleCron:string|null;actionType:string;approvalRequired:boolean}>;executions:Array<{id:string;sourceDagId:string;sourceDagRunId:string;status:string;attempt:number;createdAt:string}>};
const button='inline-flex min-h-8 items-center justify-center rounded-full border border-white/15 px-3.5 text-xs text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40';
const primary='inline-flex min-h-8 items-center justify-center rounded-full bg-[#f3f3f3] px-3.5 text-[13px] text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-40';
export function AirflowConsole(){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [dags,setDags]=useState<AirflowDag[]|null>(null);
 const [runs,setRuns]=useState<AirflowDagRun[]|null>(null);
 const [tasks,setTasks]=useState<AirflowTaskPage|null>(null);
 const [dag,setDag]=useState<AirflowDag|null>(null);
 const [run,setRun]=useState<AirflowDagRun|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 const controller=useRef<AbortController|null>(null);
 const read=useCallback(async <T,>(query:string):Promise<T|null>=>{
  controller.current?.abort();const current=new AbortController();controller.current=current;
  setBusy(true);setError(null);
  try{
   const response=await fetch(`/api/control/airflow${query}`,{credentials:'include',cache:'no-store',signal:current.signal});
   const body=await response.json();
   if(!response.ok || body?.ok!==true || !body.data || typeof body.data!=='object')throw Error('unverified');
   return current.signal.aborted ? null:body.data as T;
  }catch{if(!current.signal.aborted)setError('Airflow information could not be verified. Refresh or check workspace access and the connection in Axiom Agent.');return null;}
  finally{if(controller.current===current)setBusy(false);}
 },[]);
 const refresh=useCallback(async()=>{
  setOverview(null);setDags(null);setRuns(null);setTasks(null);setDag(null);setRun(null);
  const result=await read<Overview>('');
  if(result && result.connection && typeof result.connection.status==='string' && Array.isArray(result.automations) && Array.isArray(result.executions))setOverview(result);
  else if(result)setError('The Airflow response could not be verified.');
 },[read]);
 useEffect(()=>{void refresh();return()=>{controller.current?.abort();};},[refresh]);
 async function loadDags(){setDags(null);setDag(null);setRun(null);setRuns(null);setTasks(null);const result=await read<{dags:AirflowDag[]}>('?view=dags');if(result && Array.isArray(result.dags))setDags(result.dags);else if(result)setError('DAG information could not be verified.');}
 async function loadRuns(selected:AirflowDag){setDag(selected);setRun(null);setTasks(null);setRuns(null);const result=await read<{runs:AirflowDagRun[]}>(`?view=runs&dag=${encodeURIComponent(selected.dagId)}`);if(result && Array.isArray(result.runs))setRuns(result.runs);else if(result)setError('Run information could not be verified.');}
 async function loadTasks(selected:AirflowDagRun,offset=0){if(!dag)return;setRun(selected);setTasks(null);const result=await read<AirflowTaskPage>(`?view=tasks&dag=${encodeURIComponent(dag.dagId)}&run=${encodeURIComponent(selected.dagRunId)}&offset=${offset}`);if(result && Array.isArray(result.tasks) && Number.isSafeInteger(result.totalEntries) && result.totalEntries>=0 && result.offset===offset)setTasks(result);else if(result)setError('Task information could not be verified.');}
 function back(to:'dags'|'runs'){controller.current?.abort();setBusy(false);setError(null);setTasks(null);setRun(null);if(to==='dags'){setDag(null);setRuns(null);}}
 const connected=overview?.connection.status==='active';
 const workflowContent=<section aria-label="DAG monitoring" className="rounded-2xl bg-[#111111] p-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-medium">{run?'Tasks':dag?'DAG runs':'DAGs'}</h2><p className="mt-1 break-all text-xs text-zinc-400">{run?run.dagRunId:dag?dag.displayName:'Read a bounded snapshot from the configured Airflow service.'}</p></div><div className="flex flex-wrap gap-2">{dag && <button onClick={()=>back('dags')} className={button}>Back to DAGs</button>}{run && <button onClick={()=>back('runs')} className={button}>Back to runs</button>}{!dag && <button onClick={()=>void loadDags()} disabled={!connected||busy} className={primary}>Load DAGs</button>}</div></div>
  {!connected && !busy && <p className="mt-5 text-sm text-zinc-400">Validate an Airflow connection in the paired Agent before loading DAGs.</p>}
  {!dag && dags!==null && <div className="mt-5 divide-y divide-white/10">{dags.length===0?<p className="py-4 text-sm text-zinc-400">No DAGs returned.</p>:dags.map(item=><div key={item.dagId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><h3 className="break-all text-sm">{item.displayName}</h3><p className="mt-1 break-all text-xs text-zinc-400">{item.paused?'Paused':'Not paused'} · {item.dagId}</p></div><button className={button} disabled={busy} aria-label={`View runs for ${item.displayName}`} onClick={()=>void loadRuns(item)}>View runs</button></div>)}</div>}
  {dag && !run && runs!==null && <div className="mt-5 divide-y divide-white/10">{runs.length===0?<p className="py-4 text-sm text-zinc-400">No runs returned.</p>:runs.map(item=><div key={item.dagRunId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-all text-sm">{item.dagRunId}</p><p className="mt-1 text-xs text-zinc-400">{item.state}{item.startedAt?` · Started ${item.startedAt}`:''}</p></div><button className={button} disabled={busy} aria-label={`View tasks for ${item.dagRunId}`} onClick={()=>void loadTasks(item)}>View tasks</button></div>)}</div>}
  {run && tasks && <><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Task state for selected run</caption><thead className="text-zinc-400"><tr>{['Task','State','Map index','Attempt'].map(label=><th key={label} className="p-3 font-normal">{label}</th>)}</tr></thead><tbody>{tasks.tasks.map(task=><tr key={`${task.taskId}:${task.mapIndex}`} className="border-t border-white/10"><td className="max-w-64 break-all p-3">{task.taskId}</td><td className="p-3">{task.state??'Not reported'}</td><td className="p-3">{task.mapIndex}</td><td className="p-3">{task.tryNumber}</td></tr>)}</tbody></table></div>{tasks.tasks.length===0 && <p className="py-4 text-sm text-zinc-400">No tasks returned on this page.</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-zinc-400">{tasks.totalEntries} tasks reported · offset {tasks.offset}</p><div className="flex gap-2"><button className={button} disabled={busy||tasks.offset===0} onClick={()=>void loadTasks(run,Math.max(0,tasks.offset-100))}>Previous tasks</button><button className={button} disabled={busy||tasks.offset+100>=tasks.totalEntries} onClick={()=>void loadTasks(run,tasks.offset+100)}>Next tasks</button></div></div></>}
 </section>;
 return <div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#111111] p-4"><div><p className="text-sm">{overview?`Recorded connection: ${overview.connection.status.replaceAll('_',' ')}`:'Connection status unavailable'}</p><p className="mt-1 text-xs text-zinc-400">{overview?.connection.version?`Airflow ${overview.connection.version} · `:''}{overview?.connection.lastValidatedAt?`Last validation ${overview.connection.lastValidatedAt.slice(0,10)}`:'No validation time recorded'}</p></div><button className={button} disabled={busy} onClick={()=>void refresh()}>Refresh connection &amp; records</button></div>
 {busy && <p role="status" className="mt-4 text-xs text-zinc-400">Loading Airflow information…</p>}{error && <p role="alert" className="mt-4 rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">{error}</p>}
 <SectionTabs label="Airflow sections" items={[
  {id:'dags',label:'DAGs & runs',content:workflowContent},
  {id:'automations',label:'Automations',content:<section className="rounded-2xl bg-[#111111] p-4"><h2 className="text-base font-medium">Recorded automations</h2>{overview?overview.automations.length===0?<p className="mt-4 text-sm text-zinc-400">No automations recorded.</p>:overview.automations.map(item=><article key={item.id} className="border-b border-white/10 py-4 last:border-0"><h3 className="text-sm">{item.name}</h3><p className="mt-1 break-all text-xs text-zinc-400">{item.dagId} · {item.enabled?'Enabled':'Disabled'} · {item.triggerMode}{item.scheduleCron?` · ${item.scheduleCron} UTC`:''}</p><p className="mt-1 text-xs text-zinc-400">{item.actionType.replaceAll('_',' ')} · {item.approvalRequired?'Approval required':'Stored policy applies'}</p></article>):<p className="mt-4 text-sm text-zinc-400">Automation records unavailable.</p>}</section>},
  {id:'executions',label:'Execution history',content:<section className="rounded-2xl bg-[#111111] p-4"><h2 className="text-base font-medium">Recent executions</h2>{overview?overview.executions.length===0?<p className="mt-4 text-sm text-zinc-400">No executions recorded.</p>:overview.executions.map(item=><article key={item.id} className="border-b border-white/10 py-4 last:border-0"><h3 className="break-all text-sm">{item.sourceDagId}</h3><p className="mt-1 break-all text-xs text-zinc-400">{item.sourceDagRunId} · {item.status.replaceAll('_',' ')} · attempt {item.attempt}</p></article>):<p className="mt-4 text-sm text-zinc-400">Execution records unavailable.</p>}</section>},
 ]}/>
 <p className="mt-6 text-xs leading-5 text-zinc-400">DAGs: up to 500; runs: up to 50; tasks: 100 per page. Automation and execution history shows the latest 50 records each. Connection changes, triggers, and execution approvals remain in the paired Agent.</p><div className="mt-4 flex flex-wrap gap-5 text-xs"><Link href="/control/desktop" className="text-orange-300 underline">Agent setup &amp; downloads</Link><Link href="/control/integrations" className="text-zinc-300 underline">Workspace integrations</Link><Link href="/control/audit-security" className="text-zinc-300 underline">Audit &amp; security</Link></div>
 </div>;
}

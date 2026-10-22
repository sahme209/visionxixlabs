'use client';
import { useRef,useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search,Puzzle } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
export interface CatalogEntry {id:string;name:string;description:string;kind:'Plugins'|'Skills'|'MCP';status:string;permissions:string[]}
type SkillAction='install'|'enable'|'disable';
export function Catalog({entries,unavailable,canManage=false}:{entries:CatalogEntry[];unavailable:boolean;canManage?:boolean}){
 const router=useRouter();const [kind,setKind]=useState<CatalogEntry['kind']>('Plugins');const [query,setQuery]=useState('');
 const [pending,setPending]=useState<{item:CatalogEntry;action:SkillAction}|null>(null);const [busy,setBusy]=useState(false);const [uncertain,setUncertain]=useState(false);const [notice,setNotice]=useState<string|null>(null);
 const trigger=useRef<HTMLButtonElement|null>(null);const lock=useRef(false);
 const visible=entries.filter(item=>item.kind===kind && `${item.name} ${item.description} ${item.permissions.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
 async function updateSkill(){
  if(!pending || !canManage || unavailable || uncertain || lock.current)return;
  lock.current=true;setBusy(true);setNotice(null);
  try{
   const response=await fetch('/api/control/skills',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({skillId:pending.item.id,action:pending.action})});
   const body=await response.json().catch(()=>null);const expected=pending.action==='disable'?'disabled':'enabled';
   if(!response.ok || body?.ok!==true || body.data?.skillId!==pending.item.id || body.data?.status!==expected)throw Error('unconfirmed');
   setNotice(`${pending.item.name} update confirmed. Refreshing workspace state; Agent guidance updates on the next message.`);router.refresh();
  }catch{setUncertain(true);setNotice('Skill update was not confirmed. Refresh the catalog before retrying; the request may have completed.');}
  finally{lock.current=false;setBusy(false);setPending(null);}
 }
 return <><div className="mt-6 flex flex-wrap items-center justify-between gap-4"><div aria-label="Catalog category" className="flex gap-1">{(['Plugins','Skills','MCP'] as const).map(value=><button key={value} aria-pressed={kind===value} disabled={busy} onClick={()=>setKind(value)} className={`min-h-8 rounded-full px-4 py-1.5 text-[13px] ${kind===value?'bg-white/15 text-white':'text-zinc-400 hover:text-white'}`}>{value}</button>)}</div><label className="flex min-h-8 items-center gap-2 rounded-lg border border-white/10 px-3 text-zinc-400"><Search size={14} aria-hidden/><input aria-label="Search catalog" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search catalog…" className="w-40 bg-transparent py-1.5 text-[13px] text-white outline-none sm:w-48"/></label></div>
 {unavailable && <p role="alert" className="mt-5 rounded-lg border border-amber-400/20 p-3 text-xs text-amber-200">Skill installation storage is unavailable. Installation state is unknown.</p>}
 {notice && <p role={uncertain?'alert':'status'} className="mt-4 rounded-xl border border-white/10 p-3 text-xs text-zinc-300">{notice}{uncertain && <button onClick={()=>window.location.reload()} className="ml-3 underline">Refresh catalog</button>}</p>}
 <div className="mt-5 grid gap-x-6 gap-y-2 md:grid-cols-2">{visible.map(item=>{
  const action:SkillAction=item.status==='enabled'?'disable':item.status==='disabled'?'enable':'install';const actionLabel=action==='disable'?'Disable':action==='enable'?'Enable':'Install';
  const manageable=item.kind==='Skills' && canManage && !unavailable && ['enabled','disabled','not_installed'].includes(item.status);
  return <article key={`${item.kind}:${item.id}`} className="grid min-w-0 grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 rounded-xl p-3 hover:bg-white/[0.025]"><span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-zinc-300"><Puzzle size={16}/></span><div className="min-w-0"><h2 className="text-[13px] font-medium">{item.name}</h2><p className="mt-1 text-[11px] text-zinc-400">{item.status.replaceAll('_',' ')}</p><p className="mt-1 text-xs leading-5 text-zinc-400">{item.description}</p><details className="mt-2 text-xs text-zinc-400"><summary className="cursor-pointer text-zinc-300">Review capabilities</summary><ul className="mt-3 space-y-1 break-words">{item.permissions.map(permission=><li key={permission}>{permission}</li>)}</ul><p className="mt-3 leading-5">Catalog availability grants no access. Credentials, workspace policy, and approvals are checked for each operation.</p></details></div>{manageable && <button disabled={busy||uncertain} aria-label={`${actionLabel} ${item.name}`} onClick={event=>{trigger.current=event.currentTarget;setPending({item,action});}} className="inline-flex min-h-8 items-center rounded-full bg-white/5 px-3.5 text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-40">{actionLabel}</button>}</article>;
 })}</div>
 {visible.length===0 && <div role="status" className="mt-6 rounded-xl border border-white/10 p-6 text-sm leading-6 text-zinc-400">{kind==='MCP'?'No browser-managed MCP servers are registered. Arbitrary MCP installation is not supported by this cockpit yet.':'No catalog entries match your search.'}</div>}
 <p className="mt-6 text-xs leading-5 text-zinc-400">Workspace skills share their recorded installation state with Axiom Agent. Guidance updates on the next Agent message; installation grants no tool permissions. Review provider authorization in <Link className="text-orange-300 underline" href="/control/integrations">Integrations</Link> and tool authority in <Link className="text-orange-300 underline" href="/control/ai-agents">AI &amp; Agents</Link>.</p>
 {pending && <ConfirmDialog title={`${pending.action==='disable'?'Disable':pending.action==='enable'?'Enable':'Install'} ${pending.item.name}?`} confirmLabel={pending.action==='disable'?'Disable skill':pending.action==='enable'?'Enable skill':'Install skill'} onCancel={()=>setPending(null)} onConfirm={()=>void updateSkill()} returnFocusRef={trigger} busy={busy}>This changes workflow guidance for your workspace, including the desktop Agent. Provider credentials, tool permissions, approval requirements, and existing conversations remain governed separately.</ConfirmDialog>}
 </>;
}

import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {PlatformSourceClient} from '../lib/platformReview';
import {platformSourcePage,type PlatformSourceKind,type PlatformSourcePage} from '../../../lib/governance/platform/sourceCatalog';
interface Props{mode?:'growth'|'leads';client:PlatformSourceClient;disabled:boolean;onSelect:(kind:PlatformSourceKind,id:string)=>void}
/** Read-only source discovery. Metadata is neither a source preview nor current
 * posting permission; the server reconstructs every selected plan separately. */
export function PlatformSourcePicker({mode='growth',client,disabled,onSelect}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config}).current;
 const [page,setPage]=useState<PlatformSourcePage|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const alive=useRef(true),running=useRef(false),active=useRef<AbortController|null>(null);
 const allowed=(kind:PlatformSourceKind)=>mode==='leads'?kind==='leads':kind!=='leads';
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 async function load(kind:PlatformSourceKind,cursor:string|null){
  if(!owns()||disabled||running.current||!allowed(kind))return;running.current=true;setBusy(true);setMessage('');setPage(null);const c=new AbortController();active.current=c;
  try{const response=await client.list(kind,cursor,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');
   const selected=platformSourcePage.safeParse(response.data);if(!selected.success||selected.data.kind!==kind||cursor&&selected.data.entries.some(e=>e.id>=cursor))throw Error('mismatched');setPage(selected.data);
  }catch{if(owns())setMessage('Source metadata could not be verified. No proposal was saved and no provider action occurred.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 const current=revision===owner.revision&&owns();
 return <section aria-label={mode==='leads'?'Find existing generated-site sources':'Find existing growth sources'} className="space-y-3 rounded-lg border border-white/10 p-4">
  <h3 className="font-medium">Find existing source records</h3><p className="text-xs text-zinc-400">{mode==='leads'?'Labels may be shortened. Package presence is not validation. Exact files and current permissions are checked when a proposal is prepared.':'Labels may be shortened. Selection does not validate content, permissions or publication eligibility.'}</p>
  {!current?<p role="alert">Account context changed. Reopen the source picker.</p>:<>
   <div className="flex flex-wrap gap-3">{mode==='leads'?<button type="button" className="btn-secondary" disabled={disabled||busy} onClick={()=>void load('leads',null)}>Find existing leads</button>:<><button type="button" className="btn-secondary" disabled={disabled||busy} onClick={()=>void load('drafts',null)}>Find drafts</button><button type="button" className="btn-secondary" disabled={disabled||busy} onClick={()=>void load('accounts',null)}>Find accounts</button></>}</div>
   {page&&allowed(page.kind)&&<ul className="divide-y divide-white/10">{page.kind==='drafts'?page.entries.map(e=><li key={e.id} className="py-3"><p>{e.label}{e.labelTruncated?'…':''}</p><p className="text-xs text-zinc-400">{e.status} · {e.id}</p><button type="button" className="btn-secondary" disabled={disabled||busy} onClick={()=>{if(owns()&&!disabled)onSelect('drafts',e.id)}}>Select draft</button></li>):page.kind==='accounts'?page.entries.map(e=>{
    const available=e.status==='connected'&&Date.parse(e.expiresAt)>Date.now();
    return <li key={e.id} className="py-3"><p>{e.label}{e.labelTruncated?'…':''}</p><p className="text-xs text-zinc-400">{e.author}</p><p className="text-xs text-zinc-400">{e.status} · expires {e.expiresAt} · {e.id}</p><button type="button" className="btn-secondary" disabled={disabled||busy||!available} onClick={()=>{if(owns()&&!disabled&&e.status==='connected'&&Date.parse(e.expiresAt)>Date.now())onSelect('accounts',e.id)}}>Select account</button></li>;
   }):page.entries.map(e=><li key={e.id} className="py-3"><p>{e.label}{e.labelTruncated?'…':''}</p><p className="text-xs text-zinc-400">{e.status} · {e.id}</p><p className="text-xs text-zinc-400">{e.hasSavedPackage?'Saved package present':'No saved package'}</p><button type="button" className="btn-secondary" disabled={disabled||busy||!e.hasSavedPackage} onClick={()=>{if(owns()&&!disabled&&e.hasSavedPackage)onSelect('leads',e.id)}}>Select lead</button></li>)}</ul>}
   {page&&allowed(page.kind)&&page.entries.length===0&&<p>No source records on this page.</p>}
   {page?.nextCursor&&allowed(page.kind)&&<button type="button" className="btn-secondary" disabled={disabled||busy} onClick={()=>void load(page.kind,page.nextCursor)}>Next source page</button>}
  </>}
  <p role="status" aria-live="polite">{busy?'Loading source metadata…':message}</p>
 </section>;
}

import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {createPlatformHistoryClient} from '../lib/platformReview';
import {platformHistoryPage,type PlatformHistoryPage,type PlatformHistoryCursor} from '../../../lib/governance/platform/historyContract';
interface Props{client:ReturnType<typeof createPlatformHistoryClient>;onSelect:(actionId:string)=>void}
/** Prepared directory, unregistered. Selecting a row only loads its reference;
 * it never restores a previous session, approval, source preview or claim. */
export function PlatformHistoryPanel({client,onSelect}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({revision,config:desktopClient.config}).current;
 const [page,setPage]=useState<PlatformHistoryPage|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const alive=useRef(true),running=useRef(false),controller=useRef<AbortController|null>(null);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort()}},[]);
 async function load(cursor:PlatformHistoryCursor|null){
  if(!owns()||running.current)return;running.current=true;setBusy(true);setMessage('');
  const c=new AbortController();controller.current=c;
  try{const result=await client.list(cursor,c.signal);if(!owns())return;
   if(!result.ok){setMessage('Saved history is unavailable. No decision or action was submitted.');return}
   const parsed=platformHistoryPage.safeParse(result.data);if(!parsed.success){setMessage('Saved history could not be verified.');return}setPage(parsed.data);
  }catch{if(owns())setMessage('Saved history is unavailable. No decision or action was submitted.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 const current=revision===owner.revision&&owns();
 return <section aria-label="Saved platform actions" className="space-y-4">
  <header><h2>Saved platform actions</h2><p>Historical records only. Inspect an exact record to see its evidence and current availability.</p></header>
  {!current?<p role="alert">Account context changed. Reopen history in the current session.</p>:<>
   <button type="button" disabled={busy} onClick={()=>void load(null)}>Load saved actions</button>
   {page&&<ul>{page.entries.map(e=><li key={e.actionId} className="border-b border-border py-3">
    <p>{e.effectKinds.join(' · ')} <strong>{e.status}</strong></p>
    <p className="text-sm text-muted-foreground">{e.createdAt} · {e.attemptCount} recorded attempt · {e.actionId}</p>
    {['claimed','unknown'].includes(e.status)&&<p>Outcome needs inspection. Do not resend or create a replacement.</p>}
    <button type="button" disabled={busy} onClick={()=>{if(owns())onSelect(e.actionId)}}>Inspect saved action</button>
   </li>)}</ul>}
   {page?.entries.length===0&&<p>No saved actions on this page.</p>}
   {page?.nextCursor&&<button type="button" disabled={busy} onClick={()=>void load(page.nextCursor)}>Older actions</button>}
  </>}
  <p role="status" aria-live="polite">{busy?'Loading saved history…':message}</p>
 </section>;
}

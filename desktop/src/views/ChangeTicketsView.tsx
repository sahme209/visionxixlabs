import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {open} from '@tauri-apps/plugin-shell';
import {ViewShell} from '../components/Primitives';
import {desktopClient} from '../lib/desktopClient';

/** Existing dormant destination only: the browser inbox owns cookie-backed
 * ticket reads/sync. Never execute its legacy global-credential routes natively. */
export function ChangeTicketsView(){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const config=desktopClient.config,generation=useRef({config,value:0});
 if(generation.current.config!==config)generation.current={config,value:generation.current.value+1};
 return <TicketBrowserBoundary key={`${revision}:${generation.current.value}`} />;
}

function ticketInboxUrl(apiBase:string):string|null{
 try{
  const configured=new URL(apiBase),local=['127.0.0.1','localhost','[::1]'].includes(configured.hostname);
  // Same origin criteria as the existing desktop browser pairing flow. This
  // is fixed advisory navigation, not sign-in, provider access or a new grant.
  if((configured.protocol!=='https:'&&!(configured.protocol==='http:'&&local))||configured.username||configured.password||configured.pathname!=='/'||configured.search||configured.hash)return null;
  return `${configured.origin}/dashboard/change-tickets`;
 }catch{return null}
}

function TicketBrowserBoundary(){
 const context=useRef(desktopClient.config).current,revision=useRef(desktopClient.getContextRevision()).current;
 const mounted=useRef(true),opening=useRef(false),pendingOpen=useRef<{stop:()=>void}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState<string>();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pendingOpen.current?.stop()}},[]);
 const destination=ticketInboxUrl(context.apiBase);
 const owns=()=>mounted.current&&desktopClient.config===context&&desktopClient.getContextRevision()===revision;
 async function openInbox(){
  if(!destination||opening.current||!owns())return;
  opening.current=true;setBusy(true);setError(undefined);
  let rejectStop!:(error:Error)=>void;
  const stopped=new Promise<never>((_,reject)=>{rejectStop=reject});
  const operation={stop:()=>rejectStop(new Error('opening_unconfirmed'))};pendingOpen.current=operation;
  const timer=setTimeout(operation.stop,15000);
  // Shell opening cannot be cancelled. A late open may still succeed, so a
  // deadline means unconfirmed outcome and never triggers an automatic retry.
  try{await Promise.race([open(destination),stopped])}catch{if(owns())setError('Browser opening could not be confirmed. Check your browser before trying again.')}finally{clearTimeout(timer);if(pendingOpen.current===operation)pendingOpen.current=null;opening.current=false;if(owns())setBusy(false)}
 }
 return <ViewShell><section aria-label="Change ticket browser handoff" className="max-w-2xl space-y-5">
  <div><h1 className="text-xl font-semibold tracking-tight text-zinc-100">Change tickets</h1><p className="mt-2 text-sm leading-6 text-zinc-400">Review the existing Jira, Linear and ServiceNow ticket inbox in your browser.</p></div>
  <p className="text-sm leading-6 text-zinc-400">Native ticket creation, synchronization and closure are not available here. This screen does not read ticket data or run provider actions.</p>
  <p className="text-xs leading-6 text-zinc-500">The browser uses its own authenticated session. Verify the selected workspace in the browser before using its ticket controls. No desktop credential is transferred.</p>
  <button type="button" className="btn-secondary" disabled={!destination||busy} onClick={()=>void openInbox()}>{busy?'Opening browser…':'Open ticket inbox in browser'}</button>
  {!destination&&<p role="alert" className="text-sm text-zinc-300">The configured service address is not a secure service origin. Review the service address in Settings before opening tickets.</p>}
  {error&&<p role="alert" className="text-sm text-zinc-300">{error}</p>}
 </section></ViewShell>;
}

'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
/** This only stages an explicit consent revision. It never grants scope or writes a ticket. */
export function ServiceNowJournalConsentAction({revision}:{revision:string}){
 const flight=useRef<AbortController|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>()=>flight.current?.abort(),[]);
 async function prepare(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(flight.current)return;const form=event.currentTarget,data=new FormData(form),controller=new AbortController();flight.current=controller;setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/account/integrations/servicenow/configure',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'journal_proof_consent',expectedRevision:revision,apiNamespace:data.get('apiNamespace')}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
   const body=await response.json();if(controller.signal.aborted)return;
   if(response.ok&&body?.ok===true&&body.data?.status==='pending'&&typeof body.data.configurationRevision==='string'){window.location.reload();return}
   setMessage('The consent preparation was not confirmed. Reload the saved connection before another action. No automatic retry was run.');
  }catch{if(!controller.signal.aborted)setMessage('The result could not be confirmed. Reload the saved connection; do not repeat this request.')}
  finally{if(!controller.signal.aborted)setBusy(false)}
 }
 return <details className="mt-6 text-sm"><summary className="cursor-pointer">Enable exact deployment-note verification</summary><form onSubmit={prepare} className="mt-3 space-y-3"><p>The instance administrator must first install the restricted Axiom Evidence Proof GET endpoint and offer axiom.change_evidence_read to this client. This pauses the connection until you complete fresh ServiceNow consent. It reuses your existing client and preserves its encrypted credentials. If a refresh outcome is unknown, this starts a fresh sign-in and retains that history; it never resends the refresh. It does not grant access or change a ticket.</p><label className="block">Installed API namespace<input name="apiNamespace" required pattern="[A-Za-z0-9_]{1,80}" maxLength={80} disabled={busy||!!message} className="mt-1 block w-full rounded-sm border border-current/20 bg-transparent p-2"/></label><label className="flex gap-2"><input type="checkbox" required disabled={busy||!!message}/>I reviewed this instance’s exact journal-proof scope and endpoint.</label><button type="submit" disabled={busy||!!message} className="rounded-sm border border-current/20 px-4 py-2 disabled:opacity-50">{busy?'Preparing consent…':'Prepare fresh proof consent'}</button>{message&&<p role="alert">{message} <a href="/account/integrations/servicenow" className="underline">Reload connection</a></p>}</form></details>;
}

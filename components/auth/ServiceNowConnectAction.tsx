'use client';
import {useEffect,useRef,useState} from 'react';
import {serviceNowConsentDestination} from '@/lib/integrations/servicenow/consentDestination';
export function ServiceNowConnectAction({instanceOrigin}:{instanceOrigin:string}){
 const flight=useRef<AbortController|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>{flight.current?.abort();flight.current=null},[instanceOrigin]);
 async function connect(){
  if(flight.current)return;const controller=new AbortController();flight.current=controller;setBusy(true);setError('');
  try{
   const response=await fetch('/api/account/integrations/servicenow/start',{method:'POST',credentials:'include',signal:controller.signal}),body=await response.json().catch(()=>null);
   if(controller.signal.aborted||flight.current!==controller)return;
   const destination=typeof body?.data?.consentUrl==='string'?serviceNowConsentDestination(body.data.consentUrl,instanceOrigin):null;
   if(!response.ok||body?.ok!==true||!destination)throw Error('unavailable');
   window.location.assign(destination);
  }catch{if(!controller.signal.aborted&&flight.current===controller)setError('ServiceNow sign-in could not be opened. Your saved setup is unchanged. Reload this page to check access.')}
  finally{if(flight.current===controller&&!controller.signal.aborted){flight.current=null;setBusy(false)}}
 }
 return <div><button type="button" disabled={busy} onClick={()=>void connect()} className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">{busy?'Opening ServiceNow…':'Connect ServiceNow'}</button>{error&&<p role="alert" className="mt-3 text-sm text-zinc-400">{error}</p>}</div>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ProviderLogo} from './ProviderLogo';
interface Result {title:string;excerpt:string;url:string}
export function MicrosoftLearnTools({enabled,storageAvailable}:{enabled:boolean;storageAvailable:boolean}){
 const [query,setQuery]=useState('');const [busy,setBusy]=useState<'check'|'search'|null>(null);const [notice,setNotice]=useState<string|null>(null);const [results,setResults]=useState<Result[]>([]);
 const active=useRef<AbortController|null>(null);const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.abort();};},[]);
 async function run(action:'check'|'search'){
  if(active.current||action==='search'&&(!enabled||!storageAvailable||!query.trim()))return;
  const controller=new AbortController();active.current=controller;setBusy(action);setNotice(null);setResults([]);
  try{
   const response=await fetch('/api/control/mcp/microsoft-learn',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action,...(action==='search'?{query:query.trim()}:{})})});
   const body=await response.json().catch(()=>null);
   if(!mounted.current)return;
   if(!response.ok||body?.ok!==true){setNotice(body?.error==='mcp_not_enabled'?'Enable Microsoft Learn in the workspace MCP catalog before searching.':body?.error==='invalid_documentation_query'?'Use a short public technical topic without credentials or private details.':body?.error==='documentation_rate_limited'?'Too many requests. Wait a moment before trying again.':'This documentation request could not be confirmed. Try again later.');return;}
   if(action==='check'){
    if(body.data?.searchAvailable!==true)throw Error('unconfirmed');
    setNotice('Microsoft Learn MCP responded and documentation search is available. This check does not install it or grant cloud access.');
   }else{
    if(!Array.isArray(body.data?.results))throw Error('unconfirmed');
    const safe=body.data.results.filter((item:Result)=>{try{return typeof item.title==='string'&&typeof item.excerpt==='string'&&new URL(item.url).origin==='https://learn.microsoft.com';}catch{return false;}});
    setResults(safe);setNotice(safe.length?`${safe.length} documentation results received from Microsoft Learn.`:'No documentation matched this topic.');
   }
  }catch{if(mounted.current&&!controller.signal.aborted)setNotice('This documentation request could not be confirmed. Try again later.');}
  finally{if(active.current===controller)active.current=null;if(mounted.current)setBusy(null);}
 }
 return <div className="mt-6 space-y-6">
  <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-white/10 bg-[#111] p-5"><div className="flex items-start gap-3"><ProviderLogo provider="azure" size={28}/><div><h2 className="text-sm font-medium">Microsoft Learn</h2><p className="mt-1 text-xs text-zinc-400">Official public MCP · documentation search · no cloud credentials</p><p className="mt-2 text-xs text-zinc-400">{!storageAvailable?'Installation state unavailable':enabled?'Enabled in this workspace':'Not installed'}</p></div></div><div className="flex flex-wrap gap-2"><button disabled={busy!==null} onClick={()=>void run('check')} className="min-h-8 rounded-full bg-white/10 px-4 text-xs disabled:opacity-50">{busy==='check'?'Checking…':'Check connection'}</button><Link href="/control/plugins?tab=mcp" className="inline-flex min-h-8 items-center rounded-full border border-white/10 px-4 text-xs">Manage MCP</Link></div></section>
  {!enabled&&<p className="text-xs leading-5 text-zinc-400">A workspace administrator can install Microsoft Learn in the MCP catalog. Installing shares the connection’s enabled state with the Agent; Agent tool permissions are approved separately.</p>}
  <form onSubmit={event=>{event.preventDefault();void run('search');}} className="rounded-xl border border-white/10 p-5"><label htmlFor="microsoft-docs-query" className="text-sm font-medium">Search Microsoft documentation</label><p className="mb-4 mt-2 text-xs leading-5 text-zinc-400">Your topic is sent to Microsoft’s public documentation server. Use public technical terms only; do not enter secrets, personal information or private code. This does not inspect your Azure account.</p><div className="flex flex-wrap gap-3"><input id="microsoft-docs-query" value={query} onChange={event=>setQuery(event.target.value)} maxLength={300} disabled={busy!==null||!enabled||!storageAvailable} placeholder="For example: Azure App Service managed identity" className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[13px] disabled:opacity-50"/><button type="submit" disabled={busy!==null||!enabled||!storageAvailable||!query.trim()} className="min-h-10 rounded-full bg-zinc-100 px-5 text-xs font-medium text-zinc-950 disabled:opacity-40">{busy==='search'?'Searching…':'Search docs'}</button></div></form>
  {notice&&<p role="status" className="text-xs leading-5 text-zinc-300">{notice}</p>}
  {results.length>0&&<section aria-label="Documentation results" className="grid gap-4 md:grid-cols-2">{results.map((result,index)=><article key={`${result.url}:${index}`} className="min-w-0 rounded-xl border border-white/10 p-5"><a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-zinc-100 underline underline-offset-4">{result.title}</a><p className="mt-3 whitespace-pre-line wrap-break-word text-xs leading-5 text-zinc-400">{result.excerpt.slice(0,500)}</p><p className="mt-3 text-[11px] text-zinc-500">learn.microsoft.com ↗</p></article>)}</section>}
 </div>;
}

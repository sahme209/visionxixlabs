"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {IntegrationCatalogLogo} from "./IntegrationCatalogLogo";
import { CATALOG_JOBS, type CatalogOperation, type PublicCatalogEntry } from "@/lib/integrations/publicIntegrationCatalog";
const TITLES:Record<string,string>={available:"Available",preview:"Preview","implementation review":"Implementation review",planned:"Planned","configuration required":"Configuration required"};
const OPERATION_LABELS:Record<CatalogOperation,string>={read:"Read context",change:"Change workflows",events:"Receive events"};
const FIELD="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#171717] px-3 text-sm text-zinc-100 outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-300";
export function IntegrationCatalogBrowser({entries}:{entries:PublicCatalogEntry[]}){
 const [search,setSearch]=useState("");const[job,setJob]=useState("all");const[state,setState]=useState("all");const[operation,setOperation]=useState("all");
 const searchInput=useRef<HTMLInputElement>(null);
 const active=!!search||job!=="all"||state!=="all"||operation!=="all";
 const clear=()=>{setSearch("");setJob("all");setState("all");setOperation("all");searchInput.current?.focus();};
 const rows=entries.filter(e=>(!search.trim()||e.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))&&(job==="all"||e.job===job)&&(state==="all"||(state==="preview"?["preview","implementation review"].includes(e.availability.label):state==="configuration"?e.availability.label==="configuration required":e.availability.label===state))&&(operation==="all"||e.operations.includes(operation as "read"|"change"|"events")));
 return <section aria-label="Browse integrations" className="space-y-6">
  <div className="grid gap-4 border-b border-white/10 pb-6 sm:grid-cols-2 xl:grid-cols-4">
   <label className="text-xs font-medium text-zinc-300">Search connectors<input ref={searchInput} type="search" value={search} onChange={e=>setSearch(e.target.value)} className={FIELD} placeholder="Find a tool…" /></label>
   <label className="text-xs font-medium text-zinc-300">Job<select value={job} onChange={e=>setJob(e.target.value)} className={FIELD}><option value="all">All jobs</option>{CATALOG_JOBS.map(j=><option key={j.id} value={j.id}>{j.label}</option>)}</select></label>
   <label className="text-xs font-medium text-zinc-300">Availability<select value={state} onChange={e=>setState(e.target.value)} className={FIELD}><option value="all">All availability</option><option value="available">Available workflows</option><option value="configuration">Configuration required</option><option value="preview">Preview or review</option><option value="planned">Planned</option></select></label>
   <label className="text-xs font-medium text-zinc-300">Operation model<select value={operation} onChange={e=>setOperation(e.target.value)} className={FIELD}><option value="all">All operation models</option><option value="read">Read context</option><option value="change">Change workflows</option><option value="events">Receive events</option></select></label>
  </div>
  <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-zinc-400">{rows.length} {rows.length === 1 ? "connector" : "connectors"} shown · {entries.length} in the catalog</p>{active&&rows.length>0&&<button type="button" onClick={clear} className="min-h-11 rounded-lg px-3 text-sm text-zinc-200 underline underline-offset-4 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-300">Clear filters</button>}</div>
  <p className="max-w-3xl text-sm leading-6 text-zinc-400">Filters describe the catalog, not your account’s connection or permission status. Operation models include preview and planned designs; they do not enable actions.</p>
  {rows.length===0?<div className="rounded-2xl border border-white/10 p-8"><h2 className="text-xl font-medium text-zinc-100">No connectors match these filters</h2><p className="mt-2 text-sm text-zinc-400">Try another job, availability, operation model or tool name.</p><button type="button" onClick={clear} className="mt-4 min-h-11 rounded-lg border border-white/20 px-4 text-sm text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-300">Clear filters</button></div>:<div className="integration-catalog-grid" style={rows.length===1?{gridTemplateColumns:"minmax(0, 1fr)",maxWidth:360}:undefined}>{rows.map(e=><article key={e.id} aria-label={`${e.name} integration`} className="integration-catalog-cell">
    <IntegrationCatalogLogo id={e.id}/>
    <div className="integration-catalog-heading"><h3>{e.name}</h3><span>{TITLES[e.availability.label]??e.availability.label}</span></div>
    <div role="group" aria-label="Operation models" className="integration-catalog-operations"><ul>{e.operations.map(model=><li key={model}>{OPERATION_LABELS[model]}</li>)}</ul></div>
    <details className="integration-catalog-details"><summary>Connection details</summary><p>{e.availability.detail}</p></details>
    <div className="mt-auto pt-2">{e.availability.enabled?<Link prefetch={false} href={e.availability.href} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-zinc-200 underline-offset-4 hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-300">{e.availability.href==="/docs"?"Browse documentation":e.availability.label==="preview"?"Read preview scope":"Read setup guide"}<span aria-hidden="true">↗</span></Link>:<p className="py-3 text-xs text-zinc-500">No setup available yet</p>}</div>
   </article>)}</div>}

 </section>;
}

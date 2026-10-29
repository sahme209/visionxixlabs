'use client';
import {useEffect,useState} from 'react';
import type {InvoicePage} from '@/lib/billing/invoicePage';
type Page=InvoicePage & {state:'verified'|'no_customer'};
const button='inline-flex min-h-8 items-center rounded-full border border-white/15 px-3.5 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-40';
function trustedLink(value:string|null,hosts:string[]):string|undefined{if(!value)return;try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&hosts.includes(url.hostname))return url.toString();}catch{}}
function amount(value:number,currency:string){return currency==='usd'?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100):`${value.toLocaleString()} ${currency.toUpperCase()} minor units`;}
export function InvoicePanel({canRead}:{canRead:boolean}){
 const [status,setStatus]=useState('');const [after,setAfter]=useState<string|null>(null);const [history,setHistory]=useState<Array<string|null>>([]);const [revision,setRevision]=useState(0);
 const [data,setData]=useState<Page|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState(false);
 useEffect(()=>{
  if(!canRead)return;
  const controller=new AbortController();setBusy(true);setData(null);setError(false);
  const query=new URLSearchParams();if(status)query.set('status',status);if(after)query.set('after',after);
  void(async()=>{try{
   const response=await fetch(`/api/control/invoices${query.size?`?${query}`:''}`,{credentials:'include',cache:'no-store',signal:controller.signal});
   const body=await response.json();const page=body?.data;
   if(!response.ok||body?.ok!==true||!page||!['verified','no_customer'].includes(page.state)||!Array.isArray(page.invoices)||typeof page.hasMore!=='boolean'||(page.hasMore && (typeof page.nextCursor!=='string'||!/^in_[A-Za-z0-9_]+$/.test(page.nextCursor)))||page.invoices.some((row:Record<string,unknown>)=>!row||typeof row.id!=='string'||typeof row.number!=='string'||typeof row.status!=='string'||typeof row.currency!=='string'||typeof row.createdAt!=='string'||!Number.isSafeInteger(row.totalMinor)))throw Error('unverified');
   if(!controller.signal.aborted)setData(page as Page);
  }catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setBusy(false);}})();
  return()=>controller.abort();
 },[canRead,status,after,revision]);
 if(!canRead)return <p className="text-sm text-zinc-400">A current workspace owner or administrator must view invoices.</p>;
 return <section aria-label="Workspace invoices"><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-3 text-xs text-zinc-400">Status<select aria-label="Invoice status" value={status} disabled={busy} onChange={event=>{setStatus(event.target.value);setAfter(null);setHistory([]);}} className="min-h-8 rounded-lg border border-white/10 bg-[#171717] px-3 text-[13px] text-zinc-200"><option value="">All statuses</option>{['paid','open','uncollectible','void','draft'].map(value=><option key={value} value={value}>{value.charAt(0).toUpperCase()+value.slice(1)}</option>)}</select></label><button className={button} disabled={busy} onClick={()=>setRevision(value=>value+1)}>Refresh invoices</button></div>
 {(busy||!data&&!error)&&<p role="status" className="mt-5 text-sm text-zinc-400">Loading invoices…</p>}
 {error&&<p role="alert" className="mt-5 rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">Invoice records could not be verified here. Try refreshing or use the secure billing portal below.</p>}
 {data?.state==='no_customer'&&<p className="mt-5 text-sm text-zinc-400">No billing customer is linked to this workspace.</p>}
 {data?.state==='verified'&&<>{data.invoices.length===0?<p className="mt-5 text-sm text-zinc-400">No invoices match this filter.</p>:<div className="mt-5 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Verified workspace invoices</caption><thead className="text-zinc-400"><tr>{['Invoice','Date (UTC)','Status','Total','Documents'].map(label=><th key={label} className="px-3 py-3 font-normal">{label}</th>)}</tr></thead><tbody>{data.invoices.map(row=>{const hosted=trustedLink(row.hostedUrl,['invoice.stripe.com']);const pdf=trustedLink(row.pdfUrl,['invoice.stripe.com','pay.stripe.com']);return <tr key={row.id} className="border-t border-white/10"><td className="max-w-48 break-all px-3 py-4 text-zinc-200">{row.number}</td><td className="whitespace-nowrap px-3 py-4 text-zinc-400">{row.createdAt.slice(0,10)}</td><td className="px-3 py-4 text-zinc-300">{row.status}</td><td className="whitespace-nowrap px-3 py-4 tabular-nums text-zinc-200">{amount(row.totalMinor,row.currency)}</td><td className="px-3 py-4"><div className="flex gap-4">{hosted&&<a href={hosted} target="_blank" rel="noopener noreferrer" aria-label={`View invoice ${row.number}`} className="text-zinc-200 underline">View ↗</a>}{pdf&&<a href={pdf} target="_blank" rel="noopener noreferrer" aria-label={`Download invoice ${row.number}`} className="text-zinc-200 underline">PDF ↗</a>}{!hosted&&!pdf&&<span className="text-zinc-500">Not available</span>}</div></td></tr>})}</tbody></table></div>}<div className="mt-5 flex justify-end gap-2"><button className={button} disabled={busy||history.length===0} onClick={()=>{const previous=history[history.length-1];setHistory(history.slice(0,-1));setAfter(previous);}}>Newer invoices</button><button className={button} disabled={busy||!data.hasMore||!data.nextCursor} onClick={()=>{setHistory([...history,after]);setAfter(data.nextCursor);}}>Older invoices</button></div></>}
 </section>;
}

import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import {governanceDocumentUploadSchema,type GovernanceProposal,type GovernanceEvidenceArtifact} from '../lib/governanceIntelligence';
import {decodePolicyUploadBytes} from '../../../lib/governance/intelligence/documentText';
type Selection=GovernanceProposal['scopes'][number];
interface Props {selection:Selection;onRecorded:(digest:string)=>void}
export function GovernanceDocumentUpload(props:Props){const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);return <Upload key={revision+':'+JSON.stringify(props.selection)} {...props}/>}
function Upload({selection,onRecorded}:Props){
 const[file,setFile]=useState<{name:string;bytes:Uint8Array;text:string;epoch:number}>(),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState('');
 const owner=useRef({config:desktopClient.config,revision:desktopClient.getContextRevision()}).current,alive=useRef(true),generation=useRef(0),running=useRef(false),heldRef=useRef(false),active=useRef<AbortController|undefined>(undefined),pending=useRef<ReturnType<typeof governanceDocumentUploadSchema.parse>|undefined>(undefined);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;active.current?.abort()}},[]);
 const current=()=>alive.current&&owner.config===desktopClient.config&&owner.revision===desktopClient.getContextRevision();
 async function choose(selected?:File){if(running.current||heldRef.current)return;const epoch=++generation.current;setFile(undefined);setChecked(false);setMessage('');if(!selected)return;
  if(selected.size===0||selected.size>65536||! /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,119}\.(md|txt)$/i.test(selected.name)||selected.name.includes('..')){setMessage('Choose a text or Markdown policy file of at most 64 KiB.');return}
  try{const bytes=new Uint8Array(await selected.arrayBuffer()),text=decodePolicyUploadBytes(bytes);if(!current()||generation.current!==epoch)return;setFile({name:selected.name,bytes,text,epoch})}catch{if(current()&&generation.current===epoch)setMessage('This file could not be validated as bounded policy text. Binary and credential-shaped content is refused locally.')}
 }
 async function save(){if(running.current||heldRef.current||pending.current||!checked||!file||file.epoch!==generation.current||!current())return;running.current=true;setBusy(true);setMessage('');const controller=new AbortController();active.current=controller;
  try{const input=governanceDocumentUploadSchema.parse({name:file.name,selection,utf8Bytes:new Uint8Array(file.bytes),expectedVersion:null,requestId:crypto.randomUUID()});pending.current=input;
   const result=await desktopClient.governanceUploadDocument(input,controller.signal);if(!current())return;heldRef.current=true;setHeld(true);setChecked(false);
   if(result.ok){setMessage(result.data.completeness==='complete'?'Policy source recorded. A separate baseline proposal and independent review are required.':'Policy source recorded with unresolved requirements. Review supported clauses before proposing a baseline.');pending.current=undefined;onRecorded(result.data.digest)}else setMessage(result.outcomeUnconfirmed?'The upload result is unconfirmed. Check its original saved record; the file will not be resent.':result.error+' The file will not be resent automatically.');
  }catch{if(current()){heldRef.current=true;setHeld(true);setChecked(false);setMessage('The upload result is unconfirmed. Check its original saved record; the file will not be resent.')}}finally{if(current())setBusy(false);running.current=false}
 }
 async function lookup(){if(running.current||!pending.current||!current())return;running.current=true;setBusy(true);const controller=new AbortController();active.current=controller;
  try{const result=await desktopClient.governanceLookupDocument(pending.current,controller.signal);if(!current())return;
   if(!result.ok)setMessage('The saved record could not be checked. Keep the original request; no file was resent.');else if(!result.data.found)setMessage('No confirmed matching source record is visible yet. Keep the original request and check again deliberately.');else{const artifact:GovernanceEvidenceArtifact=result.data.artifact;setMessage('The original source record is confirmed. Its saved history does not activate a policy.');pending.current=undefined;onRecorded(artifact.snapshot.digest)}
  }catch{if(current())setMessage('The saved record could not be checked. Keep the original request; no file was resent.')}finally{if(current())setBusy(false);running.current=false}
 }
 return <section aria-label="Add a policy document" aria-busy={busy} className="rounded-xl border border-white/10 p-4 space-y-3"><header><h2 className="font-medium">Add a policy document</h2><p className="mt-1 text-xs text-zinc-400">Store the original text privately in this workspace for source-backed review. This creates an initial source; updates require its current saved version.</p></header><p className="text-xs text-zinc-400">Exact scope: {selection.repositoryId} · {selection.resourceId} · {selection.environment}</p>
 <label className="block text-xs text-zinc-400">Policy text file<input type="file" accept=".md,.txt,text/plain,text/markdown" className="mt-2 block text-xs" disabled={busy||held} onChange={e=>void choose(e.target.files?.[0])}/></label>
 {file&&<details className="text-xs text-zinc-400"><summary>Review selected file: {file.name}</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-sm border border-white/10 p-3">{file.text}</pre></details>}
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!file||busy||held} onChange={e=>setChecked(e.target.checked)}/>I reviewed this file and exact scope for private workspace storage.</label><button className="btn-primary" disabled={!file||!checked||busy||held} onClick={()=>void save()}>Save policy source</button>
 {held&&pending.current&&<button className="btn-secondary ml-2" disabled={busy} onClick={()=>void lookup()}>Check original source record</button>}
 {message&&<p role="status" className="text-sm text-zinc-300">{message}</p>}
 </section>;
}

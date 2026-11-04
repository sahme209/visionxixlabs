import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import {governanceDocumentHeadSchema,governanceDocumentUploadSchema,governanceEvidenceArtifactSchema,type GovernanceDocumentHead,type GovernanceEvidenceList} from '../lib/governanceIntelligence';
import {decodePolicyUploadBytes} from '../../../lib/governance/intelligence/documentText';
type Props={targets:GovernanceEvidenceList['items'];organizationId:string;onLocked:(locked:boolean)=>void;onRecorded:()=>void};
export function GovernanceDocumentReplacement(props:Props){const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);return <Replacement key={revision} {...props}/>}
function Replacement({targets,organizationId,onLocked,onRecorded}:Props){
 const[target,setTarget]=useState(''),[head,setHead]=useState<GovernanceDocumentHead>(),[file,setFile]=useState<{name:string;bytes:Uint8Array;text:string;epoch:number}>(),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState('');
 const owner=useRef({config:desktopClient.config,revision:desktopClient.getContextRevision()}).current,alive=useRef(true),running=useRef(false),heldRef=useRef(false),epoch=useRef(0),active=useRef<AbortController|undefined>(undefined),pending=useRef<ReturnType<typeof governanceDocumentUploadSchema.parse>|undefined>(undefined);
 const current=()=>alive.current&&owner.config===desktopClient.config&&owner.revision===desktopClient.getContextRevision();
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;active.current?.abort()}},[]);
 const candidates=targets.filter(t=>t.source==='document'&&t.connectionId.startsWith('upload:'));
 function reset(value:string){if(running.current||heldRef.current)return;epoch.current++;active.current?.abort();setTarget(value);setHead(undefined);setFile(undefined);setReviewed(false);setMessage('')}
 function lock(value:boolean){running.current=value;setBusy(value);onLocked(value||heldRef.current)}
 async function load(){if(running.current||heldRef.current||!current())return;const selected=candidates.find(t=>t.digest===target);if(!selected)return;const token=++epoch.current;setHead(undefined);setFile(undefined);setReviewed(false);setMessage('');lock(true);const c=new AbortController();active.current=c;
  try{const saved=await desktopClient.governanceEvidenceArtifact(selected.digest,c.signal);if(!current()||epoch.current!==token)return;
   const parsed=saved.ok?governanceEvidenceArtifactSchema.safeParse(saved.data):undefined;
   if(!parsed?.success)throw Error();const a=parsed.data,s=a.snapshot;
   if(a.id!==selected.id||s.digest!==selected.digest||s.organizationId!==organizationId||s.source!=='document'||s.connectionId!==selected.connectionId||s.connectionRevision!==selected.connectionRevision||JSON.stringify(s.selection)!==JSON.stringify(selected.selection))throw Error();
   const result=await desktopClient.governanceDocumentHead(a,c.signal);if(!current()||epoch.current!==token)return;
   if(!result.ok)throw Error();const checked=governanceDocumentHeadSchema.safeParse(result.data);
   if(!checked.success)throw Error();const h=checked.data;
   if(h.artifactId!==a.id||h.artifactDigest!==s.digest||h.organizationId!==organizationId||h.name!==s.connectionId.slice(7)||h.selectedSourceDigest!==s.sourceDigest||JSON.stringify(h.selection)!==JSON.stringify(s.selection))throw Error();
   setHead(h);setMessage(h.headVersion===999?'This source has reached its supported version limit and is read-only.':'Current saved-head metadata loaded. Review the replacement separately; this is not the original document text.');
  }catch{if(current()&&epoch.current===token)setMessage('Current saved-head metadata could not be verified. Save remains disabled. Load deliberately again; no file was sent.')}finally{if(current()&&epoch.current===token)lock(false)}
 }
 async function choose(selected?:File){if(running.current||heldRef.current||!head||head.headVersion===999||!current())return;const token=++epoch.current;setFile(undefined);setReviewed(false);setMessage('');if(!selected)return;
  if(selected.size===0||selected.size>65536||!governanceDocumentUploadSchema.shape.name.safeParse(selected.name).success){setMessage('Choose a text or Markdown policy file of at most 64 KiB.');return}
  try{const bytes=new Uint8Array(await selected.arrayBuffer()),text=decodePolicyUploadBytes(bytes);if(current()&&epoch.current===token)setFile({name:selected.name,bytes,text,epoch:token})}catch{if(current()&&epoch.current===token)setMessage('This file could not be validated as bounded policy text. Binary and credential-shaped content is refused locally.')}
 }
 async function save(){if(running.current||heldRef.current||pending.current||!current()||!head||head.headVersion>=999||!file||file.epoch!==epoch.current||!reviewed)return;
  const input=governanceDocumentUploadSchema.parse({name:head.name,selection:head.selection,utf8Bytes:new Uint8Array(file.bytes),expectedVersion:head.headVersion,requestId:crypto.randomUUID()});pending.current=input;heldRef.current=true;setHeld(true);setReviewed(false);lock(true);setMessage('');const c=new AbortController();active.current=c;
  try{const result=await desktopClient.governanceUploadDocument(input,c.signal);if(!current())return;
   if(result.ok){pending.current=undefined;setMessage('Replacement recorded. Reload saved evidence deliberately before reviewing facts or proposing a baseline.');onRecorded()}else setMessage('The replacement result is unconfirmed or unavailable. Check the original saved record; this file will not be resent.');
  }catch{if(current())setMessage('The replacement result is unconfirmed. Check the original saved record; this file will not be resent.')}finally{if(current())lock(false)}
 }
 async function lookup(){if(running.current||!pending.current||!current())return;lock(true);const c=new AbortController();active.current=c;
  try{const result=await desktopClient.governanceLookupDocument(pending.current,c.signal);if(!current())return;
   if(!result.ok)setMessage('The original saved record could not be checked. Keep this request; no file was resent.');else if(!result.data.found)setMessage('No matching original record is confirmed yet. Keep this request and check again deliberately; no file was resent.');else{pending.current=undefined;setMessage('The original replacement is confirmed in saved history. This does not establish the current head. Reload evidence deliberately.');onRecorded()}
  }catch{if(current())setMessage('The original saved record could not be checked. Keep this request; no file was resent.')}finally{if(current())lock(false)}
 }
 return <section aria-label="Replace a saved policy document" aria-busy={busy} className="rounded-xl border border-white/10 p-4 space-y-3"><h2 className="font-medium">Replace a saved policy document</h2><p className="text-xs text-zinc-400">Choose a historical source to identify its fixed name and scope, then deliberately load current saved-head metadata. No policy is activated.</p>
 <label className="block text-sm">Saved policy document to replace<select value={target} disabled={busy||held} onChange={e=>reset(e.target.value)}><option value="">Choose a saved document</option>{candidates.map(t=><option key={t.id} value={t.digest}>{t.connectionId.slice(7)} · {t.selection.repositoryId} · {t.selection.resourceId} · {t.selection.environment} · historical {t.digest}</option>)}</select></label>
 <button className="btn-secondary" disabled={!target||busy||held} onClick={()=>void load()}>Load current saved version</button>
 {head&&<><div className="text-xs text-zinc-400"><p>Fixed target: {head.name} · {head.selection.repositoryId} · {head.selection.resourceId} · {head.selection.environment}</p><p>Current saved version {head.headVersion} · digest {head.sourceDigest}</p><p>Last saved update {head.updatedAt} · {head.completeness} · {head.factCount} recognized facts. Metadata only, not old document text or freshness proof.</p><p>{head.selectedContentMatchesHead?'The selected historical content digest matches the head; this does not make the historical snapshot current.':'The selected historical content differs from the saved head.'}</p></div>
 <label className="block text-sm">Replacement policy text file<input type="file" accept=".md,.txt,text/plain,text/markdown" disabled={busy||held||head.headVersion===999} onChange={e=>void choose(e.target.files?.[0])}/></label>
 {file&&<details><summary>Review replacement file: {file.name}</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{file.text}</pre></details>}
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={!file||busy||held||head.headVersion===999} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the fixed target, current saved version metadata and exact new file for replacement.</label></>}
 <button className="btn-primary" disabled={!head||head.headVersion===999||!file||!reviewed||busy||held} onClick={()=>void save()}>Save replacement once</button>
 {held&&pending.current&&<button className="btn-secondary" disabled={busy} onClick={()=>void lookup()}>Check original replacement record</button>}
 {message&&<p role="status">{message}</p>}
 </section>;
}

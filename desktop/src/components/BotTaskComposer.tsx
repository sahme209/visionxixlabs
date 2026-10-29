import {useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {AxiomBotDraft} from './AxiomBotDraftTask';
interface Props {ownerKey:string;draft:AxiomBotDraft;onDraftChange:(next:AxiomBotDraft)=>void;onSave?:(draft:AxiomBotDraft)=>void;onSend?:(draft:AxiomBotDraft)=>void;sendDisabled?:boolean;statusText?:string;editingDisabled?:boolean;saveDisabled?:boolean;onCandidateChange?:(invalid:boolean)=>void;detailsTarget?:HTMLElement|null}
/** Editing never uploads. Save and Send are separate explicit actions. */
export function BotTaskComposer({ownerKey,draft,onDraftChange,onSave,onSend,sendDisabled=true,statusText,editingDisabled=false,saveDisabled=false,onCandidateChange,detailsTarget}:Props){
 const id=useId(),errorId=`bot-composer-error-${id}`,guidanceId=`bot-composer-guidance-${id}`;
 const [candidate,setCandidate]=useState<{base:AxiomBotDraft;value:AxiomBotDraft}>();
 const titleMode=useRef({ownerKey,automatic:!draft.title});
 if(titleMode.current.ownerKey!==ownerKey)titleMode.current={ownerKey,automatic:!draft.title};
 const owned=Boolean(ownerKey)&&draft.ownerKey===ownerKey;
 const value=candidate?.base===draft&&candidate.value.ownerKey===ownerKey?candidate.value:draft;
 function validate(v:AxiomBotDraft){
  if(v.title.length>200)return 'Keep the title within 200 characters. Your full text is retained for correction.';
  if(v.task.length>4000||v.context.length>4000)return 'Keep task and context within 4,000 characters each. Your full text is retained for correction.';
  if(new TextEncoder().encode(JSON.stringify({title:v.title,instruction:v.task,context:v.context})).byteLength>16384)return 'The combined draft exceeds the 16 KiB data limit. Your full text is retained for correction.';
 }
 const error=owned?validate(value):undefined;
 function edit(field:'title'|'task'|'context',text:string){
  if(!owned||editingDisabled)return;
  if(field==='title')titleMode.current.automatic=false;
  const next={...value,[field]:text,ownerKey};
  if(field==='task'&&titleMode.current.automatic)next.title=Array.from(text.split(/\r?\n/).find(line=>line.trim())?.trim()??'').slice(0,80).join('');
  if(validate(next)){setCandidate({base:draft,value:next});onCandidateChange?.(true);return}
  setCandidate(undefined);onCandidateChange?.(false);onDraftChange(next);
 }
 const fieldClass='w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200';
 if(!owned)return <p role="alert" className="p-4 text-sm text-zinc-400">Workspace changed. Reopen the draft in the current workspace.</p>;
 const metadata=<div className="space-y-4">
  <label className="block space-y-2 text-xs text-zinc-400"><span>Bot task title</span><input aria-label="Bot task title" className={fieldClass} value={value.title} disabled={editingDisabled} onChange={e=>edit('title',e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error?errorId:undefined}/></label>
  <label className="block space-y-2 text-xs text-zinc-400"><span>Context to include</span><textarea aria-label="Context to include" className={fieldClass} rows={4} value={value.context} disabled={editingDisabled} onChange={e=>edit('context',e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error?errorId:undefined}/></label>
  <p className="text-[11px] leading-5 text-zinc-500">Only include information you are authorized to share. Do not include passwords, API keys, access tokens or other secrets.</p>
 </div>;
 return <section aria-label="Axiom Bot draft task" className="space-y-3">
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
   <label className="sr-only" htmlFor={`bot-instruction-${id}`}>What should Axiom Bot help with?</label>
   <textarea id={`bot-instruction-${id}`} aria-label="What should Axiom Bot help with?" placeholder="Give Axiom Bot a task…" className="min-h-20 w-full resize-y border-0 bg-transparent text-sm leading-6 text-zinc-200 outline-none placeholder:text-zinc-500" rows={3} value={value.task} disabled={editingDisabled} onChange={e=>edit('task',e.target.value)} aria-invalid={Boolean(error)} aria-describedby={`${guidanceId}${error?' '+errorId:''}`}/>
   <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-zinc-500">{statusText??"Draft · execution unavailable"}</span><div className="flex flex-wrap gap-2">{onSave&&<button type="button" className={`${onSend?"btn-secondary":"btn-primary"} disabled:opacity-40`} disabled={editingDisabled||saveDisabled||Boolean(error)||!value.title.trim()||!value.task.trim()} onClick={()=>{if(!editingDisabled&&!saveDisabled&&!error&&value.title.trim()&&value.task.trim())onSave(value)}}>Save task draft</button>}{onSend&&<button type="button" className="btn-primary disabled:opacity-40" disabled={editingDisabled||sendDisabled||Boolean(error)||!value.title.trim()||!value.task.trim()} onClick={()=>{if(!editingDisabled&&!sendDisabled&&!error&&value.title.trim()&&value.task.trim())onSend(value)}}>Send</button>}</div></div>
  </div>
  <p id={guidanceId} className="text-[11px] leading-5 text-zinc-500">{onSend?'Send saves this version and requests an AI response. No tools, connected apps or computer actions. Save draft uploads without executing.':onSave?'Save uploads this draft to your signed-in workspace. It does not start a task.':'Unsent draft · separate from Agent chat. No background work runs.'} Task and context: 4,000 characters each; title: 200; combined data: 16 KiB.</p>
  {error&&<p id={errorId} role="alert" className="text-xs text-rose-300">{error}</p>}
  {detailsTarget?createPortal(metadata,detailsTarget):<details className="text-sm text-zinc-400"><summary>Task details</summary><div className="pt-4">{metadata}</div></details>}
 </section>;
}

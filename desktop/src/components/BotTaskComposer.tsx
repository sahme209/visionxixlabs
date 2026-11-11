import {useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {AxiomBotDraft} from './AxiomBotDraftTask';
interface Props {ownerKey:string;draft:AxiomBotDraft;onDraftChange:(next:AxiomBotDraft)=>void;onSave?:(draft:AxiomBotDraft)=>void;onSend?:(draft:AxiomBotDraft)=>void;sendDisabled?:boolean;statusText?:string;editingDisabled?:boolean;saveDisabled?:boolean;onCandidateChange?:(invalid:boolean)=>void;detailsTarget?:HTMLElement|null}
/** Editing never uploads. Save and Send are separate explicit actions. */
export function BotTaskComposer({ownerKey,draft,onDraftChange,onSave,onSend,sendDisabled=true,statusText,editingDisabled=false,saveDisabled=false,onCandidateChange,detailsTarget}:Props){
 const id=useId(),errorId=`bot-composer-error-${id}`,guidanceId=`bot-composer-guidance-${id}`,sizeId=`bot-composer-size-${id}`;
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
 const inputRef=useRef<HTMLTextAreaElement>(null);
 useLayoutEffect(()=>{const input=inputRef.current;if(input){input.style.height='auto';input.style.height=`${Math.min(144,Math.max(64,input.scrollHeight))}px`}},[value.task]);
 const sendReady=Boolean(onSend)&&!editingDisabled&&!sendDisabled&&!error&&Boolean(value.title.trim()&&value.task.trim());
 const sendDraft=()=>{if(sendReady)onSend?.(value)};
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
  <label className="block space-y-2 text-xs text-zinc-400"><span>Bot task title</span><input data-help-id="bot.composer.title" aria-label="Bot task title" className={fieldClass} value={value.title} disabled={editingDisabled} onChange={e=>edit('title',e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error?errorId:undefined}/></label>
  <label className="block space-y-2 text-xs text-zinc-400"><span>Context to include</span><textarea data-help-id="bot.composer.context" aria-label="Context to include" className={fieldClass} rows={4} value={value.context} disabled={editingDisabled} onChange={e=>edit('context',e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error?errorId:undefined}/></label>
  <p className="text-[11px] leading-5 text-zinc-500">Task and context: 4,000 characters each; title: 200; combined data: 16 KiB. Only include information you are authorized to share. Do not include passwords, API keys, access tokens or other secrets.</p>
 </div>;
 return <section aria-label="Axiom Bot draft task" className="space-y-3">
  <div className="bot-prompt-surface rounded-2xl border border-white/10 p-3">
   <label className="sr-only" htmlFor={`bot-instruction-${id}`}>What should Axiom Bot help with?</label>
   <textarea data-help-id="bot.composer.instruction" ref={inputRef} id={`bot-instruction-${id}`} aria-label="What should Axiom Bot help with?" placeholder="Give Axiom Bot a task…" className="min-h-16 max-h-36 w-full resize-none overflow-y-auto border-0 bg-transparent px-1 py-2 text-sm leading-6 text-zinc-200 outline-hidden placeholder:text-zinc-500" rows={2} value={value.task} disabled={editingDisabled} onChange={e=>edit('task',e.target.value)} onKeyDown={e=>{if(onSend&&e.key==='Enter'&&!e.shiftKey&&!e.altKey&&!e.nativeEvent.isComposing&&e.nativeEvent.keyCode!==229){e.preventDefault();sendDraft()}}} aria-invalid={Boolean(error)} aria-describedby={`${guidanceId} ${sizeId}${error?' '+errorId:''}`}/>
   <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="space-y-1"><span className="block text-xs text-zinc-500">{statusText??"Draft · execution unavailable"}</span><span id={sizeId} className="block text-[11px] tabular-nums text-zinc-500">{value.task.length.toLocaleString("en-US")} / 4,000 instruction · {value.context.length.toLocaleString("en-US")} / 4,000 context characters</span></div><div className="flex flex-wrap gap-2">{onSave&&<button data-help-id="bot.composer.save" type="button" className={`${onSend?"btn-secondary":"btn-primary"} disabled:opacity-40`} disabled={editingDisabled||saveDisabled||Boolean(error)||!value.title.trim()||!value.task.trim()} onClick={()=>{if(!editingDisabled&&!saveDisabled&&!error&&value.title.trim()&&value.task.trim())onSave(value)}}>Save task draft</button>}{onSend&&<button data-help-id="bot.composer.send" type="button" className="btn-primary bot-send-button disabled:opacity-40" disabled={!sendReady} onClick={sendDraft}>Send</button>}</div></div>
  </div>
  <p id={guidanceId} className="text-[11px] leading-5 text-zinc-500">{onSend?'AI response only · No app changes. Enter to send, Shift + Enter for a new line. Save draft does not start a task.':onSave?'Save uploads this draft to your signed-in workspace. It does not start a task.':'Unsent draft · separate from Agent chat. No background work runs.'}</p>

  {error&&<p id={errorId} role="alert" className="text-xs text-rose-300">{error}</p>}
  {detailsTarget?createPortal(metadata,detailsTarget):<details className="text-sm text-zinc-400"><summary data-help-id="bot.composer.details">Task details</summary><div className="pt-4">{metadata}</div></details>}
 </section>;
}

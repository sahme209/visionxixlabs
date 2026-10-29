import {useId,useState} from 'react';
export type AxiomBotDraft={ownerKey:string;title:string;task:string;context:string};
/** Unsent local editor only. The host retains its controlled draft and derives
 * ownerKey from the current workspace/actor/context; it is isolation metadata,
 * never authentication or provider authority. The optional host Save callback is explicit. */
export function AxiomBotDraftTask({ownerKey,draft,onDraftChange,active=true,onSave,editingDisabled=false,saveDisabled=false,onCandidateChange}:{ownerKey:string;draft:AxiomBotDraft;onDraftChange:(next:AxiomBotDraft)=>void;active?:boolean;onSave?:(value:AxiomBotDraft)=>void;editingDisabled?:boolean;saveDisabled?:boolean;onCandidateChange?:(value:boolean)=>void}){
 const instance=useId(),errorId=`axiom-bot-draft-error-${instance}`,guidanceId=`axiom-bot-draft-guidance-${instance}`;
 // A rejected paste stays visible for correction. It cannot replace the host's
 // last bounded draft, and a changed host draft/owner discards this local copy.
 const [candidate,setCandidate]=useState<{base:AxiomBotDraft;value:AxiomBotDraft}>();
 const owned=Boolean(ownerKey)&&draft.ownerKey===ownerKey;
 const value=candidate?.base===draft&&candidate.value.ownerKey===ownerKey?candidate.value:draft;
 const validate=(v:AxiomBotDraft)=>{
  if(v.title.length>200)return 'Keep the title within 200 characters. Your full text is retained here for correction.';
  if(v.task.length>4000||v.context.length>4000)return 'Keep task and context within 4,000 characters each. Your full text is retained here for correction.';
  if(new TextEncoder().encode(JSON.stringify({title:v.title,task:v.task,context:v.context})).byteLength>16384)return 'The combined draft exceeds the 16 KiB data limit. Shorten it before retaining these changes; your full text is shown here.';
  return undefined;
 };
 const error=owned?validate(value):undefined;
 function edit(field:'title'|'task'|'context',text:string){
  if(!owned||editingDisabled)return;
  const next={...value,[field]:text,ownerKey};
  if(validate(next)){setCandidate({base:draft,value:next});onCandidateChange?.(true);return;}
  setCandidate(undefined);onCandidateChange?.(false);onDraftChange(next);
 }
 const input='w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200';
 return <section hidden={!active} aria-label="Axiom Bot draft task" className="space-y-5">
  <aside className="border-t border-white/10 pt-4 text-sm leading-6 text-zinc-400"><p className="font-semibold text-zinc-200">Task execution is unavailable</p><p className="mt-1">{onSave?"Saving a draft does not run it. Approved routines and governed execution remain unavailable.":"Persistent tasks, approved routines and governed execution are not implemented here."}</p><p className="mt-1">No background work runs from this draft.</p></aside>
  <p className="text-sm text-zinc-400">{onSave?"Task draft · separate from Agent chat":"Unsent draft · separate from Agent chat"}</p>
  {!owned?<p role="alert" className="text-xs text-amber-300">Workspace changed. Open a draft owned by the selected workspace before editing.</p>:<>
   <p id={guidanceId} className="text-xs text-zinc-400">Do not include passwords, API keys, access tokens, private keys or other secrets. Include only information you are authorized to share.</p>
   <div className="space-y-3">
    <label className="block space-y-1 text-xs text-zinc-400"><span>Bot task title</span><input aria-label="Bot task title" className={input} disabled={editingDisabled} value={value.title} onChange={e=>edit('title',e.target.value)} aria-invalid={Boolean(error)} aria-describedby={`${guidanceId}${error?' '+errorId:''}`} /></label>
    <label className="block space-y-1 text-xs text-zinc-400"><span>What should Axiom Bot help with?</span><textarea aria-label="What should Axiom Bot help with?" className={input} disabled={editingDisabled} rows={4} value={value.task} onChange={e=>edit('task',e.target.value)} aria-invalid={Boolean(error)} aria-describedby={`${guidanceId}${error?' '+errorId:''}`} /></label>
    <label className="block space-y-1 text-xs text-zinc-400"><span>Context to include</span><textarea aria-label="Context to include" className={input} disabled={editingDisabled} rows={3} value={value.context} onChange={e=>edit('context',e.target.value)} aria-invalid={Boolean(error)} aria-describedby={`${guidanceId}${error?' '+errorId:''}`} /></label>
   </div>
   {onSave&&<div className="space-y-2"><button type="button" className="btn-primary disabled:opacity-40" disabled={editingDisabled||saveDisabled||Boolean(error)||!value.title.trim()||!value.task.trim()} onClick={()=>{if(!editingDisabled&&!saveDisabled&&!error&&value.title.trim()&&value.task.trim())onSave(value)}}>Save task draft</button><p className="text-xs text-zinc-500">Save uploads this draft to your signed-in workspace. It does not start a task.</p></div>}
   {error&&<p id={errorId} role="alert" className="text-xs text-amber-300">{error}</p>}
   <p className="text-[11px] text-zinc-500">Title: 200 characters. Task and context: 4,000 characters each. Combined data: 16 KiB. These are Axiom input limits, not provider work or spending limits.</p>
  </>}

 </section>;
}

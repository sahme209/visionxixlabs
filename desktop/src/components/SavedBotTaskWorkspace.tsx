import {BotConnectedActionsPanel} from './BotConnectedActionsPanel';
import {JiraTicketDiscovery} from './JiraTicketDiscovery';
import {BotAppActionLauncher} from './BotAppActionLauncher';
import type {ComputerInputRecoveryIdentity} from '../lib/computerInputRecoveryStore';
import {BotComputerInputPanel} from './BotComputerInputPanel';
import type {ComputerInputSelectionRef} from '../lib/computerInputContract';
import {BotComputerObservationPanel} from './BotComputerObservationPanel';
import {BotPullRequestEvidencePanel,type SelectedBotEvidence} from './BotPullRequestEvidencePanel';
import {useBotAiTask} from '../lib/useBotAiTask';
import {BotAiTaskActivity} from './BotAiTaskActivity';
import {AgentModelSelector} from './AgentModelSelector';
import {useEffect,useRef,useState} from "react";
import type {AxiomBotDraft} from "./AxiomBotDraftTask";
import {BotReadinessReportPanel} from "./BotReadinessReportPanel";
import {BotTaskComposer} from "./BotTaskComposer";
import {desktopClient} from "../lib/desktopClient";
import type {SavedBotTaskDto,SavedBotTaskSummaryDto,SavedBotTaskContentDto,SavedBotTaskHistoryDto} from "../../../lib/axiom/bot/savedTaskContract";
interface PendingSave {content:SavedBotTaskContentDto;clientRequestId:string;taskId?:string;expectedVersion?:number}
interface Props {canManageActions?:boolean;recoveryIdentity?:ComputerInputRecoveryIdentity;observationIdentity?:{workspaceId:string;actorId:string};ownerKey:string;draft:AxiomBotDraft;onDraftChange:(draft:AxiomBotDraft)=>void;active?:boolean}
/** Saved task editing, explicit tool-free Send, and the separate fixed readiness report. */
export function SavedBotTaskWorkspace({recoveryIdentity,observationIdentity,ownerKey,draft,onDraftChange,active=true,canManageActions=false}:Props){
 const ai=useBotAiTask(ownerKey);
 const [inputSelection,setInputSelection]=useState<ComputerInputSelectionRef|null>(null);
 const [preparingSend,setPreparingSend]=useState(false);
 const [actionsOpen,setActionsOpen]=useState(false);
 const [connectedProvider,setConnectedProvider]=useState<'slack'|'teams'|'linear'|null>(null);
 const [jiraOpen,setJiraOpen]=useState<string|null>(null);
 const [selectedEvidence,setSelectedEvidence]=useState<SelectedBotEvidence|null>(null);
 const latestDraft=useRef(draft);latestDraft.current=draft;
 const [inspectorTab,setInspectorTab]=useState<"Details"|"Library"|"Computer">("Details"),[inspectorOpen,setInspectorOpen]=useState(false),[tasksOpen,setTasksOpen]=useState(false),[filter,setFilter]=useState("");
 const [wideInspector,setWideInspector]=useState(()=>typeof window.matchMedia==='function'&&window.matchMedia('(min-width: 1280px)').matches);
 useEffect(()=>{if(typeof window.matchMedia!=='function')return;const media=window.matchMedia('(min-width: 1280px)'),update=()=>setWideInspector(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 const [detailsTarget,setDetailsTarget]=useState<HTMLDivElement|null>(null);
 const tasksTrigger=useRef<HTMLButtonElement>(null),detailsTrigger=useRef<HTMLButtonElement>(null),taskFilter=useRef<HTMLInputElement>(null),inspector=useRef<HTMLElement>(null);
 useEffect(()=>{if(tasksOpen)taskFilter.current?.focus()},[tasksOpen]);
 useEffect(()=>{if(inspectorOpen)inspector.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus()},[inspectorOpen]);
 function closeTasks(){setTasksOpen(false);tasksTrigger.current?.focus()}
 function closeInspector(){setInspectorOpen(false);detailsTrigger.current?.focus()}
 const initialConfig=useRef(desktopClient.config).current,initialRevision=useRef(desktopClient.getContextRevision()).current;
 const mounted=useRef(true),operation=useRef<AbortController|null>(null),requestKey=useRef<string|undefined>(undefined);
 if(!requestKey.current)requestKey.current=crypto.randomUUID();
 const [selected,setSelected]=useState<SavedBotTaskDto|null>(null),[rows,setRows]=useState<SavedBotTaskSummaryDto[]>([]),[nextCursor,setNextCursor]=useState<string|null>(null);
 const [listState,setListState]=useState<"idle"|"loading"|"ready"|"error">("idle");
 const [busy,setBusy]=useState<"list"|"open"|"save"|"history">(),[error,setError]=useState<string>(),[note,setNote]=useState<string>();
 const [pending,setPending]=useState<PendingSave>(),[confirmOpen,setConfirmOpen]=useState<string>(),[conflict,setConflict]=useState(false);
 const [history,setHistory]=useState<SavedBotTaskHistoryDto>(),[candidate,setCandidate]=useState(false),[editorGeneration,setEditorGeneration]=useState(0);
 const jiraScope=JSON.stringify([ownerKey,selected?.id??null,selected?.version??null]);
 if(jiraOpen!==null&&(!active||!actionsOpen||jiraOpen!==jiraScope))setJiraOpen(null);
 const owns=()=>mounted.current&&desktopClient.config===initialConfig&&desktopClient.getContextRevision()===initialRevision&&draft.ownerKey===ownerKey;
 const current=(controller:AbortController)=>owns()&&operation.current===controller;
 const dirty=candidate||(selected?draft.title!==selected.title||draft.task!==selected.instruction||draft.context!==selected.context:Boolean(draft.title||draft.task||draft.context));
 // Invalidate during render so an edit followed by revert cannot restore an old opt-in.
 if(selectedEvidence&&(dirty||!selected||selectedEvidence.taskId!==selected.id||selectedEvidence.taskVersion!==selected.version||!owns()))setSelectedEvidence(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current?.abort();operation.current=null}},[]);
 function begin(kind:typeof busy){if(!owns()||operation.current)return null;const controller=new AbortController();operation.current=controller;setBusy(kind);setError(undefined);setNote(undefined);return controller}
 function finish(controller:AbortController){if(operation.current===controller){operation.current=null;if(mounted.current)setBusy(undefined)}}
 async function loadList(cursor?:string){
  const controller=begin("list");if(!controller)return;setListState("loading");
  try{const result=await desktopClient.listSavedBotTasks(cursor,controller.signal);if(!current(controller))return;
   if(result.ok){setRows(previous=>cursor?[...previous,...result.data.tasks.filter(task=>!previous.some(existing=>existing.id===task.id))]:result.data.tasks);setNextCursor(result.data.nextCursor);setListState("ready")}
   else{setError(result.error);setListState("error")}
  }catch{if(current(controller)){setError("Saved tasks are unavailable. Your unsent text is retained.");setListState("error")}}finally{finish(controller)}
 }
 useEffect(()=>{if(active&&listState==="idle"&&!busy)void loadList()},[active,listState,busy]);
 function replaceEditor(task:SavedBotTaskDto|null){
  setSelectedEvidence(null);setInspectorTab("Details");setSelected(task);setCandidate(false);setEditorGeneration(value=>value+1);setHistory(undefined);setConflict(false);setPending(undefined);setConfirmOpen(undefined);requestKey.current=crypto.randomUUID();
  onDraftChange({ownerKey,title:task?.title??"",task:task?.instruction??"",context:task?.context??""});
 }
 async function openSaved(id:string){
  if(!owns()||operation.current||pending)return;
  if(id==="new"){replaceEditor(null);return}
  const controller=begin("open");if(!controller)return;
  try{const result=await desktopClient.getSavedBotTask(id,controller.signal);if(!current(controller))return;if(result.ok)replaceEditor(result.data.task);else setError(result.error)}
  catch{if(current(controller))setError("The saved draft could not be opened. Your current text is retained.")}finally{finish(controller)}
 }
 function requestOpen(id:string){if(busy||pending||!owns())return;if(dirty)setConfirmOpen(id);else void openSaved(id)}
 async function save(value?:AxiomBotDraft,retry?:PendingSave,verifyForSend=false){
  if(conflict&&!retry)return;
  const snapshot=retry??(value?{content:{title:value.title,instruction:value.task,context:value.context},clientRequestId:requestKey.current!,...(selected?{taskId:selected.id,expectedVersion:selected.version}:{})}:undefined);
  if(!snapshot)return;const controller=begin("save");if(!controller)return;setConfirmOpen(undefined);
  try{
   const result=snapshot.taskId?await desktopClient.updateSavedBotTask(snapshot.taskId,{...snapshot.content,expectedVersion:snapshot.expectedVersion!},controller.signal):await desktopClient.createSavedBotTask({...snapshot.content,clientRequestId:snapshot.clientRequestId},controller.signal);
   if(!current(controller))return;
   if(result.ok){if(verifyForSend&&(result.data.task.title!==snapshot.content.title.trim()||result.data.task.instruction!==snapshot.content.instruction||result.data.task.context!==snapshot.content.context)){setError("The saved version does not match the explicit instruction. Your editor text is retained; review the saved version before sending.");setSelected(result.data.task);setConflict(true);return}replaceEditor(result.data.task);setNote("Task draft saved. No execution started.");setListState("idle");return result.data.task}
   else{setError(result.error);setPending(result.outcomeUnconfirmed?snapshot:undefined);setConflict(result.errorCode==="saved_task_conflict_reload_before_saving")}
  }catch{if(current(controller)){setError("The save outcome is unconfirmed. Retry the same save when the service is available.");setPending(snapshot)}}finally{finish(controller)}
 }
 async function send(value:AxiomBotDraft){
  if(!owns()||preparingSend||busy||pending||conflict||candidate||!ai.canSend)return;
  const context=selectedEvidence&&!dirty&&selectedEvidence.taskId===selected?.id&&selectedEvidence.taskVersion===selected.version?selectedEvidence.evidenceContext:undefined;
  setPreparingSend(true);setError(undefined);
  try{
   const exact=selected&&value.title===selected.title&&value.task===selected.instruction&&value.context===selected.context?selected:await save(value,undefined,true);
   if(!owns()||!exact)return;
   const live=latestDraft.current;
   if(exact.title!==value.title.trim()||exact.instruction!==value.task||exact.context!==value.context||live.title.trim()!==value.title.trim()||live.task!==value.task||live.context!==value.context){setError("The saved version does not match the explicit instruction. Review it before sending.");return}
   setNote(undefined);if(context&&exact.id===selected?.id&&exact.version===selected.version)await ai.send(exact,context);else await ai.send(exact);
  }finally{if(mounted.current)setPreparingSend(false)}
 }
 async function loadHistory(beforeVersion?:number){
  if(!selected)return;const controller=begin("history");if(!controller)return;
  try{const result=await desktopClient.savedBotTaskHistory(selected.id,beforeVersion,controller.signal);if(!current(controller))return;
   if(result.ok)setHistory(previous=>beforeVersion!==undefined&&previous?{...result.data,events:[...previous.events,...result.data.events.filter(event=>!previous.events.some(existing=>existing.version===event.version))]}:result.data);else setError(result.error)
  }catch{if(current(controller))setError("Saved history is unavailable. Your editor text is retained.")}finally{finish(controller)}
 }
 if(!owns())return <p role="status" className="p-6 text-sm text-zinc-400">Workspace changed. Reopen Axiom Bot in the current workspace.</p>;
 const aiLocked=preparingSend||ai.sending||ai.uncertain;
 const locked=aiLocked||busy==="save"||busy==="open"||Boolean(pending);
 const visibleRows=rows.filter(task=>task.title.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
 return <div onKeyDown={event=>{if(event.key==="Escape"){if(tasksOpen){event.preventDefault();closeTasks()}else if(inspectorOpen){event.preventDefault();closeInspector()}}}} className="relative flex min-h-0 flex-1 overflow-hidden">
  <aside id={`bot-task-list-${ownerKey}`} aria-label="Bot task list" className={`${tasksOpen?'flex':'hidden'} absolute inset-y-0 left-0 z-20 w-56 shrink-0 flex-col border-r border-white/10 bg-zinc-950 p-4 xl:static xl:flex xl:w-52`}>
   <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-white">Tasks</h2><button type="button" className="text-xs text-zinc-400 underline" disabled={Boolean(busy)} onClick={()=>void loadList()}>Refresh saved tasks</button></div>
   <button type="button" className="mt-3 text-left text-xs text-zinc-400 xl:hidden" onClick={closeTasks}>Close task list</button>
   <label className="mt-5"><span className="sr-only">Filter loaded tasks</span><input ref={taskFilter} aria-label="Filter loaded tasks" placeholder="Filter loaded tasks" value={filter} onChange={e=>setFilter(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200"/></label>
   <div className="min-h-0 flex-1 overflow-y-auto pt-4">
    {listState==="ready"&&rows.length===0&&<p className="text-xs leading-5 text-zinc-500">No saved task drafts yet. Save a draft when you are ready.</p>}
    {listState==="ready"&&rows.length>0&&visibleRows.length===0&&<p className="text-xs text-zinc-500">No loaded tasks match.</p>}
    {listState==="error"&&<p className="text-xs leading-5 text-zinc-500">Saved tasks could not be loaded. Refresh to retry; the editor is retained.</p>}
    <ul className="space-y-2">{visibleRows.map(task=><li key={task.id}><button type="button" aria-label={`Open saved task ${task.title}`} aria-current={selected?.id===task.id?"true":undefined} className={`w-full rounded-lg p-3 text-left text-sm text-zinc-200 disabled:opacity-40 ${selected?.id===task.id?'bg-white/5':'hover:bg-white/5'}`} disabled={Boolean(busy)||Boolean(pending)||aiLocked} onClick={()=>requestOpen(task.id)}><span className="block break-words">{task.title}</span><span className="mt-2 block text-[11px] text-zinc-500">Draft · version {task.version}</span></button></li>)}</ul>
    {nextCursor&&<button type="button" className="btn-secondary mt-3" disabled={Boolean(busy)} onClick={()=>void loadList(nextCursor)}>More saved tasks</button>}
   </div>
  </aside>
  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
   <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
    <div className="flex min-w-0 items-center gap-3"><button type="button" ref={tasksTrigger} className="btn-secondary xl:hidden" aria-controls={`bot-task-list-${ownerKey}`} aria-expanded={tasksOpen} onClick={()=>{setTasksOpen(!tasksOpen);setInspectorOpen(false)}}>Tasks</button><h1 className="truncate text-sm font-medium text-zinc-200">{selected?.title??"New task"}</h1><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-500">Draft</span></div>
    <div className="flex gap-2"><button type="button" className="btn-secondary" aria-expanded={actionsOpen} onClick={()=>setActionsOpen(!actionsOpen)}>App actions</button><button type="button" className="btn-secondary" disabled={Boolean(busy)||Boolean(pending)||aiLocked} onClick={()=>requestOpen("new")}>New draft</button><button type="button" ref={detailsTrigger} className="btn-secondary xl:hidden" aria-controls={`bot-task-inspector-${ownerKey}`} aria-expanded={inspectorOpen} onClick={()=>{setInspectorOpen(!inspectorOpen);setTasksOpen(false)}}>Task details</button></div>
   </header>
   <section aria-label="Bot task activity" className="min-h-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
    <div className="mx-auto w-full max-w-3xl space-y-5">
     {actionsOpen&&<BotAppActionLauncher saved={Boolean(selected)} dirty={dirty} disabled={locked} onOpen={action=>{if(action==='slack'||action==='teams'||action==='linear'){setConnectedProvider(action);return}if(action==='jira'){setJiraOpen(jiraScope);return}setInspectorTab(action==='report'?'Library':'Details');setInspectorOpen(true);setTasksOpen(false)}}/>}
     {actionsOpen&&connectedProvider&&selected&&!dirty&&!locked&&<BotConnectedActionsPanel key={`${selected.id}:${selected.version}:${connectedProvider}`} provider={connectedProvider} sourceTask={{taskId:selected.id,expectedVersion:selected.version}} canManage={canManageActions} onClose={()=>setConnectedProvider(null)}/>}
     {active&&actionsOpen&&jiraOpen===jiraScope&&<section aria-label="Bot Jira form exploration" className="space-y-3"><div className="flex items-center justify-between gap-3"><p className="text-xs leading-5 text-zinc-400">Live read-only form exploration. Choices are not saved as task execution evidence.</p><button type="button" className="text-xs text-zinc-400 underline" onClick={()=>setJiraOpen(null)}>Close Jira form</button></div><JiraTicketDiscovery key={`${selected?.id??'unsaved'}:${selected?.version??0}`} owner={{config:initialConfig,revision:initialRevision}} readCurrentOwner={()=>({config:desktopClient.config,revision:desktopClient.getContextRevision()})}/></section>}
     {selected?<article className="rounded-2xl border border-white/10 p-5"><p className="text-xs text-zinc-500">Saved instruction · version {selected.version}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-200">{selected.instruction}</p><p className="mt-4 text-[11px] text-zinc-500">Saved instruction. Responses are recorded separately below.</p></article>:<div className="py-12 lg:py-20"><img src="/axiom-logo.png" alt="" className="mb-6 h-10 w-10 object-contain" /><h2 className="text-2xl font-medium tracking-tight text-white lg:text-3xl">What can I take off your plate?</h2><p className="mt-4 max-w-lg text-sm leading-7 text-zinc-400">Describe the outcome below. Send for an AI response, or save a draft to return later. Context and history stay with the task.</p></div>}
     {!ai.error&&(ai.loading||!ai.enabled)&&<p className="text-xs leading-5 text-zinc-500">{ai.loading?"Checking AI task availability. Your draft stays editable.":"AI task execution is not enabled on this service. Save a draft to keep working without sending."}</p>}
     {selected&&(ai.blockedTaskIds?.includes(selected.id)||ai.blockedTaskId===selected.id)&&<p role="status" className="text-sm leading-6 text-zinc-400">This task has an unconfirmed earlier call. Review Recent AI task activity, or start a new draft for distinct work. The original will not be sent again.</p>}
     <BotAiTaskActivity ai={ai} taskId={selected?.id} onOpenTask={requestOpen} onNewTask={()=>requestOpen("new")}/>
     {selected&&<section aria-label="Saved AI task activity" className="space-y-2"><button type="button" className="text-xs text-zinc-400 underline" disabled={ai.checking||ai.sending||ai.uncertain||preparingSend} onClick={()=>void ai.loadRecent(selected.id)}>Recent AI task activity</button>{ai.recent?.filter(item=>item.taskId===selected.id).map(item=><button key={item.id} type="button" className="block text-left text-xs text-zinc-400 underline" disabled={ai.checking||ai.sending||ai.uncertain} onClick={()=>void ai.openRecordedRun(item)}>Version {item.taskVersion} · {item.status.replaceAll("_"," ")} · {new Date(item.createdAt).toLocaleString()}</button>)}</section>}
     {confirmOpen&&<aside role="alert" className="rounded-lg border border-white/10 p-4 text-sm text-zinc-300"><p>{confirmOpen==="new"?"Starting a new draft clears unsaved text in this editor.":"Opening the saved version replaces unsaved text in this editor."} Your saved history is preserved.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" className="btn-secondary" onClick={()=>setConfirmOpen(undefined)}>Keep editing</button><button type="button" className="btn-secondary" onClick={()=>{const id=confirmOpen;setConfirmOpen(undefined);void openSaved(id)}}>{confirmOpen==="new"?"Start new draft":"Open saved draft"}</button></div></aside>}
     {busy&&<p role="status" className="text-sm text-zinc-400">{busy==="save"?"Saving task draft…":busy==="open"?"Opening saved draft…":busy==="history"?"Loading saved history…":"Loading saved tasks…"}</p>}
     {note&&<p role="status" className="text-sm text-zinc-300">{note}</p>}
     {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
     {pending&&<div className="space-y-2 text-sm text-zinc-400"><p>The editor is retained while this save is unconfirmed. Retrying uses the same content and save identifier.</p><button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={()=>void save(undefined,pending)}>Retry same save</button></div>}
     {conflict&&selected&&<div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={()=>requestOpen(selected.id)}>Review saved version</button><button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={()=>{setSelected(null);setConflict(false);setHistory(undefined);requestKey.current=crypto.randomUUID();setNote("Your edits are retained as a new unsaved draft. Saving will create a separate task draft.")}}>Keep edits as new draft</button></div>}
    </div>
   </section>
   <footer className="shrink-0 border-t border-white/10 px-5 py-4 lg:px-8"><div className="mx-auto max-w-3xl"><div className="mb-3 flex min-h-10 flex-wrap items-center gap-3"><span className="text-xs text-zinc-500">{ai.loading?"Checking AI setup…":ai.enabled?"AI response only":"Drafts available · AI sending unavailable"}</span><button type="button" className="text-xs text-zinc-400 underline" disabled={ai.loading||preparingSend||ai.sending} onClick={()=>void ai.refresh()}>Refresh AI setup</button>{ai.enabled&&<AgentModelSelector label="Bot" options={ai.models} value={ai.modelKey} onChange={ai.chooseModel} disabled={locked||ai.loading} loading={ai.loading}/>}</div>{selectedEvidence&&<section aria-label="Selected AI evidence" className="mb-3 rounded-lg border border-white/10 p-3 text-xs text-zinc-400"><div className="flex items-start justify-between gap-3"><span>{selectedEvidence.repositoryFullName} #{selectedEvidence.pullRequestNumber} · recorded {new Date(selectedEvidence.observedAt).toLocaleString()}</span><button type="button" className="underline" disabled={locked} onClick={()=>setSelectedEvidence(null)}>Clear selected evidence</button></div><p className="mt-2">Recorded snapshot; source may have changed. Send shares this evidence with your approved AI provider. No tools or changes.</p></section>}<BotTaskComposer key={`${ownerKey}:${editorGeneration}`} ownerKey={ownerKey} draft={draft} onDraftChange={onDraftChange} onSave={value=>void save(value)} onSend={value=>void send(value)} sendDisabled={!ai.canSend||Boolean(selected&&(ai.blockedTaskIds?.includes(selected.id)||ai.blockedTaskId===selected.id))||Boolean(busy)||conflict||preparingSend} statusText={ai.sending?"Sending…":preparingSend?"Saving exact instruction…":ai.enabled?"Instruction ready":"Draft · AI sending unavailable"} editingDisabled={locked} saveDisabled={Boolean(busy)||conflict} onCandidateChange={setCandidate} detailsTarget={detailsTarget}/></div></footer>
  </div>
  <aside ref={inspector} id={`bot-task-inspector-${ownerKey}`} aria-label="Saved task details" className={`${inspectorOpen?'block':'hidden'} absolute inset-y-0 right-0 z-20 w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-zinc-950 p-5 xl:static xl:block`}>
   <div role="tablist" aria-label="Bot task inspector" className="flex gap-1 border-b border-white/10 pb-4">{(["Details","Library","Computer"] as const).map(tab=><button key={tab} type="button" role="tab" id={`bot-tab-${ownerKey}-${tab}`} aria-selected={inspectorTab===tab} tabIndex={inspectorTab===tab?0:-1} onKeyDown={event=>{const tabs=["Details","Library","Computer"] as const;const index=tabs.indexOf(tab);const next=event.key==="ArrowRight"?tabs[(index+1)%3]:event.key==="ArrowLeft"?tabs[(index+2)%3]:event.key==="Home"?tabs[0]:event.key==="End"?tabs[2]:undefined;if(next){event.preventDefault();setInspectorTab(next);const sibling=event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[id="bot-tab-${ownerKey}-${next}"]`);sibling?.focus()}}} aria-controls={`bot-panel-${ownerKey}-${tab}`} className={`rounded-lg px-3 py-2 text-xs ${inspectorTab===tab?'bg-white/5 text-zinc-200':'text-zinc-500'}`} onClick={()=>setInspectorTab(tab)}>{tab==='Library'?'Workspace report':tab}</button>)}</div>
   <button type="button" className="mt-3 text-xs text-zinc-400 underline xl:hidden" onClick={closeInspector}>Close task details</button>
   <div role="tabpanel" id={`bot-panel-${ownerKey}-Details`} aria-labelledby={`bot-tab-${ownerKey}-Details`} hidden={inspectorTab!=="Details"} className="space-y-5 pt-5">
    <p className="text-sm text-zinc-300">{selected&&!dirty?`Saved draft · version ${selected.version}`:selected?"Unsaved changes":"Unsent local draft"}</p>
    <div ref={setDetailsTarget}/>
    <p className="text-[11px] leading-5 text-zinc-500">Saved drafts and history belong to your current signed-in workspace and creator. No connected-app or execution access is granted.</p>
    {selected&&<button type="button" className="btn-secondary" disabled={Boolean(busy)||Boolean(pending)||aiLocked} onClick={()=>void loadHistory()}>History</button>}
    <BotPullRequestEvidencePanel key={`pr:${selected?.id??"new"}:${selected?.version??0}`} ownerKey={ownerKey} task={selected} dirty={dirty} active={active&&(wideInspector||inspectorOpen)&&inspectorTab==="Details"} selectionDisabled={locked} onSelectEvidence={value=>{if(owns()&&!dirty&&!locked&&selected&&value.taskId===selected.id&&value.taskVersion===selected.version)setSelectedEvidence(value)}}/>
    {history&&<section aria-label="Saved draft history" className="space-y-3"><h2 className="text-sm font-semibold text-white">History</h2><p className="text-xs text-zinc-500">Recorded drafts only; this is not execution evidence.</p>{history.events.map(event=><details key={event.version} className="rounded-lg border border-white/10 p-3 text-xs text-zinc-400"><summary>Version {event.version}</summary><p className="mt-2">{new Date(event.occurredAt).toLocaleString()}</p><p className="mt-2 break-words font-semibold">{event.content.title}</p><p className="mt-2 whitespace-pre-wrap break-words">{event.content.instruction}</p>{event.content.context&&<p className="mt-2 whitespace-pre-wrap break-words">{event.content.context}</p>}</details>)}{history.nextBeforeVersion!==null&&<button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={()=>void loadHistory(history.nextBeforeVersion!)}>Older history</button>}</section>}
   </div>
   <div role="tabpanel" id={`bot-panel-${ownerKey}-Library`} aria-labelledby={`bot-tab-${ownerKey}-Library`} hidden={inspectorTab!=="Library"} className="pt-6"><BotReadinessReportPanel key={`${selected?.id??"new"}:${selected?.version??0}`} task={selected} dirty={dirty} active={active&&(wideInspector||inspectorOpen)&&inspectorTab==="Library"}/></div>
   <div role="tabpanel" id={`bot-panel-${ownerKey}-Computer`} aria-labelledby={`bot-tab-${ownerKey}-Computer`} hidden={inspectorTab!=="Computer"} className="pt-6"><BotComputerObservationPanel active={active&&(wideInspector||inspectorOpen)&&inspectorTab==="Computer"} owner={observationIdentity?{...observationIdentity,contextRevision:initialRevision,taskId:selected?.id??null,taskVersion:selected?.version??null}:undefined} onInputSelection={setInputSelection}/><BotComputerInputPanel recoveryIdentity={recoveryIdentity} active={active&&!dirty&&(wideInspector||inspectorOpen)&&inspectorTab==="Computer"} owner={observationIdentity?{...observationIdentity,contextRevision:initialRevision,taskId:selected?.id??null,taskVersion:selected?.version??null}:undefined} selection={inputSelection}/></div>
  </aside>
 </div>;
}

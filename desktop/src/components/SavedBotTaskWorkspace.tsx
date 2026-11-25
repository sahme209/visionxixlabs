import {ChevronDown,FileText,History,Plus,Search} from 'lucide-react';
import {BotConnectedActionsPanel} from './BotConnectedActionsPanel';
import {JiraTicketDiscovery} from './JiraTicketDiscovery';
import {BotAppActionLauncher} from './BotAppActionLauncher';
import type {ComputerInputRecoveryIdentity} from '../lib/computerInputRecoveryStore';
import {BotComputerInputPanel} from './BotComputerInputPanel';
import type {ComputerInputSelectionRef} from '../lib/computerInputContract';
import {BotComputerObservationPanel} from './BotComputerObservationPanel';
import {BotPullRequestEvidencePanel,type SelectedBotEvidence} from './BotPullRequestEvidencePanel';
import {useSearchShortcut} from "../lib/useSearchShortcut";
import {useBotAiTask} from '../lib/useBotAiTask';
import {BotAiTaskActivity} from './BotAiTaskActivity';
import {AgentModelSelector} from './AgentModelSelector';
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {createPortal} from 'react-dom';
import type {AxiomBotDraft} from "./AxiomBotDraftTask";
import {BotReadinessReportPanel} from "./BotReadinessReportPanel";
import {BotTaskComposer} from "./BotTaskComposer";
import {desktopClient} from "../lib/desktopClient";
import type {SavedBotTaskDto,SavedBotTaskSummaryDto,SavedBotTaskContentDto,SavedBotTaskHistoryDto,SavedBotTaskLastRunDto} from "../../../lib/axiom/bot/savedTaskContract";
interface PendingSave {content:SavedBotTaskContentDto;clientRequestId:string;taskId?:string;expectedVersion?:number}
interface Props {headerActionsTarget?:HTMLDivElement|null;canManageActions?:boolean;recoveryIdentity?:ComputerInputRecoveryIdentity;observationIdentity?:{workspaceId:string;actorId:string};ownerKey:string;draft:AxiomBotDraft;onDraftChange:(draft:AxiomBotDraft)=>void;active?:boolean}
/** Saved task editing, explicit tool-free Send, and the separate fixed readiness report. */
const runFamilyLabel:Record<SavedBotTaskLastRunDto["family"],string>={ai_task:"AI task",readiness_run:"Readiness run",pull_request_evidence:"Pull request evidence"};
/** Recorded facts only: run family, stored status and when it was last recorded. */
export function lastRunLabel(run:SavedBotTaskLastRunDto|null):string{
 if(!run)return "No recorded runs";
 return `Last run: ${runFamilyLabel[run.family]} · ${run.status.replaceAll("_"," ")} · ${new Date(run.recordedAt).toLocaleDateString(undefined,{day:"numeric",month:"short"})}`;
}

export function SavedBotTaskWorkspace({headerActionsTarget,recoveryIdentity,observationIdentity,ownerKey,draft,onDraftChange,active=true,canManageActions=false}:Props){
 const ai=useBotAiTask(ownerKey);
 const [inputSelection,setInputSelection]=useState<ComputerInputSelectionRef|null>(null);
 const [preparingSend,setPreparingSend]=useState(false);
 const [actionsOpen,setActionsOpen]=useState(false);
 const [connectedProvider,setConnectedProvider]=useState<'slack'|'teams'|'linear'|null>(null);
 const [jiraOpen,setJiraOpen]=useState<string|null>(null);
 const [selectedEvidence,setSelectedEvidence]=useState<SelectedBotEvidence|null>(null);
 const latestDraft=useRef(draft);latestDraft.current=draft;
 const [inspectorTab,setInspectorTab]=useState<"Details"|"Library"|"Computer">("Details"),[inspectorOpen,setInspectorOpen]=useState(false),[tasksOpen,setTasksOpen]=useState(false),[filter,setFilter]=useState("");
 const [detailsTarget,setDetailsTarget]=useState<HTMLDivElement|null>(null);
 const replacePrompt=useRef<HTMLElement>(null),replaceOpener=useRef<HTMLButtonElement|null>(null);
 const inspectorOpener=useRef<HTMLButtonElement|null>(null);
 const requestedHistory=useRef<{version?:number}|null>(null);
 const historyHeading=useRef<HTMLHeadingElement>(null);
 const focusDraftContext=useRef(false);
 const editor=useRef<HTMLDivElement>(null);
 const focusNewInstruction=useRef(false);
 function focusInstruction(){
  editor.current?.querySelector<HTMLTextAreaElement>('[data-help-id="bot.composer.instruction"]')?.focus();
 }
 const restoreInspectorFocus=useRef(false);
 const tasksTrigger=useRef<HTMLButtonElement>(null),detailsTrigger=useRef<HTMLButtonElement>(null),taskFilter=useRef<HTMLInputElement>(null),inspector=useRef<HTMLElement>(null);
 const taskList=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(tasksOpen&&!taskList.current?.contains(document.activeElement))taskFilter.current?.focus();
 },[tasksOpen]);
 useEffect(()=>{
  if(!active||typeof window.matchMedia!=="function")return;
  const wide=window.matchMedia("(min-width: 1180px)");
  function retainTaskListFocus(event:MediaQueryListEvent){
   if(!event.matches&&taskList.current?.contains(document.activeElement))setTasksOpen(true);
  }
  if(typeof wide.addEventListener==="function"){
   wide.addEventListener("change",retainTaskListFocus);
   return ()=>wide.removeEventListener("change",retainTaskListFocus);
  }
  wide.addListener?.(retainTaskListFocus);
  return ()=>wide.removeListener?.(retainTaskListFocus);
 },[active]);
 useEffect(()=>{
  if(inspectorOpen){
   if(focusDraftContext.current){
    focusDraftContext.current=false;
    const context=inspector.current?.querySelector<HTMLTextAreaElement>('[data-help-id="bot.composer.context"]');
    if(context&&!context.disabled){context.focus();return}
   }
   const historyTarget=requestedHistory.current;
   requestedHistory.current=null;
   if(historyTarget){
    const record=historyTarget.version===undefined?null:
      inspector.current?.querySelector<HTMLDetailsElement>(`[data-saved-task-version="${historyTarget.version}"]`);
    if(record){
     record.open=true;
     record.querySelector<HTMLElement>("summary")?.focus();
    }else historyHeading.current?.focus();
    return;
   }
   inspector.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus();
  }else if(restoreInspectorFocus.current){
   restoreInspectorFocus.current=false;
   const opener=inspectorOpener.current;
   if(opener?.getClientRects().length)opener.focus();
   else detailsTrigger.current?.focus();
   inspectorOpener.current=null;
  }
 },[inspectorOpen]);
 function closeTasks(){
  setTasksOpen(false);
  tasksTrigger.current?.focus();
  if(document.activeElement!==tasksTrigger.current)taskFilter.current?.focus();
 }
 function closeInspector(){restoreInspectorFocus.current=true;setInspectorOpen(false)}
 const initialConfig=useRef(desktopClient.config).current,initialRevision=useRef(desktopClient.getContextRevision()).current;
 const mounted=useRef(true),operation=useRef<AbortController|null>(null),requestKey=useRef<string|undefined>(undefined);
 if(!requestKey.current)requestKey.current=crypto.randomUUID();
 const [lastRuns,setLastRuns]=useState<Record<string,SavedBotTaskLastRunDto|null>>({}),lastRunRead=useRef<AbortController|null>(null);
 const [selected,setSelected]=useState<SavedBotTaskDto|null>(null),[rows,setRows]=useState<SavedBotTaskSummaryDto[]>([]),[nextCursor,setNextCursor]=useState<string|null>(null);
 const [listState,setListState]=useState<"idle"|"loading"|"ready"|"error">("idle");
 const [busy,setBusy]=useState<"list"|"open"|"save"|"history">(),[error,setError]=useState<string>(),[note,setNote]=useState<string>();
 const [pending,setPending]=useState<PendingSave>(),[confirmOpen,setConfirmOpen]=useState<string>(),[conflict,setConflict]=useState(false);
 useEffect(()=>{if(confirmOpen)replacePrompt.current?.focus()},[confirmOpen]);
 const [history,setHistory]=useState<SavedBotTaskHistoryDto>(),[historyError,setHistoryError]=useState<string>();
 const olderHistory=useRef<HTMLButtonElement>(null);
 const [candidate,setCandidate]=useState(false),[editorGeneration,setEditorGeneration]=useState(0);
 useLayoutEffect(()=>{
  if(!focusNewInstruction.current)return;
  focusNewInstruction.current=false;
  focusInstruction();
 },[editorGeneration]);
 const jiraScope=JSON.stringify([ownerKey,selected?.id??null,selected?.version??null]);
 if(jiraOpen!==null&&(!active||!actionsOpen||jiraOpen!==jiraScope))setJiraOpen(null);
 const owns=()=>mounted.current&&desktopClient.config===initialConfig&&desktopClient.getContextRevision()===initialRevision&&draft.ownerKey===ownerKey;
 const current=(controller:AbortController)=>owns()&&operation.current===controller;
 useSearchShortcut(taskFilter,active&&owns()&&!inspectorOpen&&!confirmOpen&&!pending);
 const dirty=candidate||(selected?draft.title!==selected.title||draft.task!==selected.instruction||draft.context!==selected.context:Boolean(draft.title||draft.task||draft.context));
 // Invalidate during render so an edit followed by revert cannot restore an old opt-in.
 if(selectedEvidence&&(dirty||!selected||selectedEvidence.taskId!==selected.id||selectedEvidence.taskVersion!==selected.version||!owns()))setSelectedEvidence(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current?.abort();operation.current=null}},[]);
 function begin(kind:typeof busy){if(!owns()||operation.current)return null;const controller=new AbortController();operation.current=controller;setBusy(kind);setError(undefined);setNote(undefined);return controller}
 function finish(controller:AbortController){if(operation.current===controller){operation.current=null;if(mounted.current)setBusy(undefined)}}
 async function loadList(cursor?:string){
  const controller=begin("list");if(!controller)return;setListState("loading");
  try{const result=await desktopClient.listSavedBotTasks(cursor,controller.signal);if(!current(controller))return;
   if(result.ok){setRows(previous=>cursor?[...previous,...result.data.tasks.filter(task=>!previous.some(existing=>existing.id===task.id))]:result.data.tasks);setNextCursor(result.data.nextCursor);setListState("ready");void loadLastRuns(result.data.tasks.map(task=>task.id))}
   else{setError(result.error);setListState("error")}
  }catch{if(current(controller)){setError("Saved tasks are unavailable. Your unsent text is retained.");setListState("error")}}finally{finish(controller)}
 }
 // Secondary read: the last recorded run per loaded task. Never blocks the list or editor; unavailable stays unknown.
 async function loadLastRuns(ids:string[]){
  if(ids.length===0)return;lastRunRead.current?.abort();const controller=new AbortController();lastRunRead.current=controller;
  try{const result=await desktopClient.listSavedBotTaskLastRuns(ids,controller.signal);if(controller.signal.aborted||!mounted.current)return;
   if(result.ok){const found=new Map(result.data.runs.map(run=>[run.taskId,run]));setLastRuns(previous=>({...previous,...Object.fromEntries(ids.map(id=>[id,found.get(id)??null]))}))}
  }catch{/* unknown stays unknown */}finally{if(lastRunRead.current===controller)lastRunRead.current=null}
 }
 useEffect(()=>()=>lastRunRead.current?.abort(),[]);
 useEffect(()=>{if(active&&listState==="idle"&&!busy)void loadList()},[active,listState,busy]);
 function replaceEditor(task:SavedBotTaskDto|null){
  setSelectedEvidence(null);setInspectorTab("Details");setSelected(task);setCandidate(false);setEditorGeneration(value=>value+1);setHistory(undefined);setHistoryError(undefined);setConflict(false);setPending(undefined);setConfirmOpen(undefined);requestKey.current=crypto.randomUUID();
  onDraftChange({ownerKey,title:task?.title??"",task:task?.instruction??"",context:task?.context??""});
 }
 async function openSaved(id:string){
  if(!owns()||operation.current||pending)return;
  if(id==="new"){
   setInspectorOpen(false);
   setTasksOpen(false);
   focusNewInstruction.current=true;
   replaceEditor(null);
   return;
  }
  const controller=begin("open");if(!controller)return;
  try{const result=await desktopClient.getSavedBotTask(id,controller.signal);if(!current(controller))return;if(result.ok)replaceEditor(result.data.task);else setError(result.error)}
  catch{if(current(controller))setError("The saved draft could not be opened. Your current text is retained.")}finally{finish(controller)}
 }
 function requestOpen(id:string,opener:HTMLButtonElement){
  if(busy||pending||!owns())return;
  if(!dirty){void openSaved(id);return}
  if(id==="new")setInspectorOpen(false);
  replaceOpener.current=opener;
  setTasksOpen(false);
  setConfirmOpen(id);
 }
 function cancelReplace(){
  setConfirmOpen(undefined);
  const opener=replaceOpener.current;
  replaceOpener.current=null;
  opener?.focus();
  if(document.activeElement!==opener)tasksTrigger.current?.focus();
 }
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
  if(!selected)return;
  const controller=begin("history");if(!controller)return;
  setHistoryError(undefined);
  try{
   const result=await desktopClient.savedBotTaskHistory(selected.id,beforeVersion,controller.signal);
   if(!current(controller))return;
   if(result.ok){
    const page=result.data;
    if(page.nextBeforeVersion===null&&olderHistory.current&&document.activeElement===olderHistory.current)historyHeading.current?.focus({preventScroll:true});
    setHistory(previous=>beforeVersion!==undefined&&previous?{...page,events:[...previous.events,...page.events.filter(event=>!previous.events.some(existing=>existing.version===event.version))]}:page);
   }else setHistoryError(result.error);
  }catch{if(current(controller))setHistoryError("Saved history is unavailable. Your editor text is retained.")}
  finally{finish(controller)}
 }
 if(!owns())return <p role="status" className="p-6 text-sm text-zinc-400">Workspace changed. Reopen V19 Bot in the current workspace.</p>;
 const aiLocked=preparingSend||ai.sending||ai.uncertain;
 const locked=aiLocked||busy==="save"||busy==="open"||Boolean(pending);
 const historyLocked=Boolean(busy)||Boolean(pending)||aiLocked;
 function openVersionHistory(opener:HTMLButtonElement,recordedVersion?:number){
  if(historyLocked||!selected||!owns())return;
  inspectorOpener.current=opener;
  requestedHistory.current={version:recordedVersion};
  setInspectorTab("Details");
  setInspectorOpen(true);
  setTasksOpen(false);
  if(recordedVersion===undefined)void loadHistory();
 }

 function openDraftContext(opener:HTMLButtonElement){
  if(locked||inspectorOpen||!owns())return;
  inspectorOpener.current=opener;
  focusDraftContext.current=true;
  setInspectorTab("Details");
  setTasksOpen(false);
  setInspectorOpen(true);
 }

 const newTaskButton=<button data-help-id="bot.workspace.new-draft" type="button"
  className={headerActionsTarget?"btn-primary studio-task-new":"btn-secondary"}
  disabled={Boolean(busy)||Boolean(pending)||aiLocked} onClick={event=>requestOpen("new",event.currentTarget)}>
  {headerActionsTarget&&<Plus aria-hidden="true" size={15}/>}New draft
 </button>;
 const visibleRows=rows.filter(task=>task.title.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
 return <div onKeyDown={event=>{if(event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return;if(event.key==="Escape"&&!event.defaultPrevented){if(confirmOpen){event.preventDefault();cancelReplace()}else if(tasksOpen){event.preventDefault();closeTasks()}else if(inspectorOpen){event.preventDefault();closeInspector()}}}} className="bot-task-workbench relative flex min-h-0 flex-1 overflow-hidden">
  {headerActionsTarget&&createPortal(newTaskButton,headerActionsTarget)}
  <section ref={taskList} id={`bot-task-list-${ownerKey}`} aria-label="Bot task list" className={`studio-task-list ${tasksOpen?'flex':'hidden'} absolute inset-y-0 left-0 z-20 w-56 shrink-0 flex-col border-r border-white/10 bg-zinc-950 p-4 shadow-2xl`}>
   <button data-help-id="bot.workspace.tasks-close" type="button" className="mb-3 text-left text-xs text-zinc-400" onClick={closeTasks}>Close task list</button>
   <label className="studio-task-search">
    <Search size={15} aria-hidden="true"/>
    <input data-help-id="bot.workspace.tasks-filter" ref={taskFilter} type="text" aria-label="Filter loaded tasks" aria-keyshortcuts="/" placeholder="Filter loaded tasks" value={filter} onChange={e=>setFilter(e.target.value)}/>
    <kbd aria-hidden="true">/</kbd>
   </label>
   <div className="studio-task-list-heading flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-white">Tasks</h2><button data-help-id="bot.workspace.tasks-refresh" type="button" className="text-xs text-zinc-400 underline" disabled={Boolean(busy)} onClick={()=>void loadList()}>Refresh saved tasks</button></div>
   <div className="studio-task-list-results min-h-0 flex-1 overflow-y-auto">
    {listState==="ready"&&rows.length===0&&<p className="text-xs leading-5 text-zinc-500">No saved task drafts yet. Save a draft when you are ready.</p>}
    {listState==="ready"&&rows.length>0&&visibleRows.length===0&&<p className="text-xs text-zinc-500">No loaded tasks match.</p>}
    {listState==="error"&&<p className="text-xs leading-5 text-zinc-500">Saved tasks could not be loaded. Refresh to retry; the editor is retained.</p>}
    <ul className="studio-task-rows">{visibleRows.map(task=><li key={task.id}><button data-help-id="bot.workspace.task-row" type="button" aria-label={`Open saved task ${task.title}`} aria-current={selected?.id===task.id?"true":undefined} className={`w-full rounded-lg p-3 text-left text-sm text-zinc-200 disabled:opacity-40 ${selected?.id===task.id?'bg-white/5':'hover:bg-white/5'}`} disabled={Boolean(busy)||Boolean(pending)||aiLocked} onClick={event=>requestOpen(task.id,event.currentTarget)}><FileText aria-hidden="true" size={17}/><span className="min-w-0"><span className="block wrap-break-word">{task.title}</span><span className="mt-1 block text-[11px] text-zinc-400">Draft · version {task.version}</span>{task.id in lastRuns&&<span data-help-id="bot.workspace.task-last-run" className="mt-0.5 block text-[11px] text-zinc-400">{lastRunLabel(lastRuns[task.id])}</span>}</span></button></li>)}</ul>
    {nextCursor&&<button data-help-id="bot.workspace.tasks-more" type="button" className="btn-secondary mt-3" disabled={Boolean(busy)} onClick={()=>void loadList(nextCursor)}>More saved tasks</button>}
   </div>
  </section>
  <div ref={editor} className="studio-task-editor flex min-h-0 min-w-0 flex-1 flex-col">
   <header className="bot-task-toolbar flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
    <div className="flex min-w-0 items-center gap-3"><button data-help-id="bot.workspace.tasks-toggle" type="button" ref={tasksTrigger} className="btn-secondary" aria-controls={`bot-task-list-${ownerKey}`} aria-expanded={tasksOpen} onClick={()=>{setTasksOpen(!tasksOpen);setInspectorOpen(false)}}>Tasks</button><h2 className="studio-task-title">{selected?.title??"New task"}</h2>{selected&&<span className="studio-task-badge">v{selected.version}</span>}<span className="studio-task-badge">Draft</span></div>
    <div className="flex flex-wrap gap-2"><button data-help-id="bot.workspace.actions-toggle" type="button" className="btn-secondary" aria-expanded={actionsOpen} onClick={()=>setActionsOpen(!actionsOpen)}>App actions</button>{!headerActionsTarget&&newTaskButton}<button data-help-id="bot.workspace.details-toggle" type="button" ref={detailsTrigger} className="btn-secondary" aria-controls={`bot-task-inspector-${ownerKey}`} aria-expanded={inspectorOpen} onClick={event=>{if(inspectorOpen){closeInspector();return}inspectorOpener.current=event.currentTarget;setInspectorOpen(true);setTasksOpen(false)}}>Task details</button></div>
   </header>
   <div className="studio-task-ai-setup flex flex-wrap items-center gap-3"><span className="text-xs text-zinc-500">{ai.loading?"Checking AI setup…":ai.enabled?"AI response only":"Drafts available · AI sending unavailable"}</span><button data-help-id="bot.workspace.ai-setup-refresh" type="button" className="text-xs text-zinc-400 underline" disabled={ai.loading||preparingSend||ai.sending} onClick={()=>void ai.refresh()}>Refresh AI setup</button>{ai.enabled&&<AgentModelSelector label="Bot" options={ai.models} value={ai.modelKey} onChange={ai.chooseModel} disabled={locked||ai.loading} loading={ai.loading}/>}</div>
   <nav className="studio-task-editor-navigation" aria-label="Saved task sections" inert={inspectorOpen}>
    <button type="button" aria-current="location" disabled={locked} onClick={focusInstruction}>Editor</button>
    <button type="button" disabled={locked} aria-controls={`bot-task-inspector-${ownerKey}`}
     onClick={event=>openDraftContext(event.currentTarget)}>Context</button>
    {selected&&<button type="button" aria-label="Open saved task history" disabled={historyLocked}
     aria-controls={`bot-task-inspector-${ownerKey}`} onClick={event=>openVersionHistory(event.currentTarget)}>History</button>}
   </nav>
   <footer className="shrink-0 bot-task-footer px-5 py-3 lg:px-8"><div className="mx-auto max-w-3xl">{selectedEvidence&&<section aria-label="Selected AI evidence" className="mb-3 rounded-lg border border-white/10 p-3 text-xs text-zinc-400"><div className="flex items-start justify-between gap-3"><span>{selectedEvidence.repositoryFullName} #{selectedEvidence.pullRequestNumber} · recorded {new Date(selectedEvidence.observedAt).toLocaleString()}</span><button data-help-id="bot.workspace.evidence-clear" type="button" className="underline" disabled={locked} onClick={()=>setSelectedEvidence(null)}>Clear selected evidence</button></div><p className="mt-2">Recorded snapshot; source may have changed. Send shares this evidence with your approved AI provider. No tools or changes.</p></section>}<BotTaskComposer key={`${ownerKey}:${editorGeneration}`} ownerKey={ownerKey} draft={draft} onDraftChange={onDraftChange} onSave={value=>void save(value)} onSend={value=>void send(value)} sendDisabled={!ai.canSend||Boolean(selected&&(ai.blockedTaskIds?.includes(selected.id)||ai.blockedTaskId===selected.id))||Boolean(busy)||conflict||preparingSend} statusText={ai.sending?"Sending…":preparingSend?"Saving exact instruction…":ai.enabled?"Instruction ready":"Draft · AI sending unavailable"} editingDisabled={locked} saveDisabled={Boolean(busy)||conflict} onCandidateChange={setCandidate} detailsTarget={detailsTarget}/></div></footer>
   <section aria-label="Bot task activity" className="studio-task-activity">
    <div className="mx-auto w-full max-w-3xl space-y-5">
     {actionsOpen&&<BotAppActionLauncher saved={Boolean(selected)} dirty={dirty} disabled={locked} onOpen={action=>{if(action==='slack'||action==='teams'||action==='linear'){setConnectedProvider(action);return}if(action==='jira'){setJiraOpen(jiraScope);return}inspectorOpener.current=null;setInspectorTab(action==='report'?'Library':'Details');setInspectorOpen(true);setTasksOpen(false)}}/>}
     {actionsOpen&&connectedProvider&&selected&&!dirty&&!locked&&<BotConnectedActionsPanel key={`${selected.id}:${selected.version}:${connectedProvider}`} provider={connectedProvider} sourceTask={{taskId:selected.id,expectedVersion:selected.version}} canManage={canManageActions} onClose={()=>setConnectedProvider(null)}/>}
     {active&&actionsOpen&&jiraOpen===jiraScope&&<section aria-label="Bot Jira form exploration" className="space-y-3"><div className="flex items-center justify-between gap-3"><p className="text-xs leading-5 text-zinc-400">Live read-only form exploration. Choices are not saved as task execution evidence.</p><button data-help-id="bot.workspace.jira-form-close" type="button" className="text-xs text-zinc-400 underline" onClick={()=>setJiraOpen(null)}>Close Jira form</button></div><JiraTicketDiscovery key={`${selected?.id??'unsaved'}:${selected?.version??0}`} owner={{config:initialConfig,revision:initialRevision}} readCurrentOwner={()=>({config:desktopClient.config,revision:desktopClient.getContextRevision()})}/></section>}
     {selected?<details className="rounded-lg border border-white/10 p-3"><summary data-help-id="bot.workspace.saved-instruction" className="cursor-pointer text-xs text-zinc-400">Saved instruction · version {selected.version}</summary><p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-zinc-200">{selected.instruction}</p><p className="mt-4 text-[11px] text-zinc-500">Saved instruction. Responses are recorded separately below.</p></details>:<div className="bot-task-empty"><img src="/brand/v19-mark.svg" alt="" className="mb-6 h-10 w-10 object-contain" /><h2 className="text-2xl font-medium tracking-tight text-white lg:text-3xl">What can I take off your plate?</h2><p className="mt-4 max-w-lg text-sm leading-7 text-zinc-400">Describe an outcome. Get an AI response, save the task, or open App actions for reviewed changes.</p></div>}
     {!ai.error&&(ai.loading||!ai.enabled)&&<p className="text-xs leading-5 text-zinc-500">{ai.loading?"Checking AI task availability. Your draft stays editable.":"AI task execution is not enabled on this service. Save a draft to keep working without sending."}</p>}
     {selected&&(ai.blockedTaskIds?.includes(selected.id)||ai.blockedTaskId===selected.id)&&<p role="status" className="text-sm leading-6 text-zinc-400">This task has an unconfirmed earlier call. Review Recent AI task activity, or start a new draft for distinct work. The original will not be sent again.</p>}
     <BotAiTaskActivity ai={ai} taskId={selected?.id} onOpenTask={requestOpen} onNewTask={opener=>requestOpen("new",opener)}/>
     {selected&&<section aria-label="Saved AI task activity" className="space-y-2"><button data-help-id="bot.workspace.activity-recent" type="button" className="text-xs text-zinc-400 underline" disabled={ai.checking||ai.sending||ai.uncertain||preparingSend} onClick={()=>void ai.loadRecent(selected.id)}>Recent AI task activity</button>{ai.recent?.filter(item=>item.taskId===selected.id).map(item=><button data-help-id="bot.workspace.activity-row" key={item.id} type="button" className="block text-left text-xs text-zinc-400 underline" disabled={ai.checking||ai.sending||ai.uncertain} onClick={()=>void ai.openRecordedRun(item)}>Version {item.taskVersion} · {item.status.replaceAll("_"," ")} · {new Date(item.createdAt).toLocaleString()}</button>)}</section>}
     {confirmOpen&&<aside role="alert" ref={replacePrompt} tabIndex={-1} className="studio-task-replace-prompt rounded-lg border border-white/10 p-4 text-sm text-zinc-300"><p>{confirmOpen==="new"?"Starting a new draft clears unsaved text in this editor.":"Opening the saved version replaces unsaved text in this editor."} Your saved history is preserved.</p><div className="mt-3 flex flex-wrap gap-3"><button data-help-id="bot.workspace.replace-keep-editing" type="button" className="btn-secondary" onClick={cancelReplace}>Keep editing</button><button data-help-id="bot.workspace.replace-confirm" type="button" className="btn-secondary" onClick={()=>{const id=confirmOpen;replaceOpener.current=null;setConfirmOpen(undefined);void openSaved(id)}}>{confirmOpen==="new"?"Start new draft":"Open saved draft"}</button></div></aside>}
     {busy&&busy!=="history"&&<p role="status" className="text-sm text-zinc-400">{busy==="save"?"Saving task draft…":busy==="open"?"Opening saved draft…":"Loading saved tasks…"}</p>}
     {note&&<p role="status" className="text-sm text-zinc-300">{note}</p>}
     {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
     {pending&&<div className="space-y-2 text-sm text-zinc-400"><p>The editor is retained while this save is unconfirmed. Retrying uses the same content and save identifier.</p><button data-help-id="bot.workspace.save-retry" type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={()=>void save(undefined,pending)}>Retry same save</button></div>}
     {conflict&&selected&&<div className="flex flex-wrap gap-3"><button data-help-id="bot.workspace.conflict-review-saved" type="button" className="btn-secondary" disabled={historyLocked} onClick={event=>openVersionHistory(event.currentTarget)}>Review saved version</button><button type="button" className="btn-secondary" disabled={historyLocked} onClick={event=>requestOpen(selected.id,event.currentTarget)}>Open latest saved draft</button><button data-help-id="bot.workspace.conflict-keep-new" type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={()=>{setSelected(null);setConflict(false);setHistory(undefined);setHistoryError(undefined);requestKey.current=crypto.randomUUID();setNote("Your edits are retained as a new unsaved draft. Saving will create a separate task draft.")}}>Keep edits as new draft</button></div>}
    </div>
   </section>
  </div>
  <section className="studio-task-summary" aria-label="Task draft summary" inert={inspectorOpen}>
   <h2>Task details</h2>
   <dl>
    <div><dt>Status</dt><dd>{selected?"Saved draft":"Local draft"}</dd></div>
    <div><dt>Visibility</dt><dd>{selected?"Creator only":"Current editor"}</dd></div>
    {selected&&<>
     <div><dt>Version</dt><dd>{selected.version}</dd></div>
     <div><dt>Created</dt><dd><time dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleDateString()}</time></dd></div>
     <div><dt>Updated</dt><dd><time dateTime={selected.updatedAt}>{new Date(selected.updatedAt).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}</time></dd></div>
    </>}
   </dl>
   <section aria-labelledby={`bot-task-changes-${ownerKey}`}>
    <h3 id={`bot-task-changes-${ownerKey}`}>Changes</h3>
    <p>{pending?"Save outcome unconfirmed":busy==="save"?"Saving task draft…":dirty?"Unsaved changes":selected?"All changes saved":"Not saved yet"}</p>
   </section>
   {selected&&<section aria-labelledby={`bot-task-version-history-${ownerKey}`}>
    <h3 id={`bot-task-version-history-${ownerKey}`}>Version history</h3>
    <button data-help-id="bot.workspace.summary-history" type="button" className="studio-task-history" aria-label="View saved versions" aria-controls={`bot-task-inspector-${ownerKey}`} disabled={historyLocked} onClick={event=>openVersionHistory(event.currentTarget)}>
     <History aria-hidden="true" size={15}/>
     <span><strong>v{selected.version}</strong><span>View saved versions</span></span>
     <ChevronDown aria-hidden="true" size={13}/>
    </button>
    {history?.taskId===selected.id&&history.events.slice(0,2).map(event=><button key={event.version} type="button"
     className="studio-task-history studio-task-history-record" aria-label={`Inspect saved version ${event.version}`}
     aria-controls={`bot-task-inspector-${ownerKey}`} disabled={historyLocked}
     onClick={click=>openVersionHistory(click.currentTarget,event.version)}>
     <FileText aria-hidden="true" size={15}/>
     <span>
      <strong>v{event.version}</strong>
      <span>{event.eventType==="draft.created"?"Draft created":"Draft updated"}</span>
      <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleDateString()}</time>
     </span>
     <ChevronDown aria-hidden="true" size={13}/>
    </button>)}
   </section>}
  </section>
  <section ref={inspector} id={`bot-task-inspector-${ownerKey}`} aria-label="Saved task details" className={`${inspectorOpen?'block':'hidden'} absolute inset-y-0 right-0 z-20 w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-zinc-950 p-5 shadow-2xl`}>
   <div role="tablist" aria-label="Bot task inspector" className="flex gap-1 border-b border-white/10 pb-4">{(["Details","Library","Computer"] as const).map(tab=><button data-help-id="bot.workspace.inspector-tab" key={tab} type="button" role="tab" id={`bot-tab-${ownerKey}-${tab}`} aria-selected={inspectorTab===tab} tabIndex={inspectorTab===tab?0:-1} onKeyDown={event=>{if(event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return;const tabs=["Details","Library","Computer"] as const;const index=tabs.indexOf(tab);const next=event.key==="ArrowRight"?tabs[(index+1)%3]:event.key==="ArrowLeft"?tabs[(index+2)%3]:event.key==="Home"?tabs[0]:event.key==="End"?tabs[2]:undefined;if(next){event.preventDefault();setInspectorTab(next);const sibling=event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[id="bot-tab-${ownerKey}-${next}"]`);sibling?.focus()}}} aria-controls={`bot-panel-${ownerKey}-${tab}`} className={`rounded-lg px-3 py-2 text-xs ${inspectorTab===tab?'bg-white/5 text-zinc-200':'text-zinc-500'}`} onClick={()=>setInspectorTab(tab)}>{tab==='Library'?'Workspace report':tab}</button>)}</div>
   <button data-help-id="bot.workspace.details-close" type="button" className="mt-3 text-xs text-zinc-400 underline" onClick={closeInspector}>Close task details</button>
   <div role="tabpanel" id={`bot-panel-${ownerKey}-Details`} aria-labelledby={`bot-tab-${ownerKey}-Details`} hidden={inspectorTab!=="Details"} className="space-y-5 pt-5">
    <p className="text-sm text-zinc-300">{selected&&!dirty?`Saved draft · version ${selected.version}`:selected?"Unsaved changes":"Unsent local draft"}</p>
    <div ref={setDetailsTarget}/>
    <p className="text-[11px] leading-5 text-zinc-500">Saved drafts and history belong to your current signed-in workspace and creator. No connected-app or execution access is granted.</p>
    {selected&&<section aria-label="Saved draft history" className="studio-task-history-panel">
     <h2 ref={historyHeading} tabIndex={-1}>Version history</h2>
     <p>{conflict ? "Your edits stay in the editor while you review saved versions." : "Recorded draft versions."}</p>
     <button data-help-id="bot.workspace.history-open" type="button" className="btn-secondary" aria-disabled={historyLocked}
      onClick={()=>{if(!historyLocked)void loadHistory()}}>{history?"Refresh history":historyError?"Retry history":"History"}</button>
     {busy==="history"&&<p role="status">Loading saved history…</p>}
     {historyError&&<p role="alert" className="text-rose-300">{historyError}</p>}
     {history?.events.length===0&&<p>No saved versions were returned.</p>}
     {history?.events.map(event=><details key={event.version} className="studio-task-version" data-saved-task-version={event.version}>
      <summary data-help-id="bot.workspace.history-version">
       <FileText size={15} aria-hidden="true"/>
       <span>
        <span className="studio-task-version-heading">
         <strong>Version {event.version}</strong>
         {event.version===selected.version&&<span className="studio-task-badge">Editor base</span>}
         {event.version>selected.version&&<span className="studio-task-badge">Newer saved version</span>}
        </span>
        <span className="studio-task-version-event">{event.eventType==="draft.created"?"Draft created":"Draft updated"}</span>
        <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
       </span>
       <ChevronDown size={14} aria-hidden="true" className="studio-task-version-chevron"/>
      </summary>
      <div className="studio-task-version-content">
       <p className="font-medium">{event.content.title}</p>
       <p className="whitespace-pre-wrap">{event.content.instruction}</p>
       {event.content.context&&<p className="whitespace-pre-wrap">{event.content.context}</p>}
       <DraftVersionComparison saved={event.content} version={event.version} draft={draft} candidate={candidate}/>

      </div>
     </details>)}
     {history&&history.nextBeforeVersion!==null&&<button ref={olderHistory} data-help-id="bot.workspace.history-older" type="button"
      className="btn-secondary" aria-disabled={historyLocked} onClick={()=>{if(!historyLocked&&history.nextBeforeVersion!==null)void loadHistory(history.nextBeforeVersion)}}>Older history</button>}
    </section>}
    <BotPullRequestEvidencePanel key={`pr:${selected?.id??"new"}:${selected?.version??0}`} ownerKey={ownerKey} task={selected} dirty={dirty} active={active&&inspectorOpen&&inspectorTab==="Details"} selectionDisabled={locked} onSelectEvidence={value=>{if(owns()&&!dirty&&!locked&&selected&&value.taskId===selected.id&&value.taskVersion===selected.version)setSelectedEvidence(value)}}/>
   </div>
   <div role="tabpanel" id={`bot-panel-${ownerKey}-Library`} aria-labelledby={`bot-tab-${ownerKey}-Library`} hidden={inspectorTab!=="Library"} className="pt-6"><BotReadinessReportPanel key={`${selected?.id??"new"}:${selected?.version??0}`} task={selected} dirty={dirty} active={active&&inspectorOpen&&inspectorTab==="Library"}/></div>
   <div role="tabpanel" id={`bot-panel-${ownerKey}-Computer`} aria-labelledby={`bot-tab-${ownerKey}-Computer`} hidden={inspectorTab!=="Computer"} className="pt-6"><BotComputerObservationPanel active={active&&inspectorOpen&&inspectorTab==="Computer"} owner={observationIdentity?{...observationIdentity,contextRevision:initialRevision,taskId:selected?.id??null,taskVersion:selected?.version??null}:undefined} onInputSelection={setInputSelection}/><BotComputerInputPanel recoveryIdentity={recoveryIdentity} active={active&&!dirty&&inspectorOpen&&inspectorTab==="Computer"} owner={observationIdentity?{...observationIdentity,contextRevision:initialRevision,taskId:selected?.id??null,taskVersion:selected?.version??null}:undefined} selection={inputSelection}/></div>
  </section>
 </div>;
}


function DraftVersionComparison({saved,version,draft,candidate}:{
 saved:SavedBotTaskContentDto;
 version:number;
 draft:AxiomBotDraft;
 candidate:boolean;
}){
 const fields=[
  {label:"Title",saved:saved.title,editor:draft.title},
  {label:"Instruction",saved:saved.instruction,editor:draft.task},
  {label:"Context",saved:saved.context,editor:draft.context},
 ];
 const differences=fields.filter(field=>field.saved!==field.editor);
 return <details className="studio-task-version-comparison">
  <summary>Compare with editor</summary>
  {candidate
   ? <p>Resolve the editor’s validation issue to compare all fields.</p>
   : differences.length===0
    ? <p>The editor matches saved version {version}.</p>
    : differences.map(field=><section key={field.label} aria-label={`${field.label} comparison`}>
      <h3>{field.label}</h3>
      <dl>
       <div><dt>Saved version {version}</dt><dd>{field.saved||"Empty"}</dd></div>
       <div><dt>Current editor</dt><dd>{field.editor||"Empty"}</dd></div>
      </dl>
     </section>)}
 </details>;
}

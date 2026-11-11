import type {ReturnTypeOfBotAiTask} from '../lib/useBotAiTask';
const labels:Record<string,string>={queued:'Waiting to prepare',preparing:'Preparing saved instruction',dispatching:'Waiting for AI response',needs_input:'More information needed',completed:'Response saved',failed:'Stopped before dispatch',cancel_requested:'Cancellation requested',canceled:'Canceled before dispatch',outcome_unknown:'Outcome unconfirmed'};
export function BotAiTaskActivity({ai,taskId,onOpenTask,onNewTask}:{ai:ReturnTypeOfBotAiTask;taskId?:string;onOpenTask:(id:string)=>void;onNewTask:()=>void}){
 const associated=Boolean(ai.run&&ai.run.taskId===taskId);
 return <section aria-label="AI task response" className="space-y-3">
  {ai.sending&&<p role="status" className="text-sm text-zinc-400">Sending the saved instruction. Progress and results are kept with this task.</p>}
  {ai.run&&associated&&<article className="rounded-2xl border border-white/10 p-5">
   <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-medium text-zinc-200">{labels[ai.run.status]}</h2><span className="text-xs text-zinc-500">Saved version {ai.run.taskVersion}</span></div>
   {ai.result?<><p className="mt-4 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-zinc-200">{ai.result.message}</p><p className="mt-4 text-[11px] text-zinc-500">{new Date(ai.result.createdAt).toLocaleString()} · {ai.run.modelId} · No tools used</p></>:<p className="mt-3 text-xs leading-6 text-zinc-400">{ai.run.status==='outcome_unknown'?'The call may have been dispatched. Check this same request before sending again; no automatic retry will run.':ai.run.status==='cancel_requested'?'The call may already be dispatched. Check the result; cancellation does not guarantee a refund.':ai.run.status==='failed'?'This attempt stopped before model dispatch. Your saved instruction is retained.':'Check this task to retrieve its current saved status and response.'}</p>}
  </article>}
  {ai.run&&!associated&&<p className="text-sm text-zinc-400">A response from another saved task is available. <button type="button" className="underline" onClick={()=>onOpenTask(ai.run!.taskId)}>Open associated task</button></p>}
  {ai.error&&<p role="alert" className="text-sm leading-6 text-zinc-400">{ai.error}</p>}
  <div className="flex flex-wrap gap-3">
   {ai.run?.status==='outcome_unknown'&&ai.uncertain&&<button type="button" className="btn-secondary" disabled={ai.checking||ai.sending} onClick={()=>{if(ai.acknowledgeUnknown())onNewTask()}}>Keep record and start another task</button>}
   {ai.canCheck&&<button type="button" className="btn-secondary" disabled={ai.checking} onClick={()=>void ai.check()}>{ai.checking?'Checking task…':'Check task'}</button>}
   {ai.canCancel&&<button type="button" className="btn-secondary" disabled={ai.checking} onClick={()=>void ai.cancel()}>Cancel task</button>}
  </div>
 </section>;
}

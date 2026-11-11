import type {CustomerJourney} from '../../lib/customerJourney/journey';
const states={attention:'Needs attention',verified:'Recorded',unverified:'Unverified'} as const;
/** Read-only explanation beside the product's existing exact-action controls. */
export function CustomerJourneyPanel({journey,label='Your next step'}:{journey:CustomerJourney;label?:string}){
 return <section aria-label={label} className="my-3 rounded-xl border border-white/10 bg-white/2.5 p-4">
  <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p><h4 className="mt-1 text-sm font-medium text-zinc-100">{journey.next.title}</h4></div><p className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">Who: {journey.next.owner}</p></div>
  <p className="mt-2 text-xs leading-5 text-zinc-400">{journey.next.detail}</p>
  {journey.steps.find(s=>s.id==='recovery')?.state==='attention'&&<p role="status" className="mt-3 rounded-lg border border-white/15 p-3 text-xs leading-5 text-zinc-200">{journey.recovery}</p>}
  <details className="mt-3 text-xs text-zinc-400"><summary className="cursor-pointer py-1">Readiness, review, outcome and recovery</summary>
  <ol aria-label="Workflow stages" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{journey.steps.map((s,index)=><li key={s.id} className="min-w-0 border-t border-white/10 pt-2"><div className="flex flex-wrap items-center justify-between gap-1"><h5 className="text-xs font-medium text-zinc-200">{index+1}. {s.title}</h5><span className={s.state==='verified'?'text-[10px] text-emerald-300':'text-[10px] text-zinc-400'}>{states[s.state]}</span></div><p className="mt-1 text-[11px] leading-5 text-zinc-400">{s.detail}</p></li>)}</ol></details>
  <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-5 text-zinc-400">Use the exact controls below to continue. This guidance does not approve, execute or retry an action.</p>
 </section>;
}

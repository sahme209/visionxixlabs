const STAGES = [
  {
    boundary: 'Desktop editor',
    title: 'Unsent local draft',
    detail: 'Typing edits the draft in the app. Saving to the workspace and requesting an AI response are separate, explicit choices.',
  },
  {
    boundary: 'Workspace service',
    title: 'Saved workspace draft',
    detail: 'Save uploads the draft. Send first saves new or changed text, then verifies the exact saved version before requesting a response.',
  },
  {
    boundary: 'Configured gateway → selected model',
    title: 'Explicit AI request',
    detail: 'This Bot path prepares title, instruction and context for the selected model, plus recorded GitHub evidence only when you explicitly select it. Current model, access and budget checks still apply.',
  },
  {
    boundary: 'Saved task activity',
    title: 'Recorded outcome',
    detail: 'Read the saved answer or request for more information, or inspect a pending/stopped state. If the outcome is unconfirmed, check that same request; do not resend.',
  },
] as const;

/** Source-scoped explanation only: no connection checks, AI calls or actions. */
export function BotAiDataFlow() {
  return (
    <figure aria-label="Axiom Bot prompt and response flow" className="mt-7 overflow-hidden rounded-2xl border border-white/12 bg-white/2">
      <figcaption className="border-b border-white/10 px-5 py-5 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-orange-300/90">One specific path · Axiom Bot AI response</p>
        <h3 className="mt-2 text-xl font-medium tracking-tight text-zinc-100">Know what crosses each boundary.</h3>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-zinc-400">Source-inspected illustration of the local preview, not a recording or connection inspection. Availability depends on the installed version and enabled service.</p>
      </figcaption>
      <ol aria-label="Bot response stages" className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
        {STAGES.map((stage, index) => (
          <li key={stage.title} className={`min-w-0 rounded-xl border p-4 ${index === 2 ? 'border-orange-300/20 bg-orange-300/2.5' : 'border-white/8 bg-black/10'}`}>
            <div className="flex items-start justify-between gap-3">
              <span aria-hidden="true" className="font-mono text-[11px] tabular-nums text-zinc-500">{String(index + 1).padStart(2, '0')}</span>
              <p className="max-w-[180px] text-right text-[10px] leading-4 text-zinc-400">{stage.boundary}</p>
            </div>
            <h4 className="mt-5 text-sm font-medium text-zinc-100">{stage.title}</h4>
            <p className="mt-3 text-xs leading-6 text-zinc-400">{stage.detail}</p>
          </li>
        ))}
      </ol>
      <div role="group" aria-label="Separate reviewed app-action workflow" className="mx-4 mb-5 border-t border-dashed border-white/15 pt-5 sm:mx-5">
        <p className="text-xs font-medium text-zinc-200">Separate lane · reviewed app actions</p>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-zinc-400">Task-linked Slack, Teams and Linear changes use a separate exact plan, a different authorized human&apos;s decision and the requester&apos;s deliberate execution. Opening App actions is not execution. This AI response does not call app tools.</p>
      </div>
      <details className="border-t border-white/10 px-5 py-4 text-xs text-zinc-400 sm:px-6">
        <summary className="cursor-pointer py-1 text-zinc-300 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300">What the prompt includes — and what this figure leaves out</summary>
        <div className="mt-3 max-w-4xl space-y-3 leading-6">
          <p>The prompt supplies fixed instructions and a response-format schema alongside JSON task data. Selected recorded evidence adds its observed time, release ID/version, repository, pull request number and recorded pull request fields. It is evidence-only data and may no longer reflect the provider.</p>
          <p>This is not a complete egress inventory: request, metering and receipt metadata have their own transport and storage paths. The figure does not establish provider retention, model-training terms, automatic secret removal or an offline deployment. Review the actual context, provider and applicable policy before Send; never include credentials.</p>
        </div>
      </details>
    </figure>
  );
}

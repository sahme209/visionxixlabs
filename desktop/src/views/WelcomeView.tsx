interface WelcomeViewProps {
  onBuild: () => void;
  onBot: () => void;
  onAutomate: () => void;
  onDeploy: () => void;
}

/** Navigation only: never turn a launch choice into an AI or provider action. */
export function WelcomeView({ onBuild, onBot, onAutomate, onDeploy }: WelcomeViewProps) {
  return <section aria-label="Axiom welcome" className="axiom-home flex min-h-0 flex-1 overflow-y-auto bg-axiom-bg px-6 py-10">
    <div className="axiom-home-content m-auto w-full max-w-3xl">
      <img src="/axiom-logo.png" alt="" className="mb-8 h-12 w-12 object-contain"/>
      <p className="mb-3 text-xs text-zinc-500">Your workspace</p>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100">What are we working on?</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400">A place to think, build and move work forward—with control over every change.</p>
      <button type="button" onClick={onBuild} className="home-primary-action">
        <span><span className="block text-base font-semibold text-zinc-100">Build with AI</span><span className="mt-2 block text-sm leading-6 text-zinc-400">Open Agent to research, develop and work with your code.</span></span>
        <span aria-hidden className="home-action-arrow">↗</span>
      </button>
      <div className="home-other-heading">Or pick up another kind of work</div>
      <div className="home-destinations">
        <button type="button" onClick={onBot} className="home-destination"><span className="home-destination-symbol" aria-hidden>◎</span><span><span className="block text-sm font-medium text-zinc-200">Delegate a task</span><span className="mt-1 block text-xs leading-5 text-zinc-500">Saved tasks and AI responses in Axiom Bot. App changes require exact review.</span></span><span className="home-action-arrow" aria-hidden>↗</span></button>
        <button type="button" onClick={onDeploy} className="home-destination"><span className="home-destination-symbol" aria-hidden>↗</span><span><span className="block text-sm font-medium text-zinc-200">Deploy and Manage</span><span className="mt-1 block text-xs leading-5 text-zinc-500">Scope a release, review actions and follow delivery evidence.</span></span><span className="home-action-arrow" aria-hidden>↗</span></button>
        <button type="button" onClick={onAutomate} className="home-destination"><span className="home-destination-symbol" aria-hidden>⌘</span><span><span className="block text-sm font-medium text-zinc-200">Automate Operations</span><span className="mt-1 block text-xs leading-5 text-zinc-500">Monitor batches and prepare operations. Requires an Airflow connection.</span></span><span className="home-action-arrow" aria-hidden>↗</span></button>
      </div>
      <p className="mt-7 text-xs leading-5 text-zinc-500">Your saved work stays in its workspace. Opening a section does not execute a change.</p>
    </div>
  </section>;
}

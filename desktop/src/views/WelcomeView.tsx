interface WelcomeViewProps {
  onBuild: () => void;
  onBot: () => void;
  onAutomate: () => void;
  onDeploy: () => void;
}

/** Entry points only: the existing workspaces keep their policy and prerequisites. */
export function WelcomeView({ onBuild, onBot, onAutomate, onDeploy }: WelcomeViewProps) {
  return <section aria-label="Axiom welcome" className="flex min-h-0 flex-1 overflow-y-auto bg-axiom-bg px-6 py-10">
    <div className="m-auto w-full max-w-4xl">
      <p className="mb-3 text-xs uppercase tracking-[0.16em] text-zinc-500">Your Axiom workspace</p>
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-zinc-100">What would you like to accomplish today?</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">One workspace for building software, coordinating operations and delivering releases.</p>
      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <button type="button" onClick={onBuild} className="rounded-xl border border-white/10 bg-white/[0.025] p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-300 hover:bg-white/[0.05]">
          <span className="block text-base font-semibold text-zinc-100">Build with AI</span>
          <span className="mt-2 block text-sm leading-6 text-zinc-400">Research and develop with Agent, your repository and local files.</span>
        </button>
        <button type="button" onClick={onBot} className="rounded-xl border border-white/10 bg-white/[0.025] p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-300 hover:bg-white/[0.05]">
          <span className="block text-base font-semibold text-zinc-100">Delegate a task</span>
          <span className="mt-2 block text-sm leading-6 text-zinc-400">Use Axiom Bot for saved instructions and AI responses. Connected-app changes require a separate exact review.</span>
        </button>
        <button type="button" onClick={onAutomate} className="rounded-xl border border-white/10 bg-white/[0.025] p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-300 hover:bg-white/[0.05]">
          <span className="block text-base font-semibold text-zinc-100">Automate Operations</span>
          <span className="mt-2 block text-sm leading-6 text-zinc-400">Monitor batches and prepare governed operations. Requires an Airflow connection.</span>
        </button>
        <button type="button" onClick={onDeploy} className="rounded-xl border border-white/25 bg-white/[0.06] p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-300 hover:bg-white/[0.09]">
          <span className="block text-base font-semibold text-zinc-100">Deploy and Manage</span>
          <span className="mt-2 block text-sm leading-6 text-zinc-300">Start from a ticket, prepare a release and review delivery evidence.</span>
        </button>
      </div>
      <p className="mt-5 text-xs leading-5 text-zinc-500">Continue your saved work from the sidebar.</p>
    </div>
  </section>;
}

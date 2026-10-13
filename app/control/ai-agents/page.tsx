import { AIGovernancePanel } from "./AIGovernancePanel";

export default function AIAgentsPage() {
  return (
    <div className="max-w-5xl">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff783d]">Governance control plane</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">AI &amp; Agents</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Approve models, define the workspace Agent identity, bound its tools and autonomy, and cap spend. Credentials and enforcement remain server-side.</p>
      <AIGovernancePanel />
    </div>
  );
}

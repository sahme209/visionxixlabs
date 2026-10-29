import { AIGovernancePanel } from "./AIGovernancePanel";

export default function AIAgentsPage() {
  return (
    <div className="w-full min-w-0">

      <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">AI &amp; Agents</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Manage your workspace Agent, approved models, permissions, and spending.</p>
      <AIGovernancePanel />
    </div>
  );
}

import type { View } from "../App";
import type { VerifiedDesktopIdentity } from "../lib/desktopClient";

const VIEW_TITLES: Partial<Record<View, { title: string; subtitle: string }>> = {
  "axiom-bot": { title: "Axiom Bot", subtitle: "Saved tasks, AI responses and reviewed app actions" },
  agent: { title: "Agent", subtitle: "Work with code, local files and research" },
  "deployment-requests": { title: "Releases", subtitle: "Scope, evidence and approvals for delivery" },
  "airflow-automation": { title: "Batches", subtitle: "Monitor Airflow workflows and review batch operations" },
  "repository-workspace": { title: "Repositories", subtitle: "Browse local files, review changes and manage repository sync" },
  "plugins-skills": { title: "Apps & skills", subtitle: "Connected apps and reusable skills" },
  docs: { title: "Documentation", subtitle: "Product guidance and operating references" },
  settings: { title: "Settings", subtitle: "Authentication and workstation configuration" },
};

export function TopBar({ activeView, identity, onOpenCommands, onToggleSplit, splitActive = false, welcome = false }: { activeView: View; identity: VerifiedDesktopIdentity; onOpenCommands?: () => void; onToggleSplit?: () => void; splitActive?: boolean; welcome?: boolean }) {
  const meta = welcome ? {title: "Axiom", subtitle: "Build, operate and deliver"} : splitActive ? {title: "Engineering workspace", subtitle: "Code, research and plan with your Agent"} : VIEW_TITLES[activeView] ?? { title: "Deployment workspace", subtitle: "Unavailable surfaces are not part of customer navigation" };
  const workspace = identity.organizationId;

  return (
    <header className="workspace-topbar h-[68px] flex items-center justify-between gap-3 px-5 border-b border-white/[0.07] bg-[#111214] drag">
      <div className="flex min-w-0 flex-col">
        <h2 className="text-[14px] font-semibold tracking-tight text-white leading-tight">{meta.title}</h2>
        <span className="workspace-topbar-description mt-0.5 truncate text-xs text-zinc-400">{meta.subtitle}</span>
      </div>
      {onToggleSplit && <button type="button" aria-pressed={splitActive} onClick={onToggleSplit} className="no-drag ml-auto mr-2 shrink-0 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:bg-white/5">{splitActive ? "Single pane" : "Editor & Agent"}</button>}
      {onOpenCommands && <button type="button" onClick={onOpenCommands} className="no-drag mr-3 shrink-0 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:bg-white/5" title="Command/Ctrl+Shift+P">Commands</button>}
      <div className="workspace-identity no-drag ml-1 flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-300" title={`Verified ${identity.kind.replace("_", " ")} with active approved workspace access`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="max-w-[180px] truncate">{workspace}</span>
        <span className="text-zinc-500">· access active</span>
      </div>
    </header>
  );
}

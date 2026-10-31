import {useEffect} from "react";
import {useDismissibleDetails} from "../lib/useDismissibleDetails";
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
  const accessActive = identity.access.allowed;
  const accessDetails=useDismissibleDetails(),accessMenu=accessDetails.ref;
  useEffect(()=>{if(accessMenu.current)accessMenu.current.open=false},[activeView,workspace,welcome,splitActive]);

  return (
    <header className="workspace-topbar h-[68px] flex items-center justify-between gap-3 px-5 border-b border-white/[0.07] bg-[#111214] drag">
      <div className="flex min-w-0 flex-col">
        <h2 className="text-[14px] font-semibold tracking-tight text-white leading-tight">{meta.title}</h2>
        <span className="workspace-topbar-description mt-0.5 truncate text-xs text-zinc-400">{meta.subtitle}</span>
      </div>
      <div className="workspace-header-actions no-drag flex shrink-0 items-center gap-2">
      {onToggleSplit && <button type="button" aria-pressed={splitActive} onClick={onToggleSplit} className="workspace-header-button" title="Switch between focused chat and the editor workspace">{splitActive ? "Single pane" : "Editor & Agent"}</button>}
      {onOpenCommands && <button type="button" onClick={()=>{if(accessMenu.current)accessMenu.current.open=false;onOpenCommands()}} className="workspace-header-button" title="Command/Ctrl+Shift+P"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>Commands</button>}
      <details ref={accessMenu} className="workspace-access" onKeyDown={accessDetails.onKeyDown} onBlur={accessDetails.onBlur}>
        <summary className="workspace-header-button" aria-label={`Workspace access: ${accessActive?'active':'needs attention'}`} title={`Workspace ${workspace}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${accessActive?'bg-emerald-400':'bg-amber-400'}`}/>{accessActive?'Access active':'Access needs attention'}<span aria-hidden="true" className="text-[10px]">⌄</span></summary>
        <div className="workspace-access-panel">
          <p className="text-xs font-medium text-zinc-200">Current workspace</p><p className="mt-2 break-all text-xs text-zinc-400">{workspace}</p>
          <p className="mt-4 text-xs text-zinc-400">{identity.kind==='desktop_session'?'Paired desktop session':'API key session'}</p>
          <p className="mt-1 text-xs text-zinc-400">{accessActive?'Service-verified workspace access':'Workspace access requires attention'}</p>
        </div>
      </details>
      </div>
    </header>
  );
}

import {useEffect} from "react";
import {Bell, ChevronRight, CircleHelp, Search, UserRound} from "lucide-react";
import {useDismissibleDetails} from "../lib/useDismissibleDetails";
import type { View } from "../App";
import type { VerifiedDesktopIdentity } from "../lib/desktopClient";

const VIEW_TITLES: Partial<Record<View, { title: string; subtitle: string }>> = {
  "axiom-bot": { title: "Saved Tasks", subtitle: "Saved tasks, AI responses and reviewed app actions" },
  agent: { title: "Agent", subtitle: "Work with code, local files and research" },
  "deployment-requests": { title: "Deployments", subtitle: "Scope, evidence and approvals for delivery" },
  tickets: { title: "Tickets", subtitle: "Recorded incidents and changes" },
  "airflow-automation": { title: "Batches", subtitle: "Monitor Airflow workflows and review batch operations" },
  "repository-workspace": { title: "Repositories", subtitle: "Browse local files, review changes and manage repository sync" },
  "plugins-skills": { title: "Apps & Skills", subtitle: "Connected apps and reusable skills" },
  docs: { title: "Documentation", subtitle: "Product guidance and operating references" },
  settings: { title: "Settings", subtitle: "Authentication and workstation configuration" },
};

export function TopBar({ activeView, identity, onOpenCommands, onToggleSplit, splitActive = false, welcome = false, onOpenHelp }: { activeView: View; identity: VerifiedDesktopIdentity; onOpenCommands?: () => void; onToggleSplit?: () => void; splitActive?: boolean; welcome?: boolean; onOpenHelp?: () => void }) {
  const meta = welcome ? {title: "Home", subtitle: "Build, operate and deliver"} : splitActive ? {title: "Engineering workspace", subtitle: "Code, research and plan with your Agent"} : VIEW_TITLES[activeView] ?? { title: "Deployment workspace", subtitle: "Unavailable surfaces are not part of customer navigation" };
  const workspace = identity.organizationId;
  const accessActive = identity.access.allowed;
  const accessLabel = accessActive ? "Access active" : "Access needs attention";
  const initials = identity.displayName?.trim().split(/\s+/u).slice(0, 2)
    .map(part => Array.from(part)[0]?.toLocaleUpperCase()).join("");
  const accessDetails=useDismissibleDetails(),accessMenu=accessDetails.ref;
  useEffect(()=>{if(accessMenu.current)accessMenu.current.open=false},[activeView,workspace,welcome,splitActive]);

  function closeAccess() {
    if (accessMenu.current) accessMenu.current.open = false;
  }

  return (
    <header className="workspace-topbar studio-topbar drag">
      <div className="studio-breadcrumb" role="group" aria-label="Current view" title={meta.subtitle}>
        <span className="studio-breadcrumb-root">Workspace</span>
        <ChevronRight aria-hidden="true" size={13} className="studio-breadcrumb-root" />
        <h2 className="truncate">{meta.title}</h2>
        <span className="workspace-topbar-description sr-only">{meta.subtitle}</span>
      </div>
      <div className="workspace-header-actions studio-topbar-actions no-drag">
        {onOpenCommands && (
          <button
            type="button"
            className="workspace-header-button studio-command-search"
            onClick={() => { closeAccess(); onOpenCommands(); }}
            title="Command/Ctrl+K"
            aria-label="Search or run a command"
            aria-keyshortcuts="Meta+K Control+K Meta+Shift+P Control+Shift+P"
          >
            <Search aria-hidden="true" size={14} />
            <span>Search or run a command</span>
            <kbd aria-hidden="true">⌘ K</kbd>
          </button>
        )}
        {onOpenHelp && (
          <button type="button" className="workspace-header-button studio-topbar-icon" aria-label="Documentation help" onClick={() => { closeAccess(); onOpenHelp(); }}>
            <CircleHelp aria-hidden="true" size={15} />
          </button>
        )}
        <button type="button" className="workspace-header-button studio-topbar-icon" disabled aria-label="Notifications unavailable" title="Notifications are unavailable in this workspace view">
          <Bell aria-hidden="true" size={15} />
        </button>
        <details ref={accessMenu} className="workspace-access" onKeyDown={accessDetails.onKeyDown} onBlur={accessDetails.onBlur}>
          <summary className="workspace-header-button studio-profile" aria-label={`Workspace access: ${accessActive ? "active" : "needs attention"}`} title="Account and workspace access">
            <span aria-hidden="true">{initials || <UserRound size={15} />}</span>
          </summary>
          <div className="workspace-access-panel studio-access-panel">
            <p className="text-xs font-medium text-zinc-200">{accessLabel}</p>
            <p className="mt-2 text-xs text-zinc-400">Current workspace</p>
            <p className="mt-1 break-all text-xs text-zinc-400">{workspace}</p>
            <p className="mt-4 text-xs text-zinc-400">{identity.kind === "desktop_session" ? "Paired desktop session" : "API key session"}</p>
            <p className="mt-1 text-xs text-zinc-400">{accessActive ? "Service-verified workspace access" : "Workspace access requires attention"}</p>
            {onToggleSplit && (
              <button type="button" aria-pressed={splitActive} onClick={() => { closeAccess(); onToggleSplit(); }} className="workspace-header-button mt-3" title="Switch between focused chat and the editor workspace">
                {splitActive ? "Single pane" : "Editor & Agent"}
              </button>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}

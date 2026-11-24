import { Bookmark, BookOpen, ChevronDown, GitBranch, House, Layers, LayoutGrid, MoreHorizontal, Settings, Sparkles, UserRound, Zap, Ticket } from "lucide-react";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { useDismissibleDetails } from "../lib/useDismissibleDetails";
import type { VerifiedDesktopIdentity } from "../lib/desktopClient";
import type { CustomerView } from "../App";
import { CUSTOMER_NAVIGATION } from "../lib/customerNavigation";
import { DESKTOP_VERSION } from "../lib/desktopMetadata";

interface NavItem {
  id: CustomerView;
  label: string;
  title?: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface NavGroup {
  kind: "deployment" | "workspace" | "utility";
  label: string;
  items: NavItem[];
  defaultCollapsed?: boolean;
}

const customerIcons: Record<(typeof CUSTOMER_NAVIGATION)[number]["items"][number]["id"], ComponentType<SVGProps<SVGSVGElement>>> = {
  agent: Sparkles, "axiom-bot": Bookmark, "deployment-requests": Layers, tickets: Ticket, "airflow-automation": LayoutGrid,
  "repository-workspace": GitBranch, "plugins-skills": Zap, docs: BookOpen, settings: Settings,
};
export const CUSTOMER_NAV_GROUPS: NavGroup[] = CUSTOMER_NAVIGATION.map(group => ({
  ...group, items: group.items.map(item => ({ ...item, Icon: customerIcons[item.id] })),
}));

export function Sidebar({ activeView, onNavigate, onOpenWelcome, homeVisible = false, compact = false, identity }: { activeView: CustomerView; onNavigate: (view: CustomerView) => void; onOpenWelcome?: () => void; homeVisible?: boolean; compact?: boolean; identity?: VerifiedDesktopIdentity }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CUSTOMER_NAV_GROUPS.map((group) => [
      group.kind,
      !group.defaultCollapsed || group.items.some((item) => item.id === activeView),
    ])),
  );

  useEffect(() => {
    const group = homeVisible ? "deployment" : CUSTOMER_NAV_GROUPS.find(item => item.items.some(entry => entry.id === activeView))?.kind;
    if (group && group !== "utility") setOpenGroups(current => current[group] === false ? {...current, [group]: true} : current);
  }, [activeView, homeVisible]);

  const workspaceDetails = useDismissibleDetails();
  const account = identity?.displayName?.trim() || "Current account";
  const workspaceRole = identity?.role === "owner" ? "Workspace owner" : identity?.role === "admin" ? "Administrator" : "Account settings";

  return (
    <aside className={`${compact ? "w-16 shrink-0" : "w-[212px]"} studio-rail flex flex-col border-r`} data-tauri-drag-region>
      <div className={`studio-rail-brand h-[54px] shrink-0 flex items-center ${compact ? "px-3" : "px-[22px]"} border-b`} data-tauri-drag-region>
        <button type="button" aria-label="V19 home" title={`V19 v${DESKTOP_VERSION}`} onClick={onOpenWelcome} className="no-drag flex items-center gap-2.5 rounded-md text-left focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-400">
          <img src="/brand/v19-mark.svg" alt="" className="h-[29px] w-8 shrink-0 object-contain" />
          {!compact && <span className="studio-brand-name">V19</span>}
        </button>
      </div>
      {!compact && identity && (
        <details className="studio-rail-workspace" ref={workspaceDetails.ref} onKeyDown={workspaceDetails.onKeyDown} onBlur={workspaceDetails.onBlur}>
          <summary aria-label="Current workspace"><Layers aria-hidden="true" size={16} /><span>Workspace</span><ChevronDown aria-hidden="true" size={13} /></summary>
          <div className="studio-rail-workspace-context">
            <p className="text-xs text-zinc-400">Workspace ID</p>
            <p className="mt-1 break-all text-xs">{identity.organizationId}</p>
            <p className="mt-3 text-xs text-zinc-400">{identity.access.allowed ? "Access verified" : "Access needs attention"}</p>
          </div>
        </details>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
      <nav aria-label="V19 workspace" className={`flex-1 ${compact ? "px-2" : "px-3"} studio-rail-nav no-drag`}>
        {CUSTOMER_NAV_GROUPS.filter(group => group.kind !== "utility").map((group) => {
          const isOpen = compact || openGroups[group.kind] !== false;
          const panelId = `sidebar-group-${group.kind}`;
          return (
            <div key={group.kind}>
              {!compact && <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenGroups((current) => ({ ...current, [group.kind]: !isOpen }))} className="flex items-center justify-between gap-1.5 px-3 mb-3 w-full text-left group hover:text-zinc-300">
                <span className="studio-rail-eyebrow text-zinc-500 group-hover:text-zinc-300 transition-colors">{group.label}</span>
                <span aria-hidden className={`text-[8px] text-zinc-500 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}>▼</span>
              </button>}
              <div id={panelId} hidden={!isOpen} className={isOpen ? "studio-rail-rows" : undefined}>
                {group.kind === "deployment" && onOpenWelcome && (
                  <button type="button" onClick={onOpenWelcome} aria-current={homeVisible ? "page" : undefined} className="sidebar-item w-full">
                    <House aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span className={compact ? "sr-only" : undefined}>Home</span>
                  </button>
                )}
                {group.items.map((item) => {
                  const isActive = !homeVisible && activeView === item.id;
                  return (
                    <button title={item.title ?? item.label} key={item.id} type="button" aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(item.id)} className="sidebar-item w-full">
                      <item.Icon aria-hidden className="h-4 w-4 shrink-0" />
                      <span className={compact ? "sr-only" : undefined}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <nav aria-label="Workspace utilities" className={`${compact ? "px-2" : "px-3"} studio-rail-utilities studio-rail-rows no-drag`}>
        {CUSTOMER_NAV_GROUPS.filter(group => group.kind === "utility").flatMap(group => group.items).map(item => (
          <button key={item.id} title={item.title ?? item.label} type="button" aria-current={!homeVisible && activeView === item.id ? "page" : undefined} onClick={() => onNavigate(item.id)} className="sidebar-item w-full">
            <item.Icon aria-hidden className="h-4 w-4 shrink-0" /><span className={compact ? "sr-only" : undefined}>{item.label}</span>
          </button>
        ))}
      </nav>
      </div>
      <div className={`${compact ? "px-0" : "px-3"} studio-rail-profile py-3 border-t border-white/6`}>
        {identity ? (
          <button type="button" className="studio-rail-account" aria-label="Account settings" onClick={() => onNavigate("settings")}>
            <UserRound aria-hidden="true" size={16} />
            {!compact && <><span><strong>{account}</strong><small>{workspaceRole}</small></span><MoreHorizontal aria-hidden="true" size={16} /></>}
          </button>
        ) : null}
      </div>
    </aside>
  );
}

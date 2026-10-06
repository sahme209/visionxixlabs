import { useState, type ComponentType, type SVGProps } from "react";
import type { CustomerView } from "../App";
import { DESKTOP_VERSION } from "../lib/desktopMetadata";

interface NavItem {
  id: CustomerView;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface NavGroup {
  kind: "deployment" | "workspace";
  label: string;
  items: NavItem[];
  defaultCollapsed?: boolean;
}

const icon = (children: React.ReactNode) => {
  function SidebarIcon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {children}
      </svg>
    );
  }
  return SidebarIcon;
};

const IconAgent = icon(<><path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M5 20v-1a7 7 0 0 1 14 0v1" /><circle cx="9" cy="7" r="0.5" fill="currentColor" /><circle cx="15" cy="7" r="0.5" fill="currentColor" /></>);
const IconRequest = icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>);
const IconDocs = icon(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>);
const IconSettings = icon(<><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" /></>);

/**
 * Customer navigation follows the deployment lifecycle. Experimental cloud,
 * AGI, billing, simulation, and connector-control surfaces are deliberately
 * absent until they are part of a verified release journey. Agent is first:
 * it's the primary way to act now (plain English -> risk-checked,
 * approval-gated, auditable action) — the Release workspace remains the
 * direct/manual path alongside it, not replaced by it.
 */
export const CUSTOMER_NAV_GROUPS: NavGroup[] = [
  {
    kind: "deployment",
    label: "Deployment",
    items: [
      { id: "agent", label: "Agent", Icon: IconAgent },
      { id: "deployment-requests", label: "Release workspace", Icon: IconRequest },
    ],
  },
  {
    kind: "workspace",
    label: "Workspace",
    items: [
      { id: "docs", label: "Documentation", Icon: IconDocs },
      { id: "settings", label: "Settings", Icon: IconSettings },
    ],
  },
];

export function Sidebar({ activeView, onNavigate }: { activeView: CustomerView; onNavigate: (view: CustomerView) => void }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CUSTOMER_NAV_GROUPS.map((group) => [
      group.kind,
      !group.defaultCollapsed || group.items.some((item) => item.id === activeView),
    ])),
  );

  return (
    <aside className="w-[268px] flex flex-col bg-[#151719] border-r border-white/[0.07]" data-tauri-drag-region>
      <div className="h-[68px] flex items-center px-5 border-b border-white/[0.06]" data-tauri-drag-region>
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-lg border border-white/[0.10] bg-[#202225] flex items-center justify-center text-sm font-semibold text-white">A</div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">Axiom Agent</div>
            <div className="text-[10px] text-zinc-500 tracking-tight">v{DESKTOP_VERSION} · Desktop</div>
          </div>
        </div>
      </div>

      <nav aria-label="Deployment workspace" className="flex-1 px-3 py-5 space-y-5 overflow-y-auto no-drag">
        {CUSTOMER_NAV_GROUPS.map((group) => {
          const isOpen = openGroups[group.kind] !== false;
          const panelId = `sidebar-group-${group.kind}`;
          return (
            <div key={group.kind}>
              <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenGroups((current) => ({ ...current, [group.kind]: !isOpen }))} className="flex items-center justify-between gap-1.5 px-3 mb-1.5 w-full text-left group hover:text-zinc-300">
                <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors">{group.label}</span>
                <span aria-hidden className={`text-[8px] text-zinc-700 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}>▼</span>
              </button>
              {isOpen && (
                <div id={panelId} className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button key={item.id} type="button" aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(item.id)} className={`sidebar-item w-full ${isActive ? "sidebar-item-active" : ""}`}>
                        <item.Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-white/[0.06]">
        <div role="status" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.025]">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-zinc-400">Production access active</span>
        </div>
      </div>
    </aside>
  );
}

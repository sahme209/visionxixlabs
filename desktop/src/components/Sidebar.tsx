/**
 * Desktop sidebar — Phase 406-desktop.
 *
 * Mirrors the web portal's 7-group taxonomy (Phase 405) so a user
 * switching between web and desktop sees identical mental model:
 *
 *   1. Start Here       — onboarding + dashboard + docs
 *   2. Operations       — cloud + security + scans
 *   3. Automation       — workflows / approvals / runbooks / simulations / audit
 *   4. Integrations     — connectors
 *   5. Business / Admin — billing + trust + settings
 *
 * Groups collapse independently. The group containing the active view
 * auto-expands. Aim: 16 visible-at-rest items vs the previous flat 10.
 */

import { useState, type ComponentType, type SVGProps } from "react";
import type { View } from "../App";

interface NavItem {
  id: View;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}
interface NavGroup {
  /** Closed-union grouping key — keeps the 7 groups consistent with the web. */
  kind:
    | "start_here"
    | "operations"
    | "automation"
    | "integrations"
    | "admin";
  label: string;
  items: NavItem[];
  /** When true, the group is collapsed by default. */
  defaultCollapsed?: boolean;
}

// ---------------------------------------------------------------------------
// Icons — minimal inline SVG, 18×18, 1.5 stroke
// ---------------------------------------------------------------------------

const Sw = (children: React.ReactNode) => (props: SVGProps<SVGSVGElement>) =>
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>;

const IconStartHere   = Sw(<><path d="M12 2v20M2 12h20" /></>);
const IconDashboard   = Sw(<><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></>);
const IconDocs        = Sw(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>);
const IconMultiCloud  = Sw(<><path d="M17.5 19a4.5 4.5 0 1 0 0-9c-.4-3.4-3.3-6-6.8-6a6.8 6.8 0 0 0-6.7 6 5 5 0 0 0 1 9.9h12.5z" /></>);
const IconSecurity    = Sw(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>);
const IconScans       = Sw(<><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></>);
const IconWorkflows   = Sw(<><path d="M3 6h18M3 12h18M3 18h12" /></>);
const IconApprovals   = Sw(<><path d="M20 6L9 17l-5-5" /></>);
const IconRemediation = Sw(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>);
const IconSimulations = Sw(<><path d="M8 3 4 7l4 4M16 21l4-4-4-4M14 7H4M10 17h10" /></>);
const IconOrchestration = Sw(<><circle cx="12" cy="12" r="3" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 7 9.5 9.5M17 7l-2.5 2.5M7 17l2.5-2.5M17 17l-2.5-2.5" /></>);
const IconHandoffs    = Sw(<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>);
const IconAudit       = Sw(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></>);
const IconConnectors  = Sw(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>);
const IconBilling     = Sw(<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>);
const IconTrust       = Sw(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>);
const IconSettings    = Sw(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>);

const GROUPS: NavGroup[] = [
  {
    kind: "start_here",
    label: "Start Here",
    items: [
      { id: "start-here", label: "Setup guide",  Icon: IconStartHere },
      { id: "dashboard",  label: "Dashboard",    Icon: IconDashboard },
      { id: "docs",       label: "Docs",         Icon: IconDocs },
    ],
  },
  {
    kind: "operations",
    label: "Operations",
    items: [
      { id: "multi-cloud", label: "Multi-cloud", Icon: IconMultiCloud },
      { id: "security",    label: "Security",    Icon: IconSecurity },
      { id: "scans",       label: "Scans",       Icon: IconScans },
      { id: "releases",    label: "Releases",    Icon: IconWorkflows },
      { id: "sops",        label: "SOPs",        Icon: IconWorkflows },
      { id: "repositories", label: "Repositories", Icon: IconWorkflows },
      { id: "branch-validation", label: "Branch validation", Icon: IconWorkflows },
      { id: "cherry-picks", label: "Cherry-picks", Icon: IconWorkflows },
    ],
  },
  {
    kind: "automation",
    label: "Automation",
    items: [
      { id: "activity",      label: "Activity",      Icon: IconWorkflows },
      { id: "workflows",     label: "Workflows",     Icon: IconWorkflows },
      { id: "approvals",     label: "Approvals",     Icon: IconApprovals },
      { id: "orchestration", label: "Orchestration", Icon: IconOrchestration },
      { id: "remediation",   label: "Remediation",   Icon: IconRemediation },
      { id: "simulations",   label: "Simulations",   Icon: IconSimulations },
      { id: "handoffs",      label: "Handoffs",      Icon: IconHandoffs },
      { id: "audit",         label: "Audit log",     Icon: IconAudit },
    ],
    defaultCollapsed: true,
  },
  {
    kind: "integrations",
    label: "Integrations",
    items: [
      { id: "connectors",        label: "Connectors",        Icon: IconConnectors },
      { id: "connector-setup",   label: "Connector setup",   Icon: IconConnectors },
      { id: "connector-health",  label: "Connector health",  Icon: IconConnectors },
      { id: "alert-escalations", label: "Alert escalations", Icon: IconConnectors },
    ],
  },
  {
    kind: "admin",
    label: "Business / Admin",
    items: [
      { id: "billing",  label: "Billing & usage", Icon: IconBilling },
      { id: "trust",    label: "Trust center",    Icon: IconTrust },
      { id: "settings", label: "Settings",        Icon: IconSettings },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar({ activeView, onNavigate }: { activeView: View; onNavigate: (view: View) => void }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const g of GROUPS) {
      out[g.label] = !g.defaultCollapsed || g.items.some((it) => it.id === activeView);
    }
    return out;
  });

  return (
    <aside className="w-60 flex flex-col bg-axiom-bg-elev border-r border-axiom-border" data-tauri-drag-region>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-axiom-border" data-tauri-drag-region>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 blur-md opacity-50 scale-110" />
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold text-white shadow-glow-violet">
              A
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">Axiom Agent</div>
            <div className="text-[9px] font-mono text-zinc-600 tracking-[0.18em] uppercase">v0.1.0 · preview</div>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto no-drag">
        {GROUPS.map((group) => {
          const isOpen = openGroups[group.label] !== false;
          return (
            <div key={group.label}>
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [group.label]: !isOpen }))}
                className="flex items-center justify-between gap-1.5 px-3 mb-1.5 w-full text-left group hover:text-zinc-300"
              >
                <span className="text-[9px] font-mono text-zinc-600 group-hover:text-zinc-400 uppercase tracking-[0.22em] transition-colors">
                  {group.label}
                </span>
                <span className={`text-[8px] text-zinc-700 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}>
                  ▼
                </span>
              </button>
              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`sidebar-item w-full ${isActive ? "sidebar-item-active" : ""}`}
                      >
                        <item.Icon className="h-[18px] w-[18px] shrink-0" />
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

      {/* Footer */}
      <div className="px-3 py-3 border-t border-axiom-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          <span className="text-[11px] font-mono text-zinc-400">connected · workspace</span>
        </div>
      </div>
    </aside>
  );
}

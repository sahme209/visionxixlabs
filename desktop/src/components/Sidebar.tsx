/**
 * Huly-style sidebar with sectioned nav. Three sections:
 *   1. Operations  — dashboard, multi-cloud
 *   2. Workflow    — remediation, simulations, orchestration, handoffs
 *   3. Operating   — scans, security, connectors, settings
 */

import type { ComponentType, SVGProps } from "react";
import type { View } from "../App";

interface NavItem {
  id: View;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}
interface NavSection {
  label: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Icons — minimal inline SVG, 18×18, 1.5 stroke
// ---------------------------------------------------------------------------

const Sw = (children: React.ReactNode) => (props: SVGProps<SVGSVGElement>) =>
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>;

const IconDashboard      = Sw(<><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></>);
const IconMultiCloud     = Sw(<><path d="M17.5 19a4.5 4.5 0 1 0 0-9c-.4-3.4-3.3-6-6.8-6a6.8 6.8 0 0 0-6.7 6 5 5 0 0 0 1 9.9h12.5z" /></>);
const IconRemediation    = Sw(<><path d="M12 2v6m0 8v6m10-10h-6m-8 0H2m15.5-7.5-4.2 4.2m-6.6 6.6-4.2 4.2m13-0-4.2-4.2m-6.6-6.6L4.5 4.5" /></>);
const IconSimulations    = Sw(<><path d="M8 3 4 7l4 4M16 21l4-4-4-4M14 7H4M10 17h10" /></>);
const IconOrchestration  = Sw(<><circle cx="12" cy="12" r="3" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 7 9.5 9.5M17 7l-2.5 2.5M7 17l2.5-2.5M17 17l-2.5-2.5" /></>);
const IconHandoffs       = Sw(<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>);
const IconScans          = Sw(<><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></>);
const IconSecurity       = Sw(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>);
const IconConnectors     = Sw(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>);
const IconSettings       = Sw(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>);

const SECTIONS: NavSection[] = [
  {
    label: "Operations",
    items: [
      { id: "dashboard",     label: "Dashboard",    Icon: IconDashboard },
      { id: "multi-cloud",   label: "Multi-cloud",  Icon: IconMultiCloud },
    ],
  },
  {
    label: "Workflow",
    items: [
      { id: "remediation",   label: "Remediation",   Icon: IconRemediation },
      { id: "simulations",   label: "Simulations",   Icon: IconSimulations },
      { id: "orchestration", label: "Orchestration", Icon: IconOrchestration },
      { id: "handoffs",      label: "Handoffs",      Icon: IconHandoffs },
    ],
  },
  {
    label: "Operating",
    items: [
      { id: "scans",         label: "Scans",         Icon: IconScans },
      { id: "security",      label: "Security",      Icon: IconSecurity },
      { id: "connectors",    label: "Connectors",    Icon: IconConnectors },
      { id: "settings",      label: "Settings",      Icon: IconSettings },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar({ activeView, onNavigate }: { activeView: View; onNavigate: (view: View) => void }) {
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
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto no-drag">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[9px] font-mono text-zinc-600 uppercase tracking-[0.22em]">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
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
          </div>
        ))}
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

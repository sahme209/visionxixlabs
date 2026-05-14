/**
 * Top bar — window title + workspace status + actions. Doubles as the
 * macOS drag region so the window moves when grabbed.
 */

import type { View } from "../App";

const VIEW_TITLES: Record<View, { title: string; subtitle: string }> = {
  dashboard:     { title: "Dashboard",     subtitle: "Control plane snapshot" },
  "multi-cloud": { title: "Multi-cloud",   subtitle: "AWS · Azure · GCP" },
  remediation:   { title: "Remediation",   subtitle: "Governed fixes from findings" },
  simulations:   { title: "Simulations",   subtitle: "Preflight against the digital twin" },
  orchestration: { title: "Orchestration", subtitle: "Approval + execution control" },
  handoffs:      { title: "Handoffs",      subtitle: "Signed plan inbox" },
  scans:         { title: "Scans",         subtitle: "Run cloud + security scans" },
  security:      { title: "Security",      subtitle: "Posture + checks + diagnoses" },
  connectors:    { title: "Connectors",    subtitle: "Provider authentication" },
  settings:      { title: "Settings",      subtitle: "Workstation preferences" },
};

export function TopBar({ activeView }: { activeView: View }) {
  const meta = VIEW_TITLES[activeView];

  return (
    <header
      className="h-14 flex items-center justify-between px-6 border-b border-axiom-border bg-axiom-bg-elev/60 backdrop-blur-xl drag"
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <h2 className="text-[13px] font-semibold tracking-tight text-white leading-tight">{meta.title}</h2>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em]">{meta.subtitle}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 no-drag">
        {/* Workspace pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-axiom-border bg-white/[0.02] text-[11px] font-mono text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
          <span>visionxixlabs · default</span>
        </div>

        {/* Status pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] text-[11px] font-mono text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
          <span>connected</span>
        </div>
      </div>
    </header>
  );
}

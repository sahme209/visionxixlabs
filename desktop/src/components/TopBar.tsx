/**
 * Top bar — window title + workspace status + actions. Doubles as the
 * macOS drag region so the window moves when grabbed.
 */

import { useEffect, useState } from "react";
import type { View } from "../App";
import { desktopClient } from "../lib/desktopClient";

const VIEW_TITLES: Record<View, { title: string; subtitle: string }> = {
  "start-here":  { title: "Start Here",    subtitle: "Setup guide + product tour" },
  dashboard:     { title: "Dashboard",     subtitle: "Control plane snapshot" },
  docs:          { title: "Documentation", subtitle: "Platform guides + references" },
  "multi-cloud": { title: "Multi-cloud",   subtitle: "AWS · Azure · GCP" },
  security:      { title: "Security",      subtitle: "Posture + checks + diagnoses" },
  scans:         { title: "Scans",         subtitle: "Run cloud + security scans" },
  workflows:     { title: "Workflows",     subtitle: "Recent + active pipeline runs" },
  approvals:     { title: "Approvals",     subtitle: "Runs awaiting human review" },
  remediation:   { title: "Remediation",   subtitle: "Governed fixes from findings" },
  simulations:   { title: "Simulations",   subtitle: "Preflight against the digital twin" },
  orchestration: { title: "Orchestration", subtitle: "Approval + execution control" },
  handoffs:      { title: "Handoffs",      subtitle: "Signed plan inbox" },
  audit:         { title: "Audit log",     subtitle: "Every action attributed + signed" },
  connectors:    { title: "Connectors",    subtitle: "Provider authentication" },
  billing:       { title: "Billing & usage", subtitle: "Plan + quota + AI credits" },
  trust:         { title: "Trust center",  subtitle: "Policies + approval boundaries" },
  settings:      { title: "Settings",      subtitle: "Workstation preferences" },
};

/**
 * Three auth states the TopBar renders:
 *   - LIVE       — vxlk_* key paired AND /api/v1/whoami succeeded.
 *                  Shows the real workspace id from the response.
 *   - PREVIEW    — no key paired. Shows "preview · mock data".
 *   - AUTH FAIL  — key paired but /whoami rejected.
 */
type AuthBadgeState =
  | { kind: "loading" }
  | { kind: "live"; workspace: string; planTier: string }
  | { kind: "preview" }
  | { kind: "auth_failed" };

export function TopBar({ activeView }: { activeView: View }) {
  const meta = VIEW_TITLES[activeView];
  const [badge, setBadge] = useState<AuthBadgeState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (!desktopClient.hasAuth()) {
      setBadge({ kind: "preview" });
      return;
    }
    desktopClient.v1Whoami().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        const d = res.data as { organization: { id: string; planTier: string } };
        setBadge({ kind: "live", workspace: d.organization.id, planTier: d.organization.planTier });
      } else {
        setBadge({ kind: "auth_failed" });
      }
    });
    return () => { cancelled = true; };
  }, [activeView]); // re-check on view switch; cheap (one whoami every nav)

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
        <AuthBadge badge={badge} />
      </div>
    </header>
  );
}

function AuthBadge({ badge }: { badge: AuthBadgeState }) {
  if (badge.kind === "live") {
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-axiom-border bg-white/[0.02] text-[11px] font-mono text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
          <span className="truncate max-w-[180px]" title={badge.workspace}>{badge.workspace}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">{badge.planTier}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] text-[11px] font-mono text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
          <span>live</span>
        </div>
      </>
    );
  }
  if (badge.kind === "preview") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/25 bg-violet-500/[0.06] text-[11px] font-mono text-violet-300">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        <span>preview · mock data</span>
      </div>
    );
  }
  if (badge.kind === "auth_failed") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/25 bg-red-500/[0.06] text-[11px] font-mono text-red-300">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        <span>auth failed · check Settings</span>
      </div>
    );
  }
  // loading
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-axiom-border bg-white/[0.02] text-[11px] font-mono text-zinc-500">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
      <span>verifying…</span>
    </div>
  );
}

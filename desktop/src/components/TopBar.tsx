/**
 * Top bar — window title + workspace status + actions. Doubles as the
 * macOS drag region so the window moves when grabbed.
 */

import { useEffect, useState } from "react";
import type { View } from "../App";
import { desktopClient } from "../lib/desktopClient";
import { usePendingApprovals } from "../lib/approvalsStore";
import { useConnectorHealthSnapshot } from "../lib/connectorHealthStore";
import { useSseStatus, type LiveStatus } from "../lib/useSseStream";

const VIEW_TITLES: Record<View, { title: string; subtitle: string }> = {
  "start-here":  { title: "Start Here",    subtitle: "Setup guide + product tour" },
  "start-here-releaseops": { title: "Start here — ReleaseOps", subtitle: "Zero-touch path from sign-in to first audited release deployed" },
  dashboard:     { title: "Dashboard",     subtitle: "Control plane snapshot" },
  docs:          { title: "Documentation", subtitle: "Platform guides + references" },
  "multi-cloud": { title: "Multi-cloud",   subtitle: "AWS · Azure · GCP" },
  security:      { title: "Security",      subtitle: "Posture + checks + diagnoses" },
  scans:         { title: "Scans",         subtitle: "Run cloud + security scans" },
  releases:      { title: "Releases",      subtitle: "Per-release status, readiness, evidence" },
  sops:          { title: "SOPs",           subtitle: "10 deployment types · 16 sections each" },
  repositories:  { title: "Repositories",   subtitle: "GitHub / GitLab / Azure DevOps inventory" },
  "branch-validation": { title: "Branch validation", subtitle: "18 checks per release · pass / fail / N/A / unknown" },
  "cherry-picks": { title: "Cherry-pick exceptions", subtitle: "Out-of-train fixes · rationale + approver decision" },
  "release-freeze": { title: "Release freeze", subtitle: "Draft · frozen · deploying · 3 buckets per release" },
  "change-tickets": { title: "Change tickets", subtitle: "Jira · Linear · ServiceNow normalized inbox" },
  "policy-violations": { title: "Policy violations", subtitle: "Engine output · blockers + warnings + advisories" },
  "release-readiness": { title: "Release readiness", subtitle: "8-dimension score per release · low / medium / high / critical" },
  "release-overview": { title: "Release overview", subtitle: "One screen per release · readiness + cherry-picks + violations + tickets + evidence" },
  "release-advisor":  { title: "Release advisor (AGI)", subtitle: "Autonomous recommendations · confidence + rationale · operator in the loop" },
  "policy-proposals": { title: "Policy proposals (AGI)", subtitle: "Pattern-matched suggestions · accept upserts a PolicyRule · operator in the loop" },
  "agi-cockpit":      { title: "AGI cockpit", subtitle: "Fused view of all autonomous engines · severity-aware headline · one hub" },
  drift:              { title: "Drift", subtitle: "Declared (IaC) vs observed (runtime) state · per-resource diff" },
  applications:       { title: "Applications", subtitle: "Top-level governance unit · register before tracking releases" },
  "manual-fixes":     { title: "Manual fixes", subtitle: "Out-of-band hand-edits · log + reconcile against source-of-truth" },
  "release-audit":    { title: "Release audit log", subtitle: "Append-only state-change trail · per-org · 500-row page cap" },
  "branch-protection":{ title: "Branch protection", subtitle: "Per-branch protection snapshots · projected from GitHub API · drives branchGovernance" },
  "release-notes":    { title: "Release notes", subtitle: "Per-release draft → reviewed → published · AI + manual share one shape" },
  "deployment-incidents":{ title: "Deployment incidents", subtitle: "Post-deploy regressions · open → mitigated → resolved · pinned to release" },
  activity:      { title: "Activity",      subtitle: "Runs + your votes + queue health" },
  workflows:     { title: "Workflows",     subtitle: "Recent + active pipeline runs" },
  approvals:     { title: "Approvals",     subtitle: "Runs awaiting human review" },
  remediation:   { title: "Remediation",   subtitle: "Governed fixes from findings" },
  simulations:   { title: "Simulations",   subtitle: "Preflight against the digital twin" },
  orchestration: { title: "Orchestration", subtitle: "Approval + execution control" },
  handoffs:      { title: "Handoffs",      subtitle: "Signed plan inbox" },
  audit:         { title: "Audit log",     subtitle: "Every action attributed + signed" },
  "github-app":      { title: "GitHub App",        subtitle: "One-click install · zero-touch onboarding · per-org isolated" },
  connectors:        { title: "Connectors",        subtitle: "Provider authentication" },
  "connector-setup": { title: "Connector setup",   subtitle: "Per-provider lifecycle + audit" },
  "connector-health":{ title: "Connector health",  subtitle: "Per-connector status + telemetry" },
  "alert-escalations":{ title: "Alert escalations", subtitle: "Per-signal lifecycle + on-call routing" },
  "webhook-deliveries":{ title: "Webhook deliveries", subtitle: "GitHub receiver · HMAC-verified · idempotent on delivery id" },
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

export function TopBar({ activeView, onNavigate }: { activeView: View; onNavigate?: (v: View) => void }) {
  const meta = VIEW_TITLES[activeView];
  const [badge, setBadge] = useState<AuthBadgeState>({ kind: "loading" });
  const pending = usePendingApprovals();
  const connectorHealth = useConnectorHealthSnapshot();
  const liveStatus = useSseStatus();

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
        <LivePill status={liveStatus} />
        {pending.hasPolled && pending.count > 0 && activeView !== "approvals" && (
          <button
            type="button"
            onClick={() => onNavigate?.("approvals")}
            title={`${pending.count} pipeline run${pending.count === 1 ? "" : "s"} awaiting approval`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/[0.08] text-[11px] font-mono text-amber-200 hover:bg-amber-500/[0.14] hover:border-amber-500/50 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{pending.count} awaiting</span>
          </button>
        )}
        {connectorHealth.hasPolled && connectorHealth.alertCount > 0 && activeView !== "connector-health" && (() => {
          const hasCritical = connectorHealth.summary.auth_failed > 0;
          const cls = hasCritical
            ? "border-red-500/30 bg-red-500/[0.08] text-red-200 hover:bg-red-500/[0.14] hover:border-red-500/50"
            : "border-amber-500/30 bg-amber-500/[0.08] text-amber-200 hover:bg-amber-500/[0.14] hover:border-amber-500/50";
          const dotCls = hasCritical ? "bg-red-400" : "bg-amber-400";
          return (
            <button
              type="button"
              onClick={() => onNavigate?.("connector-health")}
              title={`${connectorHealth.alertCount} connector${connectorHealth.alertCount === 1 ? "" : "s"} needing attention`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono transition-colors ${cls}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotCls}`} />
              <span>{connectorHealth.alertCount} connector{connectorHealth.alertCount === 1 ? "" : "s"}</span>
            </button>
          );
        })()}
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

/**
 * Live pill — surfaces the SSE connection state. Phase 409.
 *   open       → emerald · "live"  (events streaming, no polling penalty)
 *   connecting → amber   · "linking…"
 *   fallback   → amber   · "polling"  (3+ failures, polling safety net is active)
 *   closed     → zinc    · "offline"  (transient between reconnects)
 *   idle       → hidden  (no auth or first paint)
 */
function LivePill({ status }: { status: LiveStatus }) {
  if (status === "idle") return null;
  const cfg = (() => {
    switch (status) {
      case "open":       return { dot: "bg-emerald-400 animate-pulse-glow", pill: "border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-300", label: "live" };
      case "connecting": return { dot: "bg-amber-400 animate-pulse",        pill: "border-amber-500/25 bg-amber-500/[0.04] text-amber-200",    label: "linking…" };
      case "fallback":   return { dot: "bg-amber-400",                      pill: "border-amber-500/25 bg-amber-500/[0.04] text-amber-200",    label: "polling" };
      case "closed":     return { dot: "bg-zinc-500",                       pill: "border-axiom-border bg-white/[0.02] text-zinc-400",         label: "offline" };
    }
  })();
  return (
    <div title={`Live event stream · ${status}`} className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-mono ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <span>{cfg.label}</span>
    </div>
  );
}

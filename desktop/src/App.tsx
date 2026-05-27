import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { DashboardView } from "./views/DashboardView";
import { ConnectorsView } from "./views/ConnectorsView";
import { ScansView } from "./views/ScansView";
import { SettingsView } from "./views/SettingsView";
import { HandoffsView } from "./views/HandoffsView";
import { SecurityView } from "./views/SecurityView";
import { MultiCloudView } from "./views/MultiCloudView";
import { RemediationView } from "./views/RemediationView";
import { SimulationsView } from "./views/SimulationsView";
import { OrchestrationView } from "./views/OrchestrationView";
import { StartHereView } from "./views/StartHereView";
import { ApprovalsView } from "./views/ApprovalsView";
import { WorkflowsView } from "./views/WorkflowsView";
import { AuditView } from "./views/AuditView";
import { BillingView } from "./views/BillingView";
import { TrustView } from "./views/TrustView";
import { DocsView } from "./views/DocsView";
import { ActivityView } from "./views/ActivityView";
import { ConnectorHealthView } from "./views/ConnectorHealthView";
import { ConnectorSetupView } from "./views/ConnectorSetupView";
import { AlertEscalationsView } from "./views/AlertEscalationsView";
import { ReleasesView } from "./views/ReleasesView";
import { SopsView } from "./views/SopsView";
import { RepositoriesView } from "./views/RepositoriesView";
import { BranchValidationView } from "./views/BranchValidationView";
import { CherryPicksView } from "./views/CherryPicksView";
import { ReleaseFreezeView } from "./views/ReleaseFreezeView";
import { ChangeTicketsView } from "./views/ChangeTicketsView";
import { PolicyViolationsView } from "./views/PolicyViolationsView";
import { ReleaseReadinessView } from "./views/ReleaseReadinessView";
import { ReleaseOverviewView } from "./views/ReleaseOverviewView";
import { useTrayApprovalsBadge } from "./lib/useTrayApprovalsBadge";
import { useConnectorHealthAmbientPoll } from "./lib/connectorHealthStore";
import { useSseStream } from "./lib/useSseStream";
import { useNativeMenuActions } from "./lib/useNativeMenuActions";
import { useTrayPendingSelectionBootstrap } from "./lib/useTrayPendingSelection";
import { useTrayDecisions } from "./lib/useTrayDecisions";

/**
 * Closed-union of every desktop view. Phase 406-desktop expands the
 * surface to mirror the web's 7-group structure: Start Here, Operations,
 * Team Workflows, AI Workforce, Automation, Integrations, Admin.
 */
export type View =
  // Start Here
  | "start-here"
  | "dashboard"
  | "docs"
  // Operations
  | "multi-cloud"
  | "security"
  | "scans"
  // Operations — release management
  | "releases"
  | "sops"
  | "repositories"
  | "branch-validation"
  | "cherry-picks"
  | "release-freeze"
  | "change-tickets"
  | "policy-violations"
  | "release-readiness"
  | "release-overview"
  // Automation
  | "activity"
  | "workflows"
  | "approvals"
  | "remediation"
  | "simulations"
  | "orchestration"
  | "handoffs"
  | "audit"
  // Integrations
  | "connectors"
  | "connector-health"
  | "connector-setup"
  | "alert-escalations"
  // Business / Admin
  | "billing"
  | "trust"
  | "settings";

export default function App() {
  const [activeView, setActiveView] = useState<View>("start-here");
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Keep the menubar/tray pending-approval badge fresh even when the user
  // is on a non-Approvals view. Independent of (and slower than) the
  // 5s per-view poll inside ApprovalsView itself.
  useTrayApprovalsBadge();

  // macOS app menu / cross-platform shortcuts (Cmd+1..4 jump to views,
  // Cmd+, opens Settings). Backed by the menu items in `src-tauri/src/menu.rs`.
  useNativeMenuActions(setActiveView);

  // Capture tray-menu pending-run clicks. ApprovalsView reads the selected
  // runId via useTrayPendingSelection() and scrolls it into view.
  useTrayPendingSelectionBootstrap();

  // Quick-approve / quick-reject from the tray submenu. Fires the v1
  // decide endpoint and surfaces the outcome as a native notification —
  // operator never has to open the main window.
  useTrayDecisions();

  // Phase 408 — ambient connector-health poll. One producer at App
  // level; ConnectorHealthView + TopBar pill subscribe via the shared
  // store. 30s cadence (slower than approvals because connector status
  // changes on the minute scale, not the second).
  useConnectorHealthAmbientPoll();

  // Phase 409 — long-lived SSE connection. Pushes approvals snapshots
  // into the same approvalsStore the pollers write into, so SSE is the
  // primary transport and the pollers are the safety net (they keep
  // running and refresh state on the slower cadence if SSE drops or
  // falls back). Subscribed to approvals + heartbeat only — the
  // connector store still uses its own poll for now.
  const sseStatus = useSseStream({ subscribe: "approvals.snapshot,heartbeat" });
  // Expose the live status as a body data attribute so TopBar (or any
  // surface) can render a "live" indicator without prop-drilling.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.sseStatus = sseStatus;
    }
  }, [sseStatus]);

  if (!booted) return <BootScreen />;

  return (
    <div className="flex h-screen bg-axiom-bg text-white overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar activeView={activeView} onNavigate={setActiveView} />
        <div className="flex-1 min-h-0 flex flex-col">
          {activeView === "start-here"    && <StartHereView onNavigate={setActiveView} />}
          {activeView === "dashboard"     && <DashboardView />}
          {activeView === "docs"          && <DocsView />}
          {activeView === "multi-cloud"   && <MultiCloudView />}
          {activeView === "security"      && <SecurityView />}
          {activeView === "scans"         && <ScansView />}
          {activeView === "releases"      && <ReleasesView />}
          {activeView === "sops"          && <SopsView />}
          {activeView === "repositories"  && <RepositoriesView />}
          {activeView === "branch-validation" && <BranchValidationView />}
          {activeView === "cherry-picks"  && <CherryPicksView />}
          {activeView === "release-freeze" && <ReleaseFreezeView />}
          {activeView === "change-tickets" && <ChangeTicketsView />}
          {activeView === "policy-violations" && <PolicyViolationsView />}
          {activeView === "release-readiness" && <ReleaseReadinessView />}
          {activeView === "release-overview"  && <ReleaseOverviewView />}
          {activeView === "activity"      && <ActivityView />}
          {activeView === "workflows"     && <WorkflowsView />}
          {activeView === "approvals"     && <ApprovalsView />}
          {activeView === "remediation"   && <RemediationView />}
          {activeView === "simulations"   && <SimulationsView />}
          {activeView === "orchestration" && <OrchestrationView />}
          {activeView === "handoffs"      && <HandoffsView />}
          {activeView === "audit"         && <AuditView />}
          {activeView === "connectors"        && <ConnectorsView />}
          {activeView === "connector-health"  && <ConnectorHealthView />}
          {activeView === "connector-setup"   && <ConnectorSetupView />}
          {activeView === "alert-escalations" && <AlertEscalationsView />}
          {activeView === "billing"       && <BillingView />}
          {activeView === "trust"         && <TrustView />}
          {activeView === "settings"      && <SettingsView />}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boot screen — cinematic loading
// ---------------------------------------------------------------------------

function BootScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-axiom-bg text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full bg-violet-500/[0.10] blur-[160px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[520px] h-[520px] rounded-full bg-fuchsia-500/[0.07] blur-[140px]" />
        <div className="absolute top-0 left-0 w-[420px] h-[420px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 blur-2xl opacity-50 scale-110 animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold shadow-[0_0_60px_rgba(139,92,246,0.5)]">
            A
          </div>
        </div>
        <p className="text-base font-semibold tracking-tight text-white">Axiom Agent</p>
        <p className="text-[10px] font-mono text-zinc-500 tracking-[0.22em] uppercase mt-2">Initialising local runtime</p>
        <div className="mt-6 w-48 h-[2px] bg-zinc-800/70 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 animate-[boot-bar_1s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`
        @keyframes boot-bar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

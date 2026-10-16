import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { WorkspaceViewBoundary } from "./components/WorkspaceViewBoundary";
import { AgentChatView, type AgentSettingsDestination } from "./views/AgentChatView";
import { DeploymentRequestsView } from "./views/DeploymentRequestsView";
import { DocsView } from "./views/DocsView";
import { SettingsView } from "./views/SettingsView";
import { PluginsSkillsView } from "./views/PluginsSkillsView";
import { RepositoryWorkspaceView } from "./views/RepositoryWorkspaceView";
import { AirflowAutomationView } from "./views/AirflowAutomationView";
import { DesktopSignInView } from "./views/DesktopSignInView";
import { DesktopAccessRequiredView } from "./views/DesktopAccessRequiredView";
import { desktopClient, type VerifiedDesktopIdentity } from "./lib/desktopClient";
import { createCredentialVerificationCoordinator, type CredentialVerificationCoordinator } from "./lib/credentialVerificationCoordinator";
import { readDesktopPreferences } from "./lib/preferences";
import { useNativeMenuActions } from "./lib/useNativeMenuActions";

/** Only verified, customer-reachable desktop destinations belong here. */
export type CustomerView = "agent" | "deployment-requests" | "airflow-automation" | "repository-workspace" | "plugins-skills" | "docs" | "settings";

/**
 * Dormant source modules remain type-checked for requirements recovery, but
 * these identifiers are not accepted by the customer sidebar or App state.
 */
export type View = CustomerView
  | "start-here" | "dashboard" | "multi-cloud" | "security" | "scans"
  | "releases" | "sops" | "repositories" | "branch-validation" | "cherry-picks"
  | "release-freeze" | "change-tickets" | "policy-violations" | "release-readiness"
  | "release-overview" | "drift" | "applications" | "manual-fixes" | "release-audit"
  | "webhook-deliveries" | "branch-protection" | "release-notes" | "deployment-incidents"
  | "github-app" | "start-here-releaseops" | "release-advisor" | "policy-proposals"
  | "agi-cockpit" | "incident-triage" | "learning-loop" | "remediation-proposals"
  | "releaseops-autonomy" | "advisor-council" | "agi-memory" | "agi-suggestions"
  | "ai-call-log" | "activity" | "workflows" | "approvals" | "remediation"
  | "simulations" | "orchestration" | "handoffs" | "audit" | "connectors"
  | "connector-health" | "connector-setup" | "alert-escalations" | "slack-notifications"
  | "billing" | "trust";

export default function App() {
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "access_required" | "unauthenticated">("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<VerifiedDesktopIdentity | null>(null);
  const credentialVerification = useRef<CredentialVerificationCoordinator | null>(null);

  useEffect(() => {
    void readDesktopPreferences().catch(() => undefined);
    const coordinator = createCredentialVerificationCoordinator<VerifiedDesktopIdentity>({
      // setSession/setApiBase replace config, including a same-token reload.
      readContext: () => ({ version: desktopClient.config, present: desktopClient.hasAuth() }),
      verify: () => desktopClient.verifyCurrentCredential(),
      onVerified: (verified) => {
        setIdentity(verified);
        setAuthError(null);
        setAuthState(verified.access.allowed ? "authenticated" : "access_required");
      },
      onRejected: (error) => {
        // Lock the current transport synchronously. A network/schema failure
        // is not authority to delete saved credentials from the secure vault.
        desktopClient.setSession(undefined);
        setIdentity(null);
        setAuthError(`Your saved sign-in could not be verified. ${error}`);
        setAuthState("unauthenticated");
      },
      onMissing: () => { setIdentity(null); setAuthState("unauthenticated"); },
    });
    credentialVerification.current = coordinator;
    void coordinator.verify();
    const verifyAfterBrowserReturn = () => { void coordinator.verify(); };
    window.addEventListener("focus", verifyAfterBrowserReturn);
    return () => {
      coordinator.dispose();
      if (credentialVerification.current === coordinator) credentialVerification.current = null;
      window.removeEventListener("focus", verifyAfterBrowserReturn);
    };
  }, []);

  if (authState === "checking") return <BootScreen status="Verifying saved sign-in" />;
  if (authState === "unauthenticated") {
    return (
      <DesktopSignInView
        initialError={authError}
        onSignedIn={(verifiedIdentity) => {
          credentialVerification.current?.invalidate();
          setAuthError(null);
          setIdentity(verifiedIdentity);
          setAuthState(verifiedIdentity.access.allowed ? "authenticated" : "access_required");
        }}
      />
    );
  }
  if (!identity) return <BootScreen status="Loading verified identity" />;
  if (authState === "access_required") {
    return (
      <DesktopAccessRequiredView
        identity={identity}
        onAccessGranted={(verifiedIdentity) => {
          credentialVerification.current?.invalidate();
          setIdentity(verifiedIdentity);
          setAuthState("authenticated");
        }}
        onSignedOut={() => {
          credentialVerification.current?.invalidate();
          setIdentity(null);
          setAuthError(null);
          setAuthState("unauthenticated");
        }}
      />
    );
  }
  return <AuthenticatedWorkspace identity={identity} />;
}

function AuthenticatedWorkspace({ identity }: { identity: VerifiedDesktopIdentity }) {
  const [activeView, setActiveView] = useState<CustomerView>("agent");
  const [booted, setBooted] = useState(false);
  const [settingsDestination, setSettingsDestination] = useState<AgentSettingsDestination | undefined>();
  const navigate = useCallback((view: CustomerView) => { setSettingsDestination(undefined); setActiveView(view); }, []);
  useNativeMenuActions(navigate);

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 250);
    return () => clearTimeout(timer);
  }, []);

  if (!booted) return <BootScreen status="Loading deployment workspace" />;

  return (
    <div className="flex h-screen bg-axiom-bg text-white overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={navigate} />
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar activeView={activeView} identity={identity} />
        <WorkspaceViewBoundary key={activeView} onReturnToAgent={() => setActiveView("agent")}>
          {activeView === "agent" && <AgentChatView onOpenSettings={(destination) => { setSettingsDestination(destination); setActiveView("settings"); }} />}
          {activeView === "deployment-requests" && <DeploymentRequestsView />}
          {activeView === "airflow-automation" && <AirflowAutomationView />}
          {activeView === "repository-workspace" && <RepositoryWorkspaceView />}
          {activeView === "plugins-skills" && <PluginsSkillsView onOpenSettings={() => setActiveView("settings")} onOpenAirflow={() => setActiveView("airflow-automation")} />}
          {activeView === "docs" && <DocsView />}
          {activeView === "settings" && <SettingsView identity={identity} initialSection={settingsDestination} />}
        </WorkspaceViewBoundary>
      </main>
    </div>
  );
}

function BootScreen({ status }: { status: string }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-axiom-bg text-white relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative w-14 h-14 rounded-xl border border-white/[0.10] bg-[#202225] flex items-center justify-center text-xl font-semibold">A</div>
        <p className="mt-6 text-base font-semibold tracking-tight text-white">Axiom Agent</p>
        <p className="mt-2 text-[10px] font-mono text-zinc-500 tracking-[0.22em] uppercase">{status}</p>
        <div className="mt-6 w-48 h-[2px] bg-zinc-800/70 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-zinc-200 animate-[boot-bar_1s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`@keyframes boot-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
}

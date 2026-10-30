import type { LocalEditRequest } from "./lib/localEditReview";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WorkspaceCommands } from "./components/WorkspaceCommands";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { WorkspaceViewBoundary } from "./components/WorkspaceViewBoundary";
import { AgentChatView, type AgentSettingsDestination, type AgentSkillRequest, type AgentLocalCodeRequest, type AgentAirflowRequest } from "./views/AgentChatView";
import { WelcomeView } from "./views/WelcomeView";
import { AxiomBotView } from "./views/AxiomBotView";
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
export type CustomerView = "agent" | "axiom-bot" | "deployment-requests" | "airflow-automation" | "repository-workspace" | "plugins-skills" | "docs" | "settings";

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
  const [canRetrySavedSignIn, setCanRetrySavedSignIn] = useState(false);
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
        setCanRetrySavedSignIn(false);
        setAuthState(verified.access.allowed ? "authenticated" : "access_required");
      },
      onRejected: (error, failureKind) => {
        // Lock the current transport synchronously. A network/schema failure
        // is not authority to delete saved credentials from the secure vault.
        desktopClient.setSession(undefined);
        setIdentity(null);
        setCanRetrySavedSignIn(failureKind === "unavailable");
        setAuthError(error);
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
        canRetrySavedSignIn={canRetrySavedSignIn}
        onSignedIn={(verifiedIdentity) => {
          credentialVerification.current?.invalidate();
          setAuthError(null);
          setCanRetrySavedSignIn(false);
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
          setCanRetrySavedSignIn(false);
          setIdentity(verifiedIdentity);
          setAuthState("authenticated");
        }}
        onSignedOut={() => {
          credentialVerification.current?.invalidate();
          setIdentity(null);
          setAuthError(null);
          setCanRetrySavedSignIn(false);
          setAuthState("unauthenticated");
        }}
      />
    );
  }
  return <AuthenticatedWorkspace identity={identity} />;
}

function AuthenticatedWorkspace({ identity }: { identity: VerifiedDesktopIdentity }) {
  const contextRevision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
  const identityKey=JSON.stringify(identity);
  const [botAppsReturn,setBotAppsReturn]=useState<{context:typeof desktopClient.config;revision:number;identityKey:string}|null>(null);
  const [activeView, setActiveView] = useState<CustomerView>("agent");
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [splitWorkspace, setSplitWorkspace] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const settingsReturnView = useRef<CustomerView>("agent");
  const [botVisited, setBotVisited] = useState(false);
  const [repositoryVisited, setRepositoryVisited] = useState(false);
  const [agentVisited, setAgentVisited] = useState(false);
  const [requestedSkill, setRequestedSkill] = useState<AgentSkillRequest>();
  const [requestedAirflow, setRequestedAirflow] = useState<AgentAirflowRequest>();
  const [requestedLocalCode, setRequestedLocalCode] = useState<AgentLocalCodeRequest>();
  const [editRequest, setEditRequest] = useState<LocalEditRequest>();
  const [settingsDestination, setSettingsDestination] = useState<AgentSettingsDestination | undefined>();
  const navigate = useCallback((view: CustomerView) => { setBotAppsReturn(null); setWelcomeVisible(false); if (view === "agent" || view === "repository-workspace") setSplitWorkspace(false); if (view === "agent" || view === "repository-workspace") { setAgentVisited(true); setRepositoryVisited(true); } if (view === "axiom-bot") setBotVisited(true); if (view === "repository-workspace") setRepositoryVisited(true); setSettingsDestination(undefined); setActiveView(current => { if (view === "settings" && current !== "settings") settingsReturnView.current = current; return view; }); }, []);
  useNativeMenuActions(navigate);
  const botAppsOwned=activeView==='plugins-skills'&&!welcomeVisible&&botAppsReturn?.context===desktopClient.config&&botAppsReturn.revision===contextRevision&&botAppsReturn.identityKey===identityKey;
  useEffect(()=>{setBotAppsReturn(current=>current&&(current.context!==desktopClient.config||current.revision!==contextRevision||current.identityKey!==identityKey)?null:current)},[contextRevision,identityKey]);
  const openBotApps=()=>{if(activeView!=='axiom-bot'||welcomeVisible)return;navigate('plugins-skills');setBotAppsReturn({context:desktopClient.config,revision:contextRevision,identityKey})};

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 250);
    return () => clearTimeout(timer);
  }, []);

  const workspaceVisible = !welcomeVisible && (activeView === "agent" || activeView === "repository-workspace");
  const splitVisible = splitWorkspace && workspaceVisible;

  if (!booted) return <BootScreen status="Loading engineering workspace" />;

  return (
    <div className="flex h-screen bg-axiom-bg text-white overflow-hidden">
      {activeView !== "settings" && <Sidebar compact={false} activeView={activeView} onNavigate={navigate} homeVisible={welcomeVisible} onOpenWelcome={() => {setBotAppsReturn(null);setWelcomeVisible(true)}} />}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {activeView !== "settings" && <TopBar welcome={welcomeVisible} splitActive={splitVisible} onToggleSplit={workspaceVisible ? () => {setRepositoryVisited(true); setSplitWorkspace(value => !value);} : undefined} activeView={activeView} identity={identity} onOpenCommands={() => setCommandsOpen(true)} />}
        {welcomeVisible && <WelcomeView onBot={() => navigate("axiom-bot")} onBuild={() => navigate("agent")} onAutomate={() => navigate("airflow-automation")} onDeploy={() => navigate("deployment-requests")} />}
        <div hidden={!workspaceVisible} style={{display: workspaceVisible ? "flex" : "none"}} className={`engineering-panes min-h-0 flex-1 ${splitVisible ? "engineering-panes-split" : "flex-col"}`}>
        <div hidden={!splitVisible && activeView !== "agent"} style={{ display: splitVisible || activeView === "agent" ? "flex" : "none" }} className={`min-h-0 min-w-0 flex-1 flex-col ${splitVisible ? "engineering-agent-pane" : ""}`}>
          {agentVisited && <WorkspaceViewBoundary onReturnToAgent={() => navigate("agent")}>
            <AgentChatView compact={splitVisible} requestedAirflow={requestedAirflow} onReviewLocalEdit={(edit, edits) => { setEditRequest({edit, edits, context: desktopClient.config, workspace: identity.organizationId}); setRepositoryVisited(true); navigate("repository-workspace"); }} requestedLocalCode={requestedLocalCode} requestedSkill={requestedSkill} active={!welcomeVisible && (splitVisible || activeView === "agent")} identity={identity} onOpenSettings={(destination) => { settingsReturnView.current = "agent"; setSettingsDestination(destination); setActiveView("settings"); }} />
          </WorkspaceViewBoundary>}
        </div>
        {repositoryVisited && <div hidden={!splitVisible && activeView !== "repository-workspace"} style={{ display: splitVisible || activeView === "repository-workspace" ? "flex" : "none" }} className={`min-h-0 min-w-0 flex-1 flex-col ${splitVisible ? "engineering-editor-pane" : ""}`}>
          <WorkspaceViewBoundary onReturnToAgent={() => navigate("agent")}>
            <RepositoryWorkspaceView selectionUser={identity.kind === "desktop_session" ? identity.email : undefined} compact={splitVisible} editRequest={editRequest} workspace={identity.organizationId} active={!welcomeVisible && (splitVisible || activeView === "repository-workspace")} onAskAgent={selection => { setRequestedLocalCode({ ...selection, context: desktopClient.config, workspace: identity.organizationId }); navigate("agent"); }} />
          </WorkspaceViewBoundary>
        </div>}
        </div>
        {botVisited && <div hidden={welcomeVisible || activeView !== "axiom-bot"} style={{display: !welcomeVisible && activeView === "axiom-bot" ? "flex" : "none"}} className="min-h-0 flex-1 flex-col">
          <WorkspaceViewBoundary onReturnToAgent={() => navigate("agent")}>
            <AxiomBotView onConnectApps={openBotApps} identity={identity} active={!welcomeVisible && activeView === "axiom-bot"} />
          </WorkspaceViewBoundary>
        </div>}
        {activeView !== "agent" && activeView !== "repository-workspace" && activeView !== "axiom-bot" && <div hidden={welcomeVisible} style={{display: welcomeVisible ? "none" : "flex"}} className="flex min-h-0 flex-1 flex-col"><WorkspaceViewBoundary key={activeView} onReturnToAgent={() => navigate("agent")}>
          {activeView === "deployment-requests" && <DeploymentRequestsView />}
          {activeView === "airflow-automation" && <AirflowAutomationView onInspect={(dagId, runId) => { setRequestedAirflow({dagId, runId, context: desktopClient.config, workspace: identity.organizationId}); navigate("agent"); }} />}
          {activeView === "plugins-skills" && <PluginsSkillsView key={botAppsOwned?"bot-apps":"catalogue"} initialFilter={botAppsOwned?"plugins":"all"} onReturnToBot={botAppsOwned?()=>{if(botAppsReturn?.context===desktopClient.config&&botAppsReturn.revision===desktopClient.getContextRevision()&&botAppsReturn.identityKey===JSON.stringify(identity))navigate("axiom-bot")}:undefined} onUseSkill={skillId => { setRequestedSkill({ skillId, context: desktopClient.config, workspace: identity.organizationId }); navigate("agent"); }} canManage={identity.role === "owner" || identity.role === "admin"} onOpenSettings={() => { const origin=botAppsOwned?botAppsReturn:null; navigate("settings"); if(origin)setBotAppsReturn(origin); setSettingsDestination("integrations"); }} onOpenAirflow={() => navigate("airflow-automation")} />}
          {activeView === "docs" && <DocsView onNavigate={navigate} />}
          {activeView === "settings" && <SettingsView onOpenRepository={() => navigate("repository-workspace")} identity={identity} initialSection={settingsDestination} onClose={() => setActiveView(settingsReturnView.current)} />}
        </WorkspaceViewBoundary></div>}
      </main>
      <WorkspaceCommands open={commandsOpen} onOpenChange={setCommandsOpen} onNavigate={navigate} />
    </div>
  );
}

function BootScreen({ status }: { status: string }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-axiom-bg text-white relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center">
        <img src="/axiom-logo.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
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

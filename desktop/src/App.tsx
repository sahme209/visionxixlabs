import { DESKTOP_PRODUCT_NAME } from "./lib/desktopMetadata";
import { agentDraftText, type AgentDraftRequest, type HomePlanningContext, type HomePlanningIntent } from "./lib/agentDraftRequest";
import type { LocalEditRequest } from "./lib/localEditReview";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DesktopDialog } from "./components/DesktopDialog";
import { WorkspaceCommands } from "./components/WorkspaceCommands";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { WorkspaceViewBoundary } from "./components/WorkspaceViewBoundary";
import { AgentChatView, type AgentSettingsDestination, type AgentSkillRequest, type AgentLocalCodeRequest, type AgentAirflowRequest } from "./views/AgentChatView";
import { WelcomeView, type SavedReleaseLink } from "./views/WelcomeView";
import { AxiomBotView } from "./views/AxiomBotView";
import { DeploymentRequestsWorkspace as DeploymentRequestsView } from "./views/DeploymentRequestsWorkspace";
import { DocsView } from "./views/DocsView";
import { SettingsView } from "./views/SettingsView";
import { PluginsSkillsView } from "./views/PluginsSkillsView";
import { AgentPlanContextView } from "./views/AgentPlanContextView";
import { TicketsDirectoryView } from "./views/TicketsDirectoryView";
import { RepositoryDirectoryView } from "./views/RepositoryDirectoryView";
import { RepositoryWorkspaceView } from "./views/RepositoryWorkspaceView";
import { BatchesWorkspaceView } from "./views/BatchesWorkspaceView";
import { DesktopSignInView } from "./views/DesktopSignInView";
import { DesktopAccessRequiredView } from "./views/DesktopAccessRequiredView";
import { desktopClient, type VerifiedDesktopIdentity } from "./lib/desktopClient";
import { createCredentialVerificationCoordinator, type CredentialVerificationCoordinator } from "./lib/credentialVerificationCoordinator";
import { signOutDesktopCredentials } from "./lib/activeDesktopCredential";
import { readDesktopPreferences } from "./lib/preferences";
import { useNativeMenuActions } from "./lib/useNativeMenuActions";

/** Only verified, customer-reachable desktop destinations belong here. */
export type CustomerView = "agent" | "axiom-bot" | "deployment-requests" | "tickets" | "airflow-automation" | "repository-workspace" | "plugins-skills" | "docs" | "settings";

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
  const credentialContext = useSyncExternalStore(desktopClient.subscribeContext, () => desktopClient.config, () => desktopClient.config);
  const acceptedContext = useRef<typeof desktopClient.config | null>(null);
  const signOutFlight = useRef(false);
  const appMounted = useRef(false);
  const [signOutStatus, setSignOutStatus] = useState<{context: typeof desktopClient.config; failed: boolean} | null>(null);
  const credentialVerification = useRef<CredentialVerificationCoordinator | null>(null);

  useEffect(() => {
    appMounted.current = true;
    void readDesktopPreferences().catch(() => undefined);
    const coordinator = createCredentialVerificationCoordinator<VerifiedDesktopIdentity>({
      // setSession/setApiBase replace config, including a same-token reload.
      readContext: () => ({ version: desktopClient.config, present: desktopClient.hasAuth() }),
      verify: () => desktopClient.verifyCurrentCredential(),
      onVerified: (verified) => {
        acceptedContext.current = desktopClient.config;
        setIdentity(verified);
        setAuthError(null);
        setCanRetrySavedSignIn(false);
        setAuthState(verified.access.allowed ? "authenticated" : "access_required");
      },
      onRejected: (error, failureKind) => {
        // Lock the current transport synchronously. A network/schema failure
        // is not authority to delete saved credentials from the secure vault.
        acceptedContext.current = null;
        desktopClient.setSession(undefined);
        setIdentity(null);
        setCanRetrySavedSignIn(failureKind === "unavailable");
        setAuthError(error);
        setAuthState("unauthenticated");
      },
      onMissing: () => { acceptedContext.current = null; setIdentity(null); setAuthState("unauthenticated"); },
    });
    credentialVerification.current = coordinator;
    const verifyAfterBrowserReturn = () => { void coordinator.verify(); };
    window.addEventListener("focus", verifyAfterBrowserReturn);
    return () => {
      appMounted.current = false;
      coordinator.dispose();
      if (credentialVerification.current === coordinator) credentialVerification.current = null;
      window.removeEventListener("focus", verifyAfterBrowserReturn);
    };
  }, []);

  useEffect(() => {
    if (acceptedContext.current !== credentialContext || !desktopClient.hasAuth()) void credentialVerification.current?.verify();
  }, [credentialContext]);

  async function signOut(reload: boolean, expected: typeof desktopClient.config, requireMissing = false) {
    if (!appMounted.current || signOutFlight.current || desktopClient.config !== expected || (requireMissing && desktopClient.hasAuth())) return;
    signOutFlight.current = true;
    const pending = signOutDesktopCredentials();
    const lockedContext = desktopClient.config;
    const owns = () => appMounted.current && desktopClient.config === lockedContext && !desktopClient.hasAuth();
    setSignOutStatus({context: lockedContext, failed: false});
    credentialVerification.current?.invalidate();
    if (owns()) { acceptedContext.current = null; setIdentity(null); setAuthState("unauthenticated"); setAuthError(null); setCanRetrySavedSignIn(false); }
    try {
      await pending;
      if (owns()) { setSignOutStatus(null); if (reload) window.location.reload(); }
    } catch {
      if (owns()) { setSignOutStatus({context: lockedContext, failed: true}); setAuthError("Sign-out could not be saved completely. Your workspace is locked, but saved sign-in details may remain on this device. Retry saved credential cleanup when secure storage is available before reopening the app."); }
    } finally { signOutFlight.current = false; }
  }

  if (signOutStatus?.context === credentialContext && !signOutStatus.failed && !desktopClient.hasAuth()) return <BootScreen status="Finishing sign-out" />;
  if (signOutStatus?.context === credentialContext && signOutStatus.failed && !desktopClient.hasAuth()) return (
    <main className="flex min-h-screen items-center justify-center bg-axiom-bg p-6 text-white">
      <section aria-labelledby="sign-out-recovery-heading" className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-950 p-6">
        <h1 id="sign-out-recovery-heading" className="text-xl font-semibold">Finish signing out</h1>
        <p role="alert" className="mt-4 text-sm text-zinc-300">{authError}</p>
        <button type="button" className="mt-5 rounded-lg border border-white/20 px-4 py-2 text-sm" onClick={() => void signOut(false, signOutStatus.context, true)}>Retry saved credential cleanup</button>
      </section>
    </main>
  );
  const identityOwned = acceptedContext.current === credentialContext && desktopClient.hasAuth();
  if ((authState === "checking" || !identityOwned) && desktopClient.hasAuth()) return <BootScreen status="Verifying saved sign-in" />;
  if (authState === "unauthenticated" || !identityOwned) {
    return (
      <DesktopSignInView
        initialError={authError}
        canRetrySavedSignIn={canRetrySavedSignIn}
        onSignedIn={(verifiedIdentity) => {
          credentialVerification.current?.invalidate();
          setAuthError(null);
          setCanRetrySavedSignIn(false);
          acceptedContext.current = desktopClient.config;
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
        onSignOut={() => signOut(false, credentialContext)}
        onAccessGranted={(verifiedIdentity) => {
          credentialVerification.current?.invalidate();
          setCanRetrySavedSignIn(false);
          acceptedContext.current = desktopClient.config;
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
  return <AuthenticatedWorkspace identity={identity} verifiedConfig={credentialContext} onSignOut={() => signOut(true, credentialContext)} />;
}

function AuthenticatedWorkspace({ identity, verifiedConfig, onSignOut }: {
  identity: VerifiedDesktopIdentity;
  verifiedConfig: typeof desktopClient.config;
  onSignOut: () => Promise<void>;
}) {
  const content = useRef<HTMLElement>(null);
  const agentConversation = useRef<HTMLDivElement>(null);
  const releaseDialogReturn = useRef<"intake" | "workspace" | undefined>(undefined);
  const contextRevision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
  const identityKey=JSON.stringify(identity);
  const [homeDrafts, setHomeDrafts] = useState<{ config: typeof desktopClient.config; revision: number; identityKey: string; drafts: Partial<Record<HomePlanningIntent, string>> }>();
  const [plannerRequest, setPlannerRequest] = useState<AgentDraftRequest>();
  const [ticketPlanReturn, setTicketPlanReturn] = useState<Pick<AgentDraftRequest, "context" | "revision" | "identityKey">>();
  const [agentPlan, setAgentPlan] = useState<{
    release: SavedReleaseLink;
    config: typeof desktopClient.config;
    revision: number;
    identityKey: string;
  }>();
  const homeDraftsOwned = homeDrafts && homeDrafts.config === verifiedConfig && homeDrafts.revision === contextRevision && homeDrafts.identityKey === identityKey;
  useEffect(() => {
    if (homeDrafts && !homeDraftsOwned) setHomeDrafts(undefined);
    setPlannerRequest(previous => previous && previous.context === verifiedConfig && previous.revision === contextRevision && previous.identityKey === identityKey ? previous : undefined);
  }, [homeDrafts, homeDraftsOwned, verifiedConfig, contextRevision, identityKey]);
  const [botAppsReturn,setBotAppsReturn]=useState<{context:typeof desktopClient.config;revision:number;identityKey:string}|null>(null);
  const [activeView, setActiveView] = useState<CustomerView>("agent");
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [splitWorkspace, setSplitWorkspace] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [releaseIntakeOpen, setReleaseIntakeOpen] = useState(false);
  const [releaseEntry, setReleaseEntry] = useState<{
    release?: SavedReleaseLink;
    origin?: "home" | "agent" | "airflow-automation";
    section?: "evidence" | "review";
    config: typeof desktopClient.config;
    revision: number;
    identityKey: string;
  }>();
  const [batchEntry, setBatchEntry] = useState<{
    release: SavedReleaseLink;
    config: typeof desktopClient.config;
    revision: number;
    identityKey: string;
  }>();
  const [returnActivity, setReturnActivity] = useState<typeof releaseEntry>();
  const [pendingReleaseNavigation, setPendingReleaseNavigation] = useState<{
    view: CustomerView;
    planner?: AgentDraftRequest;
    planRelease?: SavedReleaseLink;
    config: typeof desktopClient.config;
    revision: number;
    identityKey: string;
  } | null>(null);
  const [booted, setBooted] = useState(false);
  const settingsReturnView = useRef<CustomerView>("agent");
  const settingsReturnHome = useRef(false);
  const [botVisited, setBotVisited] = useState(false);
  const [docsVisited, setDocsVisited] = useState(false);
  const [repositoryVisited, setRepositoryVisited] = useState(false);
  const [localEditorVisited, setLocalEditorVisited] = useState(false);
  const [localEditorOwner, setLocalEditorOwner] = useState<{
    config: typeof desktopClient.config;
    revision: number;
    identityKey: string;
  }>();
  const [agentVisited, setAgentVisited] = useState(false);
  const [requestedSkill, setRequestedSkill] = useState<AgentSkillRequest>();
  const [requestedAirflow, setRequestedAirflow] = useState<AgentAirflowRequest>();
  const [requestedLocalCode, setRequestedLocalCode] = useState<AgentLocalCodeRequest>();
  const [editRequest, setEditRequest] = useState<LocalEditRequest>();
  const [settingsDestination, setSettingsDestination] = useState<AgentSettingsDestination | undefined>();
  const performNavigate = useCallback((view: CustomerView, planner?: AgentDraftRequest, planRelease?: SavedReleaseLink) => {
    if (planner) setPlannerRequest(planner);
    setTicketPlanReturn(undefined);
    if (planRelease) setAgentPlan({release: planRelease, config: verifiedConfig, revision: contextRevision, identityKey});
    else if (planner) setAgentPlan(undefined);
    if (view === "settings" && activeView !== "settings") {
      settingsReturnView.current = activeView;
      settingsReturnHome.current = welcomeVisible;
    }
    setReleaseEntry(undefined);
    setBatchEntry(undefined);
    setBotAppsReturn(null);
    setWelcomeVisible(false);
    if (view === "agent" || view === "repository-workspace") {
      setSplitWorkspace(false);
      setAgentVisited(true);
      setRepositoryVisited(true);
    }
    if (view === "axiom-bot") setBotVisited(true);
    if (view === "docs") setDocsVisited(true);
    setSettingsDestination(undefined);
    setActiveView(view);
  }, [activeView, welcomeVisible, verifiedConfig, contextRevision, identityKey]);
  const navigate = useCallback((view: CustomerView, planner?: AgentDraftRequest, planRelease?: SavedReleaseLink) => {
    if (activeView === "deployment-requests" && releaseIntakeOpen && view !== activeView) {
      if (verifiedConfig !== desktopClient.config || contextRevision !== desktopClient.getContextRevision()) return;
      setPendingReleaseNavigation(current => current ?? { view, planner, planRelease, config: verifiedConfig, revision: contextRevision, identityKey });
      setCommandsOpen(false);
      return;
    }
    setPendingReleaseNavigation(null);
    performNavigate(view, planner, planRelease);
  }, [activeView, releaseIntakeOpen, verifiedConfig, contextRevision, identityKey, performNavigate]);
  const ownsReleaseNavigation = releaseIntakeOpen && activeView === "deployment-requests"
    && pendingReleaseNavigation?.config === desktopClient.config
    && pendingReleaseNavigation.revision === contextRevision
    && pendingReleaseNavigation.identityKey === identityKey;
  useEffect(() => {
    if (pendingReleaseNavigation && !ownsReleaseNavigation) setPendingReleaseNavigation(null);
  }, [pendingReleaseNavigation, ownsReleaseNavigation]);
  const ownsReleaseEntry = releaseEntry?.config === verifiedConfig && verifiedConfig === desktopClient.config
    && releaseEntry.revision === contextRevision && releaseEntry.identityKey === identityKey;
  const activeReleaseEntry = ownsReleaseEntry && !welcomeVisible ? releaseEntry : undefined;
  const ticketsActive = !welcomeVisible && activeView === "tickets";
  const ownsTicketPlanReturn = !welcomeVisible && activeView === "agent" && ticketPlanReturn?.context === desktopClient.config
    && ticketPlanReturn.revision === contextRevision && ticketPlanReturn.identityKey === identityKey;
  const batchesActive = !welcomeVisible && activeView === "airflow-automation";
  const canReadReleaseBatches = identity.kind === "desktop_session" && identity.capabilities.includes("workspace:read")
    && identity.capabilities.includes("pipeline:read");
  const batchRelease = batchesActive && canReadReleaseBatches && batchEntry?.config === verifiedConfig
    && verifiedConfig === desktopClient.config && batchEntry.revision === contextRevision && batchEntry.identityKey === identityKey
    ? batchEntry.release : undefined;
  const keepBatchesForRelease = activeView === "deployment-requests" && activeReleaseEntry?.origin === "airflow-automation";
  useEffect(() => {
    if (releaseEntry && (!ownsReleaseEntry || (!releaseEntry.release && !releaseIntakeOpen))) setReleaseEntry(undefined);
  }, [releaseEntry, ownsReleaseEntry, releaseIntakeOpen]);

  function updateHomeDraft(intent: HomePlanningIntent, draft: string) {
    if (!welcomeVisible || verifiedConfig !== desktopClient.config || contextRevision !== desktopClient.getContextRevision()) return;
    setHomeDrafts(current => ({
      config: verifiedConfig, revision: contextRevision, identityKey,
      drafts: { ...(current?.config === verifiedConfig && current?.revision === contextRevision && current?.identityKey === identityKey ? current.drafts : {}), [intent]: draft },
    }));
  }

  function offerAgentDraft(text: string) {
    if (verifiedConfig !== desktopClient.config || contextRevision !== desktopClient.getContextRevision()) return;
    navigate("agent", { context: verifiedConfig, revision: contextRevision, identityKey, text });
  }

  function closeAgentPlan() {
    setAgentPlan(undefined);
    const composer = agentConversation.current?.querySelector<HTMLTextAreaElement>(
      'textarea[data-help-id="agent.workspace.request"]:enabled',
    );
    composer?.focus();
    if (document.activeElement !== composer) content.current?.focus({preventScroll: true});
  }

  function reviewPlan(intent: HomePlanningIntent, draft: string, context?: HomePlanningContext) {
    const text = agentDraftText(intent, draft, context);
    if (text && welcomeVisible) offerAgentDraft(text);
  }

  function selectSavedRelease(release: SavedReleaseLink, origin?: "home" | "agent" | "airflow-automation", section?: "evidence" | "review") {
    if (verifiedConfig !== desktopClient.config || contextRevision !== desktopClient.getContextRevision()) return;
    navigate("deployment-requests");
    setReleaseEntry({
      release: activeView === "deployment-requests" && releaseIntakeOpen ? undefined : release,
      origin,
      section,
      config: verifiedConfig,
      revision: contextRevision,
      identityKey,
    });
  }

  function inspectReleaseBatches(release: SavedReleaseLink) {
    if (!canReadReleaseBatches || activeView !== "deployment-requests" || welcomeVisible || releaseIntakeOpen
      || verifiedConfig !== desktopClient.config || contextRevision !== desktopClient.getContextRevision()) return;
    navigate("airflow-automation");
    setBatchEntry({release, config: verifiedConfig, revision: contextRevision, identityKey});
  }

  function openSavedRelease(release: SavedReleaseLink) {
    if (welcomeVisible) selectSavedRelease(release, "home");
  }
  function returnToReleaseOrigin() {
    if (!activeReleaseEntry?.release || !activeReleaseEntry.origin ||
      activeReleaseEntry.revision !== desktopClient.getContextRevision() || verifiedConfig !== desktopClient.config) return;
    if (activeReleaseEntry.origin !== "home") {
      navigate(activeReleaseEntry.origin);
      return;
    }
    setReturnActivity(activeReleaseEntry);
    setReleaseEntry(undefined);
    setBotAppsReturn(null);
    setWelcomeVisible(true);
  }
  const canReadAgentPlans = identity.kind === "desktop_session" && identity.capabilities.includes("github:read");
  const ownsAgentPlan = canReadAgentPlans && agentPlan?.config === verifiedConfig && verifiedConfig === desktopClient.config
    && agentPlan.revision === contextRevision && agentPlan.identityKey === identityKey;
  useEffect(() => {
    if (agentPlan && !ownsAgentPlan) setAgentPlan(undefined);
  }, [agentPlan, ownsAgentPlan]);

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
  const agentPlanActive = !welcomeVisible && !splitVisible && activeView === "agent";
  const repositoryActive = !welcomeVisible && activeView === "repository-workspace";
  const docsActive = !welcomeVisible && activeView === "docs";
  const localEditorVisible = splitVisible || (
    localEditorOwner?.config === verifiedConfig && localEditorOwner.revision === contextRevision
    && localEditorOwner.identityKey === identityKey
  );
  function openLocalEditor() {
    if (verifiedConfig !== desktopClient.config || contextRevision !== desktopClient.getContextRevision()) return;
    setLocalEditorVisited(true);
    setLocalEditorOwner({config: verifiedConfig, revision: contextRevision, identityKey});
  }

  function stayInIntake() {
    releaseDialogReturn.current = "intake";
    setPendingReleaseNavigation(null);
    setWelcomeVisible(false);
  }

  if (!booted) return <BootScreen status="Loading engineering workspace" />;

  return (
    <div className="flex h-screen bg-axiom-bg text-white overflow-hidden">
      <a href="#studio-workspace-content" className="sr-only studio-skip-link" onClick={event => {
        if (!content.current) return;
        event.preventDefault();
        content.current.focus();
      }}>Skip to workspace content</a>
      <Sidebar identity={identity} compact={false} activeView={activeView} onNavigate={navigate} homeVisible={welcomeVisible} onOpenWelcome={() => {setReleaseEntry(undefined);setReturnActivity(undefined);setBotAppsReturn(null);setWelcomeVisible(true)}} />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar onOpenHelp={() => navigate("docs")} welcome={welcomeVisible} splitActive={splitVisible} onToggleSplit={workspaceVisible ? () => {setRepositoryVisited(true); setLocalEditorVisited(true); setSplitWorkspace(value => !value);} : undefined} activeView={activeView} identity={identity} onOpenCommands={() => setCommandsOpen(true)} />
        <main id="studio-workspace-content" ref={content} tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col focus:outline-hidden">
        <div hidden={!welcomeVisible} className={welcomeVisible ? "flex min-h-0 flex-1 flex-col" : "hidden"}><WelcomeView active={welcomeVisible} returnActivity={returnActivity?.config === verifiedConfig && returnActivity.revision === contextRevision && returnActivity.identityKey === identityKey ? returnActivity.release : undefined} key={JSON.stringify([contextRevision, identityKey])} displayName={identity.displayName} releaseConfig={verifiedConfig} releaseOwner={JSON.stringify([contextRevision, identityKey])} contextAccess={identity.kind === "desktop_session" && identity.capabilities.includes("pipeline:read") ? {repositories: identity.capabilities.includes("github:read")} : undefined} plannerDrafts={homeDraftsOwned ? homeDrafts.drafts : undefined} onEditPlannerDraft={updateHomeDraft} onReviewPlan={reviewPlan} onOpenSavedRelease={openSavedRelease} onBot={() => navigate("axiom-bot")} onBuild={() => navigate("agent")} onAutomate={() => navigate("airflow-automation")} onDeploy={() => navigate("deployment-requests")} /></div>
        <div hidden={!workspaceVisible} style={{display: workspaceVisible ? "flex" : "none"}} className={`engineering-panes min-h-0 flex-1 ${splitVisible ? "engineering-panes-split" : "flex-col"}`}>
        <div hidden={!splitVisible && activeView !== "agent"} style={{ display: splitVisible || activeView === "agent" ? "flex" : "none" }} className={`min-h-0 min-w-0 flex-1 flex-col ${splitVisible ? "engineering-agent-pane" : ""}${ownsAgentPlan && agentPlanActive ? " studio-agent-plan-pane" : ""}`}>
          {agentVisited && <WorkspaceViewBoundary onReturnToAgent={() => navigate("agent")}>
            {ownsTicketPlanReturn && <div className="shrink-0 px-4 py-2">
              <button type="button" className="btn-secondary" onClick={() => navigate("tickets")}>Return to Tickets</button>
            </div>}
            {ownsAgentPlan && agentPlanActive && <header className="studio-agent-plan-heading"><h1>Agent</h1><p>A focused workspace for planning and reviewing changes.</p></header>}
            <div className={`studio-agent-plan-layout${ownsAgentPlan && agentPlanActive ? " studio-agent-plan-layout-selected" : ""}`}>
              <div ref={agentConversation} className="studio-agent-plan-chat"><AgentChatView deferNewConversation={ownsAgentPlan} requestedDraft={plannerRequest} onDraftLoaded={loaded => setPlannerRequest(current => current === loaded ? undefined : current)} compact={splitVisible} requestedAirflow={requestedAirflow} onReviewLocalEdit={(edit, edits) => { openLocalEditor(); setEditRequest({edit, edits, context: desktopClient.config, workspace: identity.organizationId}); setRepositoryVisited(true); navigate("repository-workspace"); }} requestedLocalCode={requestedLocalCode} requestedSkill={requestedSkill} active={!welcomeVisible && (splitVisible || activeView === "agent")} identity={identity} onOpenSettings={(destination) => { settingsReturnView.current = "agent"; settingsReturnHome.current = false; setSettingsDestination(destination); setActiveView("settings"); }} /></div>
              {ownsAgentPlan && agentPlan && <AgentPlanContextView key={JSON.stringify([agentPlan.release, contextRevision, identityKey])}
                active={agentPlanActive} release={agentPlan.release} workspaceId={identity.organizationId} ownerConfig={agentPlan.config} revision={agentPlan.revision}
                onReturn={section => selectSavedRelease(agentPlan.release, "agent", section)} onClose={closeAgentPlan} />}
            </div>
          </WorkspaceViewBoundary>}
        </div>
        {repositoryVisited && <div hidden={!splitVisible && activeView !== "repository-workspace"} style={{ display: splitVisible || activeView === "repository-workspace" ? "flex" : "none" }} className={`min-h-0 min-w-0 flex-1 flex-col ${splitVisible ? "engineering-editor-pane" : ""}`}>
          <WorkspaceViewBoundary onReturnToAgent={() => navigate("agent")}>
            <div hidden={localEditorVisible} className={localEditorVisible ? "hidden" : "flex min-h-0 flex-1 flex-col"}>
              <RepositoryDirectoryView key={JSON.stringify([contextRevision, identityKey])}
                active={repositoryActive && !localEditorVisible}
                canRead={identity.kind === "desktop_session" && identity.capabilities.includes("pipeline:read")}
                onOpenLocal={openLocalEditor}
                onConnect={identity.kind === "desktop_session" && (identity.role === "owner" || identity.role === "admin") && identity.capabilities.includes("connections:manage")
                  ? () => { navigate("settings"); setSettingsDestination("integrations"); } : undefined}/>
            </div>
            <div hidden={!localEditorVisible} className={localEditorVisible ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
              {!splitVisible && <div className="shrink-0 px-4 py-2"><button type="button" className="btn-secondary" onClick={() => {setLocalEditorOwner(undefined);setEditRequest(undefined);}}>Back to repository directory</button></div>}
              {localEditorVisited && <RepositoryWorkspaceView selectionUser={identity.kind === "desktop_session" ? identity.email : undefined} compact={splitVisible} editRequest={editRequest} workspace={identity.organizationId} active={localEditorVisible && (splitVisible || repositoryActive)} onAskAgent={selection => { setRequestedLocalCode({ ...selection, context: desktopClient.config, workspace: identity.organizationId }); navigate("agent"); }} />}
            </div>
          </WorkspaceViewBoundary>
        </div>}
        </div>
        {botVisited && <div hidden={welcomeVisible || activeView !== "axiom-bot"} style={{display: !welcomeVisible && activeView === "axiom-bot" ? "flex" : "none"}} className="min-h-0 flex-1 flex-col">
          <WorkspaceViewBoundary onReturnToAgent={() => navigate("agent")}>
            <AxiomBotView onConnectApps={openBotApps} identity={identity} active={!welcomeVisible && activeView === "axiom-bot"} />
          </WorkspaceViewBoundary>
        </div>}
        {docsVisited && <div hidden={!docsActive} className={docsActive ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <WorkspaceViewBoundary key={JSON.stringify([identityKey, contextRevision])} onReturnToAgent={() => navigate("agent")}>
            <DocsView active={docsActive} onNavigate={view => { if (view === "repository-workspace") openLocalEditor(); navigate(view); }} onAskAboutPage={offerAgentDraft} />
          </WorkspaceViewBoundary>
        </div>}
        {(activeView === "tickets" || ownsTicketPlanReturn) && <div hidden={!ticketsActive} className={ticketsActive ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <WorkspaceViewBoundary key={JSON.stringify([identityKey, contextRevision])} onReturnToAgent={() => navigate("agent")}>
            <TicketsDirectoryView active={ticketsActive} identity={identity} revision={contextRevision}
              onOpenReleases={() => navigate("deployment-requests")}
              onOpenSavedDraft={release => {if (ticketsActive) selectSavedRelease(release);}}
              onPrepareRemediation={(incident, release) => {
                if (!ticketsActive || desktopClient.config !== verifiedConfig || desktopClient.getContextRevision() !== contextRevision) return;
                const text = [
                  "Draft a remediation plan for review. Separate recorded facts from hypotheses, and identify the required evidence, approvals, validation and recovery. Keep the plan read-only.",
                  `Incident: ${JSON.stringify(incident.id)} · ${incident.severity} · ${incident.status}`,
                  `Linked release record: ${JSON.stringify(release.id)} · ${release.status}`,
                  `Recorded tag: ${release.tag ? JSON.stringify(release.tag) : "unavailable"}`,
                  `Recorded commit: ${release.commit ?? "unavailable"}`,
                ].join("\n\n");
                const owner = {context: verifiedConfig, revision: contextRevision, identityKey};
                navigate("agent", {text, ...owner});
                setTicketPlanReturn(owner);
              }} />
          </WorkspaceViewBoundary>
        </div>}
        {(activeView === "airflow-automation" || keepBatchesForRelease) && <div hidden={!batchesActive} className={batchesActive ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <WorkspaceViewBoundary key={JSON.stringify([identityKey, contextRevision])} onReturnToAgent={() => navigate("agent")}>
            <BatchesWorkspaceView active={batchesActive} ownerConfig={verifiedConfig} revision={contextRevision} requestedRelease={batchRelease}
              canRead={identity.kind === "desktop_session" && identity.capabilities.includes("workspace:read")}
              canCheckReadiness={identity.capabilities.includes("pipeline:read")}
              onOpenRelease={(release, section) => {if (batchesActive) selectSavedRelease(release, "airflow-automation", section);}}
              onInspect={(dagId, runId) => { setRequestedAirflow({dagId, runId, context: desktopClient.config, workspace: identity.organizationId}); navigate("agent"); }} />
          </WorkspaceViewBoundary>
        </div>}
        {activeView !== "agent" && activeView !== "repository-workspace" && activeView !== "axiom-bot" && activeView !== "docs" && activeView !== "tickets" && activeView !== "airflow-automation" && <div hidden={welcomeVisible} style={{display: welcomeVisible ? "none" : "flex"}} className="flex min-h-0 flex-1 flex-col"><WorkspaceViewBoundary key={activeView} onReturnToAgent={() => navigate("agent")}>
          {activeView === "deployment-requests" && <DeploymentRequestsView key={identityKey} active={!welcomeVisible && !ownsReleaseNavigation} onIntakeOpenChange={setReleaseIntakeOpen} onInspectReleaseBatches={canReadReleaseBatches ? inspectReleaseBatches : undefined} savedRelease={activeReleaseEntry?.release} savedReleaseSection={activeReleaseEntry?.section} onRecoverSavedRelease={activeReleaseEntry?.origin ? {
            label: {home: "Return to Home activity", agent: "Return to Agent", "airflow-automation": "Return to Batches"}[activeReleaseEntry.origin],
            run: returnToReleaseOrigin,
            returnWhenAvailable: true,
          } : undefined} activityWorkspace={!welcomeVisible && verifiedConfig === desktopClient.config && canReadAgentPlans ? identity.organizationId : undefined} resumeIntake={Boolean(activeReleaseEntry && !activeReleaseEntry.release && releaseIntakeOpen)} onReviewAgentPlans={canReadAgentPlans ? release => {
            if (!welcomeVisible && activeView === "deployment-requests" && verifiedConfig === desktopClient.config && contextRevision === desktopClient.getContextRevision()) navigate("agent", undefined, release);
          } : undefined} />}
          {activeView === "plugins-skills" && <PluginsSkillsView key={botAppsOwned?"bot-apps":"catalogue"} initialFilter={botAppsOwned?"plugins":"all"} onReturnToBot={botAppsOwned?()=>{if(botAppsReturn?.context===desktopClient.config&&botAppsReturn.revision===desktopClient.getContextRevision()&&botAppsReturn.identityKey===JSON.stringify(identity))navigate("axiom-bot")}:undefined} onUseSkill={skillId => { setRequestedSkill({ skillId, context: desktopClient.config, workspace: identity.organizationId }); navigate("agent"); }} canManage={identity.role === "owner" || identity.role === "admin"} onOpenSettings={() => { const origin=botAppsOwned?botAppsReturn:null; navigate("settings"); if(origin)setBotAppsReturn(origin); setSettingsDestination("integrations"); }} onOpenAirflow={() => navigate("airflow-automation")} />}
          {activeView === "settings" && <SettingsView onSignOut={onSignOut} onOpenRepository={() => { openLocalEditor(); navigate("repository-workspace"); }} identity={identity} initialSection={settingsDestination} onClose={() => { setActiveView(settingsReturnView.current); setWelcomeVisible(settingsReturnHome.current); }} />}
        </WorkspaceViewBoundary></div>}
        </main>
      </div>
      {ownsReleaseNavigation ? (
        <DesktopDialog label="Leave this release intake?" onClose={stayInIntake} restoreFocus={() => {
          const destination = releaseDialogReturn.current;
          releaseDialogReturn.current = undefined;
          if (!destination || !content.current) return false;
          const intake = destination === "intake" ? Array.from(content.current.querySelectorAll<HTMLElement>("[data-release-intake-focus]"))
            .find(heading => !heading.closest("[hidden]")) : undefined;
          (intake ?? content.current).focus();
          return true;
        }}>
          <h2 className="text-base font-medium">Leave this release intake?</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">Leaving discards unsaved intake fields. An action you already requested may still finish.</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={stayInIntake}>Stay in intake</button>
            <button type="button" className="btn-primary" onClick={() => {
              if (pendingReleaseNavigation.config !== desktopClient.config
                || pendingReleaseNavigation.revision !== desktopClient.getContextRevision()
                || pendingReleaseNavigation.identityKey !== identityKey) return;
              releaseDialogReturn.current = "workspace";
              setPendingReleaseNavigation(null);
              setReleaseIntakeOpen(false);
              performNavigate(pendingReleaseNavigation.view, pendingReleaseNavigation.planner, pendingReleaseNavigation.planRelease);
            }}>Leave without saving</button>
          </div>
        </DesktopDialog>
      ) : <WorkspaceCommands open={commandsOpen} onOpenChange={setCommandsOpen} onNavigate={navigate} />}
    </div>
  );
}

function BootScreen({ status }: { status: string }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-axiom-bg text-white relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center">
        <img src="/brand/v19-mark.svg" alt="" className="h-10 w-10 shrink-0 object-contain" />
        <p className="mt-6 text-base font-semibold tracking-tight text-white">{DESKTOP_PRODUCT_NAME}</p>
        <p className="mt-2 text-[10px] font-mono text-zinc-500 tracking-[0.22em] uppercase">{status}</p>
        <div className="mt-6 w-48 h-[2px] bg-zinc-800/70 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-zinc-200 animate-[boot-bar_1s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`@keyframes boot-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
}

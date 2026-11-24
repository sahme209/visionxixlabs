import {OutlookIntegrationCard} from '../components/OutlookIntegrationCard';
import {SlackNotificationPanel} from '../components/SlackNotificationPanel';
import {ConnectedActionsPanel} from '../components/ConnectedActionsPanel';
import {SlackConnectionManager} from "../components/SlackConnectionManager";
import type {GithubReconnectChallenge} from "../../../lib/desktop/githubInstallationReconnectContract";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Check, CircleCheck, LockKeyhole, Plus, RefreshCw, Search, Settings, X } from "lucide-react";
import { z } from "zod";
import { ProviderLogo, SkillIcon } from "../components/CatalogIcon";
import { DesktopMcpTools } from "../components/DesktopMcpTools";
import { DesktopDialog } from "../components/DesktopDialog";
import "./PluginsSkillsView.css";
import { ViewShell } from "../components/Primitives";
import { desktopClient, type AgentSkillCatalogItem, type DesktopIntegrationStatus } from "../lib/desktopClient";
import { useSearchShortcut } from "../lib/useSearchShortcut";

type Filter = "all" | "skills" | "plugins" | "installed" | "enabled" | "disabled" | "mcp";
const PROVIDERS = [
  { id: "github", name: "GitHub", category: "Source control", detail: "Repository-scoped reading, branches, commits, pull requests, and workflow dispatch." },
  { id: "slack", name: "Slack", category: "Collaboration", detail: "Governed release notifications using explicitly consented workspace access." },
  { id: "teams", name: "Microsoft Teams", category: "Collaboration", detail: "Verified Microsoft workspace identity; message authority remains separately gated." },
  { id: "linear", name: "Linear", category: "Work management", detail: "Issue context and governed follow-up using read and issues:create scopes." },
  { id: "aws", name: "AWS ECS", category: "Cloud delivery", detail: "Read-only AWS account access and EC2 metadata. ECS deployment requires a separately configured workflow, deployment role, cluster and service." },
  { id: "azure", name: "Microsoft Azure", category: "Cloud delivery", detail: "Workspace-scoped Azure connection setup and inventory; deployment authority and approvals remain separate." },
  { id: "gcp", name: "Google Cloud", category: "Cloud delivery", detail: "Workspace-scoped Google Cloud connection setup and inventory; deployment authority and approvals remain separate." },
  { id: "airflow", name: "Apache Airflow", category: "Batch automation", detail: "Live DAG monitoring, scheduled runs, dependencies, approvals, retries, audit evidence, and governed follow-up actions." },
] as const;

const inspectorTabs = ["Overview", "Permissions", "Activity"] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];
const skillStatusLabels: Record<AgentSkillCatalogItem["status"], string> = {
  enabled: "Enabled", disabled: "Disabled", not_installed: "Not installed",
};

const recordedTimestamp = z.iso.datetime();
function recordedTime(value: string | null | undefined) {
  const timestamp = recordedTimestamp.safeParse(value);
  return timestamp.success ? <time dateTime={timestamp.data}>{new Date(timestamp.data).toLocaleString()}</time> : null;
}

function isRecordedGitHubInstallation(state: string) {
  return ["active", "installation_recorded", "validated_read_only", "validation_overdue"].includes(state);
}

type BrowserProvider = "github" | "slack" | "teams" | "linear";
const TRUSTED_CONSENT_HOSTS: Record<BrowserProvider, readonly string[]> = {
  github: ["github.com"], slack: ["slack.com"], teams: ["login.microsoftonline.com"], linear: ["linear.app"],
};

interface PluginsSkillsProps { initialFilter?:"all"|"plugins";onReturnToBot?:()=>void;onOpenSettings: () => void; onOpenAirflow: () => void; canManage?: boolean; onUseSkill?: (skillId: string) => void }
export function PluginsSkillsView(props: PluginsSkillsProps) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  return <PluginsSkillsSession key={revision} {...props} revision={revision} />;
}
function PluginsSkillsSession({ initialFilter="all",onReturnToBot,onOpenSettings, onOpenAirflow, onUseSkill, canManage = false, revision }: PluginsSkillsProps & { revision: number }) {
  const validationRecovery=useSyncExternalStore(desktopClient.subscribeIntegrationValidationRecovery??(()=>()=>{}),desktopClient.integrationValidationRecoverySnapshot??(()=>''),()=> '');
  const [skills, setSkills] = useState<AgentSkillCatalogItem[] | null>(null);
  const [integrations, setIntegrations] = useState<DesktopIntegrationStatus | null>(null);
  const [airflow, setAirflow] = useState<{ status: string; recordedValidation?: string | null }>();
  const [slackManager,setSlackManager]=useState(false);
  const [outlookManager,setOutlookManager]=useState(false);
  const [actionManager,setActionManager]=useState<'teams'|'linear'>();
  const [slackReviews,setSlackReviews]=useState(false);
  const [githubChallenge,setGithubChallenge]=useState<GithubReconnectChallenge>();
  const [githubHold,setGithubHold]=useState(()=>desktopClient.githubReconnectNeedsReload?.()??false);
  const reconnectFlight=useRef<AbortController|null>(null);
  const [query, setQuery] = useState("");
  const [inspected, setInspected] = useState<{kind: "app" | "skill"; id: string}>();
  const refreshCapabilitiesButton = useRef<HTMLButtonElement>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const inspectorOpener = useRef<HTMLButtonElement>(null);
  const inspectorTabsId = useId();
  const [inspectorTab, setInspectorTab] = useState<(typeof inspectorTabs)[number]>("Overview");
  const [inspectorNotice, setInspectorNotice] = useState<{message: string; verified: boolean} | null>();
  function inspect(kind: "app" | "skill", id: string, opener: HTMLButtonElement) {
    inspectorOpener.current = opener;
    setInspectorNotice(undefined);
    setInspectorTab("Overview");
    setInspected({kind, id});
  }
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [catalogIssue, setCatalogIssue] = useState<string | null>(null);
  const [integrationIssue, setIntegrationIssue] = useState<string | null>(null);
  const [skillChangesAvailable, setSkillChangesAvailable] = useState(false);
  const [context] = useState(() => desktopClient.config);
  const mounted = useRef(false), loadRequest = useRef(0), mutation = useRef(false);
  const owns = useCallback(() => mounted.current && desktopClient.config === context && desktopClient.getContextRevision() === revision, [context, revision]);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    const current = () => owns() && request === loadRequest.current;
    const loadSkills = async () => {
      const result = await Promise.resolve().then(() => desktopClient.listAgentSkills()).catch(() => null);
      if (!current() || mutation.current) return;
      if (result?.ok) {
        setSkills(result.data.skills); setSkillChangesAvailable(result.data.storageAvailable !== false);
        setCatalogIssue(result.data.storageAvailable === false
          ? "Skill installation storage is unavailable. Installation state is unknown." : null);
      } else {
        setSkills([]); setSkillChangesAvailable(false);
        setCatalogIssue("Skills could not be loaded right now. Your existing Agent permissions and integrations are unchanged.");
      }
    };
    const loadIntegrations = async () => {
      const result = await Promise.resolve().then(() => desktopClient.integrationStatus()).catch(() => null);
      if (!current()) return;
      setIntegrations(result?.ok ? result.data : null);
      setIntegrationIssue(result?.ok ? null : "Integration status is unavailable. Existing connections are unchanged; retry to verify them.");
    };
    const loadAirflow = async () => {
      const result = await Promise.resolve().then(() => desktopClient.airflowConnection()).catch(() => null);
      if (!current()) return;
      if (!result?.ok) {
        setAirflow({status: "unavailable"});
        return;
      }
      const {connected, status, lastValidatedAt} = result.data;
      setAirflow({
        status,
        recordedValidation: connected && (status === "active" || status === "connected") ? lastValidatedAt ?? null : undefined,
      });
    };
    await Promise.allSettled([loadSkills(), loadIntegrations(), loadAirflow()]);
  }, [owns]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => { reconnectFlight.current?.abort(); mounted.current = false; window.removeEventListener("focus", refresh); };
  }, [load]);

  async function updateSkill(skill: AgentSkillCatalogItem, action: "install" | "enable" | "disable" | "remove") {
    if (!owns() || !canManage || !skillChangesAvailable || mutation.current) return;
    mutation.current = true; setWorking(skill.id); setNotice(null); setSkillChangesAvailable(false);
    let confirmed = false;
    try {
      const result = await desktopClient.updateAgentSkill(skill.id, action);
      if (!owns()) return;
      if (!result.ok && result.error === "skill_state_changed") {
        setCatalogIssue("Skill state changed. Refresh capabilities before choosing another action.");
        refreshCapabilitiesButton.current?.focus();
        return;
      }
      if (!result.ok) throw new Error("skill_update_failed");
      confirmed = true;
      setNotice(`${skill.name} is now ${result.data.status.replaceAll("_", " ")}. Agent workflow guidance updates on the next message.`);
    } catch {
      if (owns()) setNotice(`Could not update ${skill.name}. The outcome is unverified. Refresh capabilities before deciding whether to retry.`);
    } finally { if (owns()) { loadRequest.current++; mutation.current = false; setWorking(null); if (confirmed) void load(); } }
  }

  async function connectProvider(provider: BrowserProvider) {
    if (!owns() || !canManage || mutation.current || !integrations || integrationIssue || integrations.configuration?.[provider] === false) return;
    mutation.current = true; setWorking(`provider:${provider}`); setNotice(null);
    try {
      const result = await desktopClient.startIntegrationConnection(provider);
      if (!owns()) return;
      if (!result.ok) throw new Error("consent_unavailable");
      const destination = new URL(result.data.consentUrl);
      if (destination.protocol !== "https:" || destination.username || destination.password || destination.port || !TRUSTED_CONSENT_HOSTS[provider].includes(destination.hostname)) throw new Error("untrusted consent destination");
      await open(destination.toString());
      if (owns()) setNotice("Secure provider consent opened in your browser. Return here when finished.");
    } catch {
      if (owns()) setNotice(`The ${PROVIDERS.find((item) => item.id === provider)?.name ?? provider} connection could not be opened. Ask a workspace administrator to verify the provider setup, then try again.`);
    } finally { if (owns()) { mutation.current = false; setWorking(null); } }
  }

  async function reconnectGitHub(confirm=false){
    if(!owns()||!canManage||mutation.current||githubHold||integrations?.github.status!=='revoked'||confirm&&(!githubChallenge||Date.parse(githubChallenge.expiresAt)<=Date.now()))return;
    const c=new AbortController();reconnectFlight.current=c;mutation.current=true;setWorking('provider:github');setNotice(null);
    try{if(confirm){setGithubChallenge(undefined);setGithubHold(true);const r=await desktopClient.confirmExistingGitHubConnection(githubChallenge!.challengeId,c.signal);if(!owns()||c.signal.aborted)return;if(r.ok){setNotice('The verified GitHub installation is reconnected. Reload GitHub status to confirm current access.')}else setNotice('Reconnect outcome is unconfirmed. Reload GitHub status before another action.');}
    else{setGithubChallenge(undefined);const r=await desktopClient.verifyExistingGitHubConnection(c.signal);if(!owns()||c.signal.aborted)return;if(r.ok)setGithubChallenge(r.data);else setNotice('Existing installation could not be verified. Review GitHub consent or use Connect in your browser.');}}
    catch{if(owns())setNotice(confirm?'Reconnect outcome is unconfirmed. Reload GitHub status before another action.':'Existing installation could not be verified. Review GitHub consent.');}
    finally{if(reconnectFlight.current===c)reconnectFlight.current=null;if(owns()){mutation.current=false;setWorking(null)}}
  }
  async function reloadGitHub(){if(!owns()||mutation.current)return;mutation.current=true;setWorking('provider:github');setGithubChallenge(undefined);try{const r=await desktopClient.reloadGitHubReconnectStatus();if(!owns())return;if(r.ok){setIntegrations(r.data);setGithubHold(false);setNotice('GitHub status reloaded.')}else setNotice('GitHub status could not be confirmed. Reload status before another action.')}catch{if(owns())setNotice('GitHub status could not be confirmed. Reload status before another action.')}finally{if(owns()){mutation.current=false;setWorking(null)}}}

  async function validateProvider(provider: BrowserProvider, report: (message: string | null, verified?: boolean) => void = setNotice) {
    if (!owns() || !canManage || mutation.current || validationRecovery.split(',').includes(provider)) return;
    mutation.current = true; setWorking(`provider:${provider}`); report(null);
    try {
      const result = provider === "github" ? await desktopClient.validateGitHubReadOnly()
        : provider === "slack" ? await desktopClient.validateSlackConnection()
        : provider === "teams" ? await desktopClient.validateTeamsConnection() : await desktopClient.validateLinearConnection();
      if (!owns()) return;
      if (!result.ok) {if(provider==='slack'||provider==='teams'){if('outcomeUnconfirmed' in result&&result.outcomeUnconfirmed){desktopClient.recordIntegrationValidationUnknown?.(provider);report('Validation outcome is unconfirmed. Reload status and review consent before further validation.')}else report('Validation could not be completed. Reload status and review the provider consent.');return}throw new Error("validation_failed")}
      if (provider === "github") report("GitHub read access is verified for this workspace.", true);
      else if (provider === "teams") report("Microsoft identity is verified for this workspace. Teams message permissions remain separately controlled.");
      else report(`${PROVIDERS.find(item => item.id === provider)?.name ?? provider} access is verified for this workspace.`);
      void load();
    } catch {
      if (owns()) {if(provider==='slack'||provider==='teams'){desktopClient.recordIntegrationValidationUnknown?.(provider);report('Validation outcome is unconfirmed. Reload status and review consent before further validation.')}else report(`The ${PROVIDERS.find((item) => item.id === provider)?.name ?? provider} connection could not be verified. Review its consent in Connection settings and try again.`)}
    } finally { if (owns()) { mutation.current = false; setWorking(null); } }
  }

  const providerState = (provider: ProviderId) => {
    if (provider === "airflow") return airflow?.status ?? "checking";
    if (!integrations) return integrationIssue ? "unavailable" : "checking";
    if (provider === "github") return integrations.github.status;
    if (provider === "aws" || provider === "azure" || provider === "gcp") return integrations.cloud.find((item) => item.provider === provider)?.status ?? "not_connected";
    return integrations.collaboration.find((item) => item.provider === provider)?.status ?? "not_connected";
  };
  function providerEvidence(id: ProviderId, state: string) {
    if (id === "airflow") return {
      recordedCheck: airflow?.recordedValidation === undefined ? undefined : recordedTime(airflow.recordedValidation),
    };
    if (!integrations) return {};
    if (id === "github") {
      const {repositorySelection, lastSeenAt} = integrations.github;
      const recordedInstallation = isRecordedGitHubInstallation(state);
      return {
        repositoryAccess: recordedInstallation && repositorySelection === "all" ? "All repositories"
          : recordedInstallation && repositorySelection === "selected" ? "Selected repositories" : undefined,
        recordedCheck: recordedInstallation && state !== "installation_recorded" ? recordedTime(lastSeenAt) : undefined,
      };
    }
    if (id === "aws" || id === "azure" || id === "gcp") {
      const row = integrations.cloud.find(item => item.provider === id);
      return {recordedCheck: state === "read_only_connected" ? recordedTime(row?.lastTransitionAt) : undefined};
    }
    const row = integrations.collaboration.find(item => item.provider === id);
    return {recordedCheck: row ? recordedTime(row.lastValidatedAt) : undefined};
  }

  const isConfigured = (id: ProviderId) => id === "aws" || id === "azure" || id === "gcp" || id === "airflow"
    || integrations?.configuration?.[id] !== false;
  const hasVerifiedGitHubRead = (id: ProviderId, state: string) =>
    id === "github" && state === "validated_read_only" && isConfigured(id)
    && recordedTimestamp.safeParse(integrations?.github.lastSeenAt).success;
  const providerStatusLabel = (id: ProviderId, state: string) => state === "unavailable" ? "Status unavailable"
    : !isConfigured(id) ? "admin setup required"
    : id === "github" && state === "validated_read_only" ? (hasVerifiedGitHubRead(id, state) ? "Read access verified" : "Read check unconfirmed")
    : state === "read_only_connected" ? "Read-only connected" : state.replaceAll("_", " ");
  const observedProviderStates = PROVIDERS.map(provider => providerState(provider.id));
  const connectionCount = observedProviderStates.some(state => state === "checking" || state === "unavailable")
    ? null
    : observedProviderStates.filter(state => ["active", "connected", "read_only_connected", "validated_read_only"].includes(state)).length;
  const enabledSkillCount = skills && !catalogIssue ? skills.filter(skill => skill.status === "enabled").length : null;
  const readOnlyCloudCount = integrations && !integrations.cloud.some(item => item.status === "unavailable")
    ? integrations.cloud.filter(item => item.status === "read_only_connected").length
    : null;
  const validationOverdue = integrations && integrations.github.status !== "unavailable"
    && !integrations.collaboration.some(item => item.status === "unavailable")
    ? observedProviderStates.filter(state => state === "validation_overdue").length
    : null;
  const normalizedQuery = query.trim().toLowerCase();
  const showOutlook=["all","plugins"].includes(filter)&&(!normalizedQuery||"outlook microsoft email mail calendar collaboration".includes(normalizedQuery));
  const visibleSkills = useMemo(() => (skills ?? []).filter((skill) => {
    const matches = !normalizedQuery || `${skill.name} ${skill.description} ${skill.category}`.toLowerCase().includes(normalizedQuery);
    if (catalogIssue && ["installed", "enabled", "disabled"].includes(filter)) return false;
    return matches && (filter !== "mcp" || skill.id === "microsoft-learn-docs") && filter !== "plugins" && (filter !== "installed" || skill.status !== "not_installed") && (filter !== "enabled" || skill.status === "enabled") && (filter !== "disabled" || skill.status === "disabled");
  }), [skills, normalizedQuery, filter, catalogIssue]);
  const visibleProviders = PROVIDERS.filter((provider) => {
    const matches = !normalizedQuery || `${provider.name} ${provider.detail} ${provider.category}`.toLowerCase().includes(normalizedQuery);
    const state = providerState(provider.id);
    return matches && !["skills", "enabled", "disabled", "mcp"].includes(filter) && (filter !== "installed" || !["not_connected", "checking", "unavailable"].includes(state));
  });

  const inspectedProvider = inspected?.kind === "app" ? visibleProviders.find(provider => provider.id === inspected.id) : undefined;
  const inspectedSkill = inspected?.kind === "skill" ? visibleSkills.find(skill => skill.id === inspected.id) : undefined;
  const inspectedName = (inspectedProvider ?? inspectedSkill)?.name;
  useSearchShortcut(searchField, !inspectedName);
  useEffect(() => {
    if (inspected && !inspectedName) setInspected(undefined);
  }, [inspected, inspectedName]);

  function restoreInspectorFocus() {
    if (!owns()) return true;
    const opener = inspectorOpener.current;
    if (opener?.isConnected) opener.focus({preventScroll: true});
    if (document.activeElement !== opener) searchField.current?.focus();
    return true;
  }

  const inspectedProviderState = inspectedProvider ? providerState(inspectedProvider.id) : undefined;
  const inspectedReadVerified = Boolean(inspectedProvider && inspectedProviderState &&
    hasVerifiedGitHubRead(inspectedProvider.id, inspectedProviderState));
  const inspectedStatus = inspectedProvider && inspectedProviderState
    ? providerStatusLabel(inspectedProvider.id, inspectedProviderState)
    : inspectedSkill ? (catalogIssue ? "Unknown" : skillStatusLabels[inspectedSkill.status]) : undefined;
  const hasReportedConnection = inspectedProviderState !== undefined &&
    ["active", "connected", "read_only_connected", "validated_read_only"].includes(inspectedProviderState);
  const inspectedEvidence = inspectedProvider && inspectedProviderState
    ? providerEvidence(inspectedProvider.id, inspectedProviderState) : undefined;
  const hasRecordedSkill = inspectedSkill && !catalogIssue && inspectedSkill.status !== "not_installed";
  const recordedCheckLabel = inspectedProvider?.id === "github" ? "Recorded installation check" : "Recorded validation";
  const inspectedGitHubInstallation = inspectedProvider?.id === "github" &&
    inspectedProviderState !== undefined && isRecordedGitHubInstallation(inspectedProviderState);
  const canVerifyInspectedGitHub = inspectedGitHubInstallation && canManage &&
    isConfigured("github") && !integrationIssue && !validationRecovery.split(",").includes("github");
  const canConfigureInspectedGitHub = inspectedProvider?.id === "github" && canManage;
  const showInspectorCheck = inspectedProvider?.id === "github" && (canVerifyInspectedGitHub || inspectorNotice !== undefined);
  const disableInspectorCheck = !canVerifyInspectedGitHub || working !== null;
  const inspectorMessage = inspectorNotice?.verified && !inspectedReadVerified
    ? inspectedProviderState === "revoked" ? "GitHub access is revoked." : "Current GitHub read access is unconfirmed."
    : inspectorNotice?.message;
  function checkInspectedGitHub() {
    if (disableInspectorCheck || !owns() || mutation.current) return;
    void validateProvider("github", (message, verified = false) => {
      setInspectorNotice(message === null ? null : {message, verified});
    });
  }

  return (
    <ViewShell wide className="studio-capabilities">
      <div className="studio-catalog w-full pb-12" data-inspecting={Boolean(inspectedName)}>
        {onReturnToBot&&<button type="button" className="mb-4 text-sm text-zinc-300 underline" onClick={()=>{if(owns())onReturnToBot()}}>Back to V19 Bot</button>}
        <div className="studio-catalog-heading flex flex-wrap items-center justify-between gap-6">
          <div><h1>Apps &amp; Skills</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">Connect systems and give V19 precisely scoped capabilities.</p></div>
          <button type="button" onClick={onOpenSettings} className="btn-primary"><Plus size={14} aria-hidden="true"/>Connection settings</button>
        </div>

        <dl className="studio-catalog-summary" aria-label="Catalogue summary">
          {([
            ["Connected catalogue apps", connectionCount], ["Enabled skills", enabledSkillCount],
            ["Read-only cloud connections", readOnlyCloudCount], ["Overdue validations", validationOverdue],
          ] as const).map(([label, value]) => <div key={label}>
            <dt>{label}</dt><dd>{value ?? <><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></>}</dd>
          </div>)}
        </dl>

        {!canManage && <p role="status" className="mt-4 text-xs text-zinc-400">A workspace administrator manages skill installation and provider consent. You can inspect available capabilities.</p>}
        {integrationIssue && <p role="status" className="mt-4 text-xs text-amber-300">{integrationIssue}</p>}
        <div role="group" aria-label="Choose catalogue view" aria-describedby="catalogue-view-help" className="studio-catalog-filters">
          <div className="flex flex-wrap items-center gap-x-6">
            <div role="group" aria-label="Browse capabilities" className="flex flex-wrap items-center gap-1">{(["all", "plugins", "skills", "mcp"] as const).map(item =>
              <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "mcp" ? "Developer tools (MCP)" : item === "plugins" ? "Apps" : item}</button>)}</div>
            <div role="group" aria-label="Saved catalogue views" className="flex flex-wrap items-center gap-1">{(["installed", "enabled", "disabled"] as const).map(item =>
              <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "enabled" ? "Enabled" : item === "disabled" ? "Disabled" : item}</button>)}</div>
          </div>
          <p id="catalogue-view-help" className="sr-only">Select one view at a time. Enabled and Disabled show saved skills.</p>
        </div>
        <div className="studio-catalog-search-row">
          <label className="studio-catalog-search">
            <Search size={14} aria-hidden />
            <input ref={searchField} type="search" aria-label="Search apps and skills" aria-keyshortcuts="/"
              value={query} onChange={event => setQuery(event.target.value)} placeholder="Search apps and skills" />
            <kbd aria-hidden="true">/</kbd>
          </label>
          <button ref={refreshCapabilitiesButton} type="button" onClick={() => void load()} className="btn-secondary">Refresh capabilities</button>
        </div>
        {catalogIssue && <div role="status" className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/3 px-4 py-3"><p className="text-xs text-zinc-300">{catalogIssue}</p><button type="button" onClick={() => void load()} className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/6">Retry</button></div>}
        {notice && <div role="status" className="mt-5 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-xs text-zinc-300">{notice}</div>}

        {slackReviews&&<SlackNotificationPanel reviewOnly/>}
        {slackManager&&canManage&&integrations?.collaboration.some(item=>item.provider==='slack'&&item.status==='active')&&<SlackConnectionManager/>}

        {actionManager&&<ConnectedActionsPanel key={actionManager} provider={actionManager} canManage={canManage} onClose={()=>setActionManager(undefined)}/>}

        {filter === "mcp" && <DesktopMcpTools enabled={skillChangesAvailable && skills?.some(skill => skill.id === "microsoft-learn-docs" && skill.status === "enabled") === true} />}

        {visibleProviders.length > 0 && <section aria-label="App connections" className="mt-4">
          <h2 className="sr-only">App connections</h2>
          <div className="studio-capabilities-table studio-app-connections" role="region" aria-label="App connection rows" tabIndex={0}><table>
            <thead><tr><th scope="col">App</th><th scope="col">Connection</th><th scope="col">Repository access</th><th scope="col">Supported use</th><th scope="col">Recorded check</th><th scope="col">Actions</th></tr></thead>
            <tbody>{visibleProviders.map((provider) => {
          const state = providerState(provider.id); const connected = state === "active" || state === "validated_read_only" || (["aws", "azure", "gcp", "airflow"].includes(provider.id) && state === "connected");
          const cloudReadOnly = ["aws", "azure", "gcp"].includes(provider.id) && state === "read_only_connected";
          const needsValidation = ["installation_recorded", "validation_overdue", "awaiting_validation", "needs_attention"].includes(state);
          const configured = isConfigured(provider.id);
          const displayState = providerStatusLabel(provider.id, state);
          const evidence = providerEvidence(provider.id, state);
          const readVerified = hasVerifiedGitHubRead(provider.id, state);
          let action: ReactNode = <button type="button" disabled={!canManage || working !== null || !integrations || integrationIssue !== null} onClick={() => void connectProvider(provider.id as BrowserProvider)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{working === `provider:${provider.id}` ? "Opening…" : "Connect ↗"}</button>;
          if (provider.id === "airflow") action = <button type="button" onClick={onOpenAirflow} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">Open</button>;
          else if (state === "unavailable" || state === "checking") action = null;
          else if (!configured) action = <div className="shrink-0 text-right"><button type="button" disabled aria-label={`Connect ${provider.name}`} title="The service connection is not configured." className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500">Connect</button><p className="mt-1 text-[10px] text-zinc-500">Service connection unavailable</p></div>;
          else if (provider.id === "aws" || provider.id === "azure" || provider.id === "gcp" || connected) action = <button type="button" aria-label={provider.id === "aws" && !connected && !cloudReadOnly ? "Connect AWS" : undefined} onClick={onOpenSettings} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/6">{connected || cloudReadOnly ? "Manage" : provider.id === "aws" ? "Connect" : "Configure"}</button>;
          else if (needsValidation) action = <button type="button" disabled={!canManage || working !== null} onClick={() => void validateProvider(provider.id as BrowserProvider)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{working === `provider:${provider.id}` ? "Verifying…" : "Verify access"}</button>;
          if(provider.id==='slack'&&connected&&canManage)action=<button type="button" className="btn-secondary" onClick={()=>setSlackManager(value=>!value)}>{slackManager?'Close Slack manager':'Manage'}</button>;
          if((provider.id==='teams'||provider.id==='linear')&&connected){const id=provider.id;action=<button type="button" className="btn-secondary" onClick={()=>setActionManager(value=>value===id?undefined:id)}>{actionManager===id?'Close actions':'Actions'}</button>;}
          if(provider.id==='slack'&&connected)action=<div className="flex flex-wrap gap-2">{action}<button type="button" className="btn-secondary" onClick={()=>setSlackReviews(v=>!v)}>{slackReviews?'Close reviews':'Notification reviews'}</button></div>;
          if(provider.id==='github'&&state==='revoked'&&canManage)action=<div className="max-w-sm space-y-2 text-xs text-zinc-400">{githubHold?<button type="button" className="btn-secondary" disabled={working!==null} onClick={()=>void reloadGitHub()}>Reload GitHub status</button>:githubChallenge?<><p>Verified account: {githubChallenge.accountLogin} ({githubChallenge.accountType})</p><p>Repository access: {githubChallenge.repositorySelection==='all'?'All repositories':'Selected repositories'}</p><p>Review this existing installation before reconnecting. No new permissions are requested.</p><button type="button" className="btn-secondary" disabled={working!==null||Date.parse(githubChallenge.expiresAt)<=Date.now()} onClick={()=>void reconnectGitHub(true)}>Reconnect verified installation</button><button type="button" className="underline" disabled={working!==null} onClick={()=>setGithubChallenge(undefined)}>Dismiss review</button></>:<><button type="button" className="btn-secondary" disabled={working!==null||!integrations||!!integrationIssue} onClick={()=>void reconnectGitHub()}>{working==='provider:github'?'Connecting…':'Connect'}</button><details><summary className="cursor-pointer text-zinc-500">Other connection options</summary><button type="button" className="mt-2 underline" disabled={working!==null||!configured} onClick={()=>void connectProvider('github')}>Connect in browser ↗</button></details></>}</div>;
          if(validationRecovery.split(',').includes(provider.id))action=<div className="flex flex-wrap gap-2"><button type="button" disabled={working!==null} className="btn-secondary" onClick={()=>void load()} aria-label={`Reload ${provider.name==='Microsoft Teams'?'Teams':provider.name} status`}>Reload status</button><button type="button" className="btn-secondary" onClick={onOpenSettings}>Review consent</button></div>;
          return <tr key={provider.id} data-inspected={inspectedProvider?.id === provider.id}>
            <th scope="row"><div className="studio-capability-name"><ProviderLogo provider={provider.id} /><div>{provider.name}<small>{provider.category}</small></div></div></th>
            <td><span className="studio-catalog-reported-status" data-connected={configured && (connected || cloudReadOnly) && (state !== "validated_read_only" || provider.id !== "github" || readVerified)} data-read-verified={readVerified || undefined}>
              {readVerified && <CircleCheck size={13} aria-hidden="true"/>}{displayState}
            </span></td>
            <td>{evidence.repositoryAccess ?? <><span aria-hidden="true">—</span><span className="sr-only">{provider.id === "github" ? "Unavailable" : "Not applicable"}</span></>}</td>
            <td>{cloudReadOnly && provider.id !== "aws" ? `${provider.name} read-only access is connected. Agent scans and deployments remain unavailable.` : provider.detail}</td>
            <td>{evidence.recordedCheck ?? <><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></>}</td>
            <td><div className="studio-capability-actions">{action}<button type="button" className="btn-secondary" aria-label={`Inspect ${provider.name}`} aria-haspopup="dialog" onClick={event => inspect("app", provider.id, event.currentTarget)}>Inspect</button></div></td>
          </tr>;
        })}</tbody></table></div></section>}

        {showOutlook&&<section aria-label="Outlook app" className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><ProviderLogo provider="outlook"/><div><h2 className="text-sm font-medium text-zinc-100">Outlook</h2><p className="mt-1 text-xs text-zinc-500">Your existing mailbox and calendar connection. Reads and separately governed actions keep their current access checks.</p></div></div><button type="button" className="btn-secondary shrink-0 whitespace-nowrap" aria-expanded={outlookManager} onClick={()=>setOutlookManager(v=>!v)}>{outlookManager?'Close Outlook':'Open Outlook'}</button></div>{outlookManager&&<div className="mt-4"><OutlookIntegrationCard embedded/></div>}</section>}

        {visibleSkills.length > 0 && <section aria-label="Reusable skills" className="mt-6">
          <h2 className="mb-3 text-sm font-medium">Reusable skills</h2>
          <div className="studio-capabilities-table"><table>
            <thead><tr><th scope="col">Skill</th><th scope="col">Status</th><th scope="col">Guidance</th><th scope="col">Actions</th></tr></thead>
            <tbody>{visibleSkills.map(skill => <tr key={skill.id} data-inspected={inspectedSkill?.id === skill.id}>
              <th scope="row"><div className="studio-capability-name"><SkillIcon id={skill.id} category={skill.category}/><div>{skill.name}<small>{skill.category}</small></div></div></th>
              <td>{catalogIssue ? "Unknown" : skillStatusLabels[skill.status]}</td>
              <td>{skill.description}</td>
              <td><button type="button" className="btn-secondary" aria-label={`Inspect ${skill.name}`} aria-haspopup="dialog" onClick={event => inspect("skill", skill.id, event.currentTarget)}>Inspect</button>
                {!catalogIssue && skill.status === "enabled" && onUseSkill && <button type="button" className="btn-secondary ml-2" disabled={!skillChangesAvailable || working !== null}
                  onClick={() => { if (owns() && skillChangesAvailable && !mutation.current) onUseSkill(skill.id); }}>Use in Agent</button>}
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">Review skill tools</summary>
                  <p className="mt-2">Workflow guidance only. Installing does not grant tools, execution permissions or approval.</p>
                  <ul className="mt-2 space-y-1 font-mono">{skill.toolNames.map(tool => <li key={tool}>{tool}</li>)}</ul>
                </details>
                {!catalogIssue && <div className="studio-capability-actions mt-2">
                  {skill.status === "not_installed"
                    ? <button type="button" className="btn-primary" disabled={!canManage || working !== null || !skillChangesAvailable} onClick={() => void updateSkill(skill, "install")}>{working === skill.id ? "Adding…" : "Add"}</button>
                    : <>
                      <span className="inline-flex items-center gap-1 text-[10px]"><Check className="h-3 w-3" />{skill.status === "enabled" ? "Installed · enabled" : "Installed · disabled"}</span>
                      <button type="button" className="btn-secondary" disabled={!canManage || working !== null || !skillChangesAvailable} onClick={() => void updateSkill(skill, skill.status === "enabled" ? "disable" : "enable")}>{skill.status === "enabled" ? "Disable" : "Enable"}</button>
                      <button type="button" className="btn-secondary" disabled={!canManage || working !== null || !skillChangesAvailable} onClick={() => void updateSkill(skill, "remove")}>Remove</button>
                    </>}
                </div>}
              </td>
            </tr>)}</tbody>
          </table></div>
        </section>}

        {inspectedName && <DesktopDialog side role="dialog" isolate restoreFocus={restoreInspectorFocus} overlayClassName="studio-catalog-inspector" label={`Details for ${inspectedName}`} onClose={() => setInspected(undefined)}>
          <header className="studio-catalog-inspector-heading">
            <div className="studio-capability-name">
              {inspectedProvider && <ProviderLogo provider={inspectedProvider.id}/>}
              {inspectedSkill && <SkillIcon id={inspectedSkill.id} category={inspectedSkill.category}/>}
              <h2 className="text-lg font-medium">{inspectedName}</h2>
            </div>
            <button type="button" className="studio-catalog-inspector-close" aria-label="Close details" onClick={() => setInspected(undefined)}><X aria-hidden="true" size={16}/></button>
          </header>
          {inspectedStatus && <dl className="studio-catalog-inspector-status">
            <div>
              <dt className="sr-only">{inspectedProvider ? "Reported status" : "Skill status"}</dt>
              <dd className="studio-catalog-reported-status" data-connected={Boolean(inspectedProvider && isConfigured(inspectedProvider.id) && hasReportedConnection && (inspectedProvider.id !== "github" || inspectedProviderState !== "validated_read_only" || inspectedReadVerified))} data-read-verified={inspectedReadVerified || undefined}>
                {inspectedReadVerified && <CircleCheck size={13} aria-hidden="true"/>}{inspectedStatus}
              </dd>
            </div>
          </dl>}
          <p className="studio-catalog-inspector-description">{inspectedProvider?.detail ?? inspectedSkill?.description}</p>
          <div className="studio-catalog-inspector-tabs" role="tablist" aria-label="Catalogue details">
            {inspectorTabs.map((label, index) => <button key={label} type="button" role="tab"
              id={`${inspectorTabsId}-${label}`} aria-selected={inspectorTab === label} aria-controls={`${inspectorTabsId}-panel`}
              tabIndex={inspectorTab === label ? 0 : -1} onClick={() => setInspectorTab(label)}
              onKeyDown={event => {
                if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                const targetIndex = event.key === "ArrowRight" ? (index + 1) % inspectorTabs.length
                  : event.key === "ArrowLeft" ? (index + inspectorTabs.length - 1) % inspectorTabs.length
                  : event.key === "Home" ? 0 : event.key === "End" ? inspectorTabs.length - 1 : undefined;
                if (targetIndex === undefined) return;
                event.preventDefault();
                setInspectorTab(inspectorTabs[targetIndex]);
                event.currentTarget.parentElement?.querySelectorAll("button")[targetIndex]?.focus();
              }}>{label}</button>)}
          </div>
          <div role="tabpanel" id={`${inspectorTabsId}-panel`} aria-labelledby={`${inspectorTabsId}-${inspectorTab}`} tabIndex={0}>
            {inspectorTab === "Overview" && <section className="studio-catalog-inspector-section studio-catalog-inspector-overview" aria-label="Overview">
              <h3 className="sr-only">Overview</h3>
              <dl className="studio-catalog-inspector-facts">
                <div><dt>Category</dt><dd>{(inspectedProvider ?? inspectedSkill)?.category}</dd></div>
                {inspectedEvidence?.repositoryAccess &&
                  <div><dt>Reported repository access</dt><dd>{inspectedEvidence.repositoryAccess}</dd></div>}
                {inspectedGitHubInstallation && <div><dt>Authentication</dt><dd>GitHub App</dd></div>}
                {inspectedProvider && inspectedEvidence?.recordedCheck !== undefined &&
                  <div><dt>{recordedCheckLabel}</dt><dd>{inspectedEvidence?.recordedCheck ?? "Unavailable"}</dd></div>}
                {hasRecordedSkill && <>
                  <div><dt>Recorded installation</dt><dd>{recordedTime(inspectedSkill.installedAt) ?? "Unavailable"}</dd></div>
                  <div><dt>Recorded update</dt><dd>{recordedTime(inspectedSkill.updatedAt) ?? "Unavailable"}</dd></div>
                </>}
              </dl>
            </section>}
            {inspectorTab === "Permissions" && inspectedProvider && <section className="studio-catalog-inspector-section" aria-label="Reported access">
              <h3>Reported access</h3>
              <dl className="studio-catalog-inspector-facts">
                <div><dt>Connection status</dt><dd>{inspectedStatus}</dd></div>
                {inspectedProvider.id === "github" && <div><dt>Reported repository access</dt>
                  <dd>{inspectedEvidence?.repositoryAccess ?? "Unavailable"}</dd></div>}
              </dl>
            </section>}
            {inspectorTab === "Activity" && <section className="studio-catalog-inspector-section" aria-label="Recorded activity">
              <h3>Recorded activity</h3>
              <dl className="studio-catalog-inspector-facts">
                {inspectedProvider && <div><dt>{recordedCheckLabel}</dt><dd>{inspectedEvidence?.recordedCheck ?? "Unavailable"}</dd></div>}
                {inspectedSkill && <>
                  <div><dt>Recorded installation</dt><dd>{(hasRecordedSkill && recordedTime(inspectedSkill.installedAt)) || "Unavailable"}</dd></div>
                  <div><dt>Recorded update</dt><dd>{(hasRecordedSkill && recordedTime(inspectedSkill.updatedAt)) || "Unavailable"}</dd></div>
                </>}
              </dl>
            </section>}
            {inspectorTab !== "Activity" && inspectedSkill && <section className="studio-catalog-inspector-section" aria-label="Declared tools">
              <h3>Declared tools</h3>
              {inspectedSkill.toolNames.length > 0
                ? <ul className="mt-2 space-y-1 font-mono">{inspectedSkill.toolNames.map(tool => <li key={tool}>{tool}</li>)}</ul>
                : <p>No tools declared.</p>}
            </section>}
            {inspectorTab !== "Activity" && <section className="studio-catalog-inspector-section" aria-label="Execution boundary">
              <h3><LockKeyhole aria-hidden="true" size={13}/> Execution boundary</h3>
              <p>{inspectedProvider
                ? "Connection status does not grant action authority. Actions remain subject to workspace permissions and approval."
                : "Skill guidance does not grant tools or execution permissions. Actions still require their own approval."}</p>
            </section>}
          </div>
          {(showInspectorCheck || canConfigureInspectedGitHub) &&
            <section className="studio-catalog-inspector-section studio-catalog-connection-check" aria-label="GitHub connection actions">
            <div className="studio-catalog-inspector-actions">
              {showInspectorCheck && <button type="button" className="btn-secondary" aria-disabled={disableInspectorCheck} onClick={checkInspectedGitHub}>
                <RefreshCw aria-hidden="true" size={14}/> {working === "provider:github" ? "Verifying…" : "Verify read access"}
              </button>}
              {canConfigureInspectedGitHub && <button type="button" className="btn-primary studio-catalog-configure"
                aria-label="Configure GitHub connection" aria-disabled={working !== null}
                onClick={() => { if (owns() && !mutation.current && working === null) onOpenSettings(); }}>
                <Settings aria-hidden="true" size={14}/> Configure
              </button>}
            </div>
            {inspectorMessage && <p className="mt-2" role="status">{inspectorMessage}</p>}
          </section>}
        </DesktopDialog>}

        {visibleProviders.length === 0 && visibleSkills.length === 0 && !showOutlook && (filter !== "plugins" && skills === null
          ? <p role="status" className="mt-10 text-center text-sm text-zinc-400">Loading skills…</p>
          : (filter === "plugins" || !catalogIssue) && <div className="mt-10 rounded-2xl border border-white/[0.07] p-10 text-center"><p className="text-sm text-zinc-300">No matching capabilities</p><p className="mt-2 text-xs text-zinc-400">Try a different search or filter.</p></div>)}
      </div>
    </ViewShell>
  );
}

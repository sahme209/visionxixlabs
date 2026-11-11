import {OutlookIntegrationCard} from '../components/OutlookIntegrationCard';
import {SlackNotificationPanel} from '../components/SlackNotificationPanel';
import {ConnectedActionsPanel} from '../components/ConnectedActionsPanel';
import {SlackConnectionManager} from "../components/SlackConnectionManager";
import type {GithubReconnectChallenge} from "../../../lib/desktop/githubInstallationReconnectContract";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Check, Package, Search, ShieldCheck, Wrench } from "lucide-react";
import { ProviderLogo, SkillIcon } from "../components/CatalogIcon";
import { DesktopMcpTools } from "../components/DesktopMcpTools";
import { ViewShell } from "../components/Primitives";
import { desktopClient, type AgentSkillCatalogItem } from "../lib/desktopClient";

type Filter = "all" | "skills" | "plugins" | "installed" | "enabled" | "disabled" | "mcp";
interface IntegrationStatus {
  configuration?: Record<BrowserProvider, boolean>;
  cloud: Array<{ provider: "aws" | "azure" | "gcp"; status: string; lastTransitionAt: string | null }>;
  github: { status: string; repositorySelection: string };
  collaboration: Array<{ provider: "slack" | "teams" | "linear"; status: string; lastValidatedAt: string | null }>;
}

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
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [airflowStatus, setAirflowStatus] = useState<string | null>(null);
  const [slackManager,setSlackManager]=useState(false);
  const [outlookManager,setOutlookManager]=useState(false);
  const [actionManager,setActionManager]=useState<'teams'|'linear'>();
  const [slackReviews,setSlackReviews]=useState(false);
  const [githubChallenge,setGithubChallenge]=useState<GithubReconnectChallenge>();
  const [githubHold,setGithubHold]=useState(()=>desktopClient.githubReconnectNeedsReload?.()??false);
  const reconnectFlight=useRef<AbortController|null>(null);
  const [query, setQuery] = useState("");
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
          ? "Skills are visible, but installation changes are temporarily unavailable while workspace storage is being prepared." : null);
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
      if (current()) setAirflowStatus(result?.ok ? result.data.status : "unavailable");
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

  async function validateProvider(provider: BrowserProvider) {
    if (!owns() || !canManage || mutation.current || validationRecovery.split(',').includes(provider)) return;
    mutation.current = true; setWorking(`provider:${provider}`); setNotice(null);
    try {
      const result = provider === "github" ? await desktopClient.validateGitHubReadOnly()
        : provider === "slack" ? await desktopClient.validateSlackConnection()
        : provider === "teams" ? await desktopClient.validateTeamsConnection() : await desktopClient.validateLinearConnection();
      if (!owns()) return;
      if (!result.ok) {if(provider==='slack'||provider==='teams'){if('outcomeUnconfirmed' in result&&result.outcomeUnconfirmed){desktopClient.recordIntegrationValidationUnknown?.(provider);setNotice('Validation outcome is unconfirmed. Reload status and review consent before further validation.')}else setNotice('Validation could not be completed. Reload status and review the provider consent.');return}throw new Error("validation_failed")}
      setNotice(provider==='teams'?'Microsoft identity is verified for this workspace. Teams message permissions remain separately controlled.':`${PROVIDERS.find((item) => item.id === provider)?.name ?? provider} access is verified for this workspace.`);
      void load();
    } catch {
      if (owns()) {if(provider==='slack'||provider==='teams'){desktopClient.recordIntegrationValidationUnknown?.(provider);setNotice('Validation outcome is unconfirmed. Reload status and review consent before further validation.')}else setNotice(`The ${PROVIDERS.find((item) => item.id === provider)?.name ?? provider} connection could not be verified. Review its consent in Connection settings and try again.`)}
    } finally { if (owns()) { mutation.current = false; setWorking(null); } }
  }

  const providerState = (provider: (typeof PROVIDERS)[number]["id"]) => {
    if (provider === "airflow") return airflowStatus ?? "checking";
    if (!integrations) return integrationIssue ? "unavailable" : "checking";
    if (provider === "github") return integrations.github.status;
    if (provider === "aws" || provider === "azure" || provider === "gcp") return integrations.cloud.find((item) => item.provider === provider)?.status ?? "not_connected";
    return integrations.collaboration.find((item) => item.provider === provider)?.status ?? "not_connected";
  };
  const normalizedQuery = query.trim().toLowerCase();
  const showOutlook=["all","plugins"].includes(filter)&&(!normalizedQuery||"outlook microsoft email mail calendar collaboration".includes(normalizedQuery));
  const visibleSkills = useMemo(() => (skills ?? []).filter((skill) => {
    const matches = !normalizedQuery || `${skill.name} ${skill.description} ${skill.category}`.toLowerCase().includes(normalizedQuery);
    return matches && (filter !== "mcp" || skill.id === "microsoft-learn-docs") && filter !== "plugins" && (filter !== "installed" || skill.status !== "not_installed") && (filter !== "enabled" || skill.status === "enabled") && (filter !== "disabled" || skill.status === "disabled");
  }), [skills, normalizedQuery, filter]);
  const visibleProviders = PROVIDERS.filter((provider) => {
    const matches = !normalizedQuery || `${provider.name} ${provider.detail} ${provider.category}`.toLowerCase().includes(normalizedQuery);
    const state = providerState(provider.id);
    return matches && !["skills", "enabled", "disabled", "mcp"].includes(filter) && (filter !== "installed" || !["not_connected", "checking", "unavailable"].includes(state));
  });

  return (
    <ViewShell>
      <div className="mx-auto w-full max-w-5xl pb-12">
        {onReturnToBot&&<button type="button" className="mb-4 text-sm text-zinc-300 underline" onClick={()=>{if(owns())onReturnToBot()}}>Back to Axiom Bot</button>}
        <div className="flex items-start justify-between gap-6">
          <div><h1 className="text-2xl font-semibold tracking-[-0.035em]">Apps & skills</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">Connect your apps, review available actions and manage reusable skills. Each action still follows workspace policy and approval.</p></div>
          <div className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-500"><ShieldCheck className="h-3.5 w-3.5" />Permissions & approvals</div>
        </div>

        {!canManage && <p role="status" className="mt-4 text-xs text-zinc-400">A workspace administrator manages skill installation and provider consent. You can inspect available capabilities.</p>}
        {integrationIssue && <p role="status" className="mt-4 text-xs text-amber-300">{integrationIssue}</p>}
        <button type="button" onClick={() => void load()} className="mt-3 text-xs text-zinc-400 underline">Refresh capabilities</button>
        <div className="mt-7 flex gap-3">
          <label className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/2.5 px-3 text-zinc-500 focus-within:border-white/20"><Search className="h-4 w-4" /><input type="search" aria-label="Search apps and skills" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps and skills" className="w-full bg-transparent text-sm text-zinc-200 outline-hidden placeholder:text-zinc-600" /></label>
          <button type="button" onClick={onOpenSettings} className="rounded-xl border border-white/10 px-4 text-xs text-zinc-300 hover:bg-white/6">Connection settings</button>
        </div>
        <div role="group" aria-label="Choose catalogue view" aria-describedby="catalogue-view-help" className="mt-4 rounded-xl border border-white/8 bg-white/1.5 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div role="group" aria-label="Browse capabilities" className="flex flex-wrap items-center gap-1"><span className="mr-2 text-xs text-zinc-500">Browse</span>{(["all", "plugins", "skills", "mcp"] as const).map(item=><button key={item} type="button" aria-pressed={filter===item} onClick={()=>setFilter(item)} className={`rounded-md px-3 py-2 text-xs capitalize transition ${filter===item?"bg-white/9 text-white":"text-zinc-400 hover:bg-white/[0.035] hover:text-white"}`}>{item==="mcp"?"Developer tools (MCP)":item==="plugins"?"Apps":item}</button>)}</div>
            <div role="group" aria-label="Saved catalogue views" className="flex flex-wrap items-center gap-1"><span className="mr-2 text-xs text-zinc-500">Saved views</span>{(["installed","enabled","disabled"] as const).map(item=><button key={item} type="button" aria-pressed={filter===item} onClick={()=>setFilter(item)} className={`rounded-md px-3 py-2 text-xs capitalize transition ${filter===item?"bg-white/9 text-white":"text-zinc-400 hover:bg-white/[0.035] hover:text-white"}`}>{item==="enabled"?"Enabled":item==="disabled"?"Disabled":item}</button>)}</div>
          </div>
          <p id="catalogue-view-help" className="mt-2 text-xs leading-5 text-zinc-500">Select one view at a time. Enabled and Disabled show saved skills.</p>
        </div>
        {catalogIssue && <div role="status" className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/3 px-4 py-3"><p className="text-xs text-zinc-300">{catalogIssue}</p><button type="button" onClick={() => void load()} className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/6">Retry</button></div>}
        {notice && <div role="status" className="mt-5 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-xs text-zinc-300">{notice}</div>}

        {slackReviews&&<SlackNotificationPanel reviewOnly/>}
        {slackManager&&canManage&&integrations?.collaboration.some(item=>item.provider==='slack'&&item.status==='active')&&<SlackConnectionManager/>}

        {actionManager&&<ConnectedActionsPanel key={actionManager} provider={actionManager} canManage={canManage} onClose={()=>setActionManager(undefined)}/>}

        {filter === "mcp" && <DesktopMcpTools enabled={skillChangesAvailable && skills?.some(skill => skill.id === "microsoft-learn-docs" && skill.status === "enabled") === true} />}

        {visibleProviders.length > 0 && <section aria-label="App connections" className="mt-7"><header className="mb-5"><h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200"><Package className="h-4 w-4 text-zinc-500" />App connections</h2><p className="mt-1 text-xs text-zinc-500">Review each connection’s current status. Available actions keep their own access checks and approvals.</p></header>{Array.from(new Set(visibleProviders.map(provider=>provider.category))).map(category=><section key={category} className="mb-5"><h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">{category}</h3><div className="divide-y divide-white/6 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.018]">{visibleProviders.filter(provider=>provider.category===category).map((provider) => {
          const state = providerState(provider.id); const connected = state === "active" || state === "validated_read_only" || (["aws", "azure", "gcp", "airflow"].includes(provider.id) && state === "connected");
          const cloudReadOnly = ["aws", "azure", "gcp"].includes(provider.id) && state === "read_only_connected";
          const needsValidation = ["installation_recorded", "validation_overdue", "awaiting_validation", "needs_attention"].includes(state);
          const configured = provider.id === "aws" || provider.id === "azure" || provider.id === "gcp" || provider.id === "airflow" || integrations?.configuration?.[provider.id] !== false;
          const displayState = !configured ? "admin setup required" : cloudReadOnly ? "Read-only connected" : state.replaceAll("_", " ");
          let action = <button type="button" disabled={!canManage || working !== null || !integrations || integrationIssue !== null} onClick={() => void connectProvider(provider.id as BrowserProvider)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{working === `provider:${provider.id}` ? "Opening…" : "Connect ↗"}</button>;
          if (provider.id === "airflow") action = <button type="button" onClick={onOpenAirflow} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">Open</button>;
          else if (!configured) action = <div className="shrink-0 text-right"><button type="button" disabled aria-label={`Connect ${provider.name}`} title="The service connection is not configured." className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500">Connect</button><p className="mt-1 text-[10px] text-zinc-500">Service connection unavailable</p></div>;
          else if (provider.id === "aws" || provider.id === "azure" || provider.id === "gcp" || connected) action = <button type="button" aria-label={provider.id === "aws" && !connected && !cloudReadOnly ? "Connect AWS" : undefined} onClick={onOpenSettings} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/6">{connected || cloudReadOnly ? "Manage" : provider.id === "aws" ? "Connect" : "Configure"}</button>;
          else if (needsValidation) action = <button type="button" disabled={!canManage || working !== null} onClick={() => void validateProvider(provider.id as BrowserProvider)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{working === `provider:${provider.id}` ? "Verifying…" : "Verify access"}</button>;
          if(provider.id==='slack'&&connected&&canManage)action=<button type="button" className="btn-secondary" onClick={()=>setSlackManager(value=>!value)}>{slackManager?'Close Slack manager':'Manage'}</button>;
          if((provider.id==='teams'||provider.id==='linear')&&connected){const id=provider.id;action=<button type="button" className="btn-secondary" onClick={()=>setActionManager(value=>value===id?undefined:id)}>{actionManager===id?'Close actions':'Actions'}</button>;}
          if(provider.id==='slack'&&connected)action=<div className="flex flex-wrap gap-2">{action}<button type="button" className="btn-secondary" onClick={()=>setSlackReviews(v=>!v)}>{slackReviews?'Close reviews':'Notification reviews'}</button></div>;
          if(provider.id==='github'&&state==='revoked'&&canManage)action=<div className="max-w-sm space-y-2 text-xs text-zinc-400">{githubHold?<button type="button" className="btn-secondary" disabled={working!==null} onClick={()=>void reloadGitHub()}>Reload GitHub status</button>:githubChallenge?<><p>Verified account: {githubChallenge.accountLogin} ({githubChallenge.accountType})</p><p>Repository access: {githubChallenge.repositorySelection==='all'?'All repositories':'Selected repositories'}</p><p>Review this existing installation before reconnecting. No new permissions are requested.</p><button type="button" className="btn-secondary" disabled={working!==null||Date.parse(githubChallenge.expiresAt)<=Date.now()} onClick={()=>void reconnectGitHub(true)}>Reconnect verified installation</button><button type="button" className="underline" disabled={working!==null} onClick={()=>setGithubChallenge(undefined)}>Dismiss review</button></>:<><button type="button" className="btn-secondary" disabled={working!==null||!integrations||!!integrationIssue} onClick={()=>void reconnectGitHub()}>{working==='provider:github'?'Connecting…':'Connect'}</button><details><summary className="cursor-pointer text-zinc-500">Other connection options</summary><button type="button" className="mt-2 underline" disabled={working!==null||!configured} onClick={()=>void connectProvider('github')}>Connect in browser ↗</button></details></>}</div>;
          if(validationRecovery.split(',').includes(provider.id))action=<div className="flex flex-wrap gap-2"><button type="button" disabled={working!==null} className="btn-secondary" onClick={()=>void load()} aria-label={`Reload ${provider.name==='Microsoft Teams'?'Teams':provider.name} status`}>Reload status</button><button type="button" className="btn-secondary" onClick={onOpenSettings}>Review consent</button></div>;
          return <div key={provider.id} className="flex min-h-[78px] items-center gap-4 px-5 py-3"><span className="grid h-9 w-9 place-items-center rounded-lg border border-white/8 bg-white/[0.035]"><ProviderLogo provider={provider.id} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm text-zinc-100">{provider.name}</p><span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${connected ? "border-emerald-400/15 text-emerald-200" : "border-white/8 text-zinc-500"}`}>{displayState}</span></div><p className="mt-1 text-xs leading-5 text-zinc-500">{cloudReadOnly && provider.id !== "aws" ? `${provider.name} read-only access is connected. Agent scans and deployments remain unavailable.` : provider.detail}</p></div>{action}</div>;
        })}</div></section>)}</section>}

        {showOutlook&&<section aria-label="Outlook app" className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><ProviderLogo provider="outlook"/><div><h2 className="text-sm font-medium text-zinc-100">Outlook</h2><p className="mt-1 text-xs text-zinc-500">Your existing mailbox and calendar connection. Reads and separately governed actions keep their current access checks.</p></div></div><button type="button" className="btn-secondary shrink-0 whitespace-nowrap" aria-expanded={outlookManager} onClick={()=>setOutlookManager(v=>!v)}>{outlookManager?'Close Outlook':'Open Outlook'}</button></div>{outlookManager&&<div className="mt-4"><OutlookIntegrationCard embedded/></div>}</section>}

        {visibleSkills.length > 0 && <section className="mt-8"><header className="mb-3"><h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200"><Wrench className="h-4 w-4 text-zinc-500" />Reusable skills</h2><p className="mt-1 text-xs text-zinc-500">Give Agent repeatable guidance. Adding a skill never grants app access or execution permission.</p></header><div className="grid gap-3 sm:grid-cols-2">{visibleSkills.map((skill) => <div key={skill.id} className="flex min-h-[178px] flex-col rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"><div className="flex items-start justify-between gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg border border-white/8 bg-white/[0.035]"><SkillIcon id={skill.id} category={skill.category} /></span><span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">{skill.category}</span></div><h2 className="mt-4 text-sm font-medium text-zinc-100">{skill.name}</h2><p className="mt-1 flex-1 text-xs leading-5 text-zinc-500">{skill.description}</p>{skill.status === "enabled" && onUseSkill && <button type="button" disabled={!skillChangesAvailable || working !== null} onClick={() => { if (owns() && skillChangesAvailable && !mutation.current) onUseSkill(skill.id); }} className="mt-3 rounded-lg border border-violet-300/20 px-3 py-2 text-xs text-violet-200 disabled:opacity-50">Use in Agent</button>}<details className="mt-3 text-xs text-zinc-400"><summary className="cursor-pointer">Review skill tools</summary><p className="mt-2">Workflow guidance only. Installing does not grant tools, execution permissions or approval.</p><ul className="mt-2 space-y-1 font-mono">{skill.toolNames.map(tool => <li key={tool}>{tool}</li>)}</ul></details><div className="mt-4 flex items-center justify-between"><span className="text-[10px] text-zinc-600">{skill.toolNames.length} governed tools</span>{skill.status === "not_installed" ? <button type="button" disabled={!canManage || working !== null || !skillChangesAvailable} onClick={() => void updateSkill(skill, "install")} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{working === skill.id ? "Adding…" : "Add"}</button> : <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><Check className="h-3 w-3" />{skill.status === "enabled" ? "Installed · enabled" : "Installed · disabled"}</span><button type="button" disabled={!canManage || working !== null || !skillChangesAvailable} onClick={() => void updateSkill(skill, skill.status === "enabled" ? "disable" : "enable")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">{skill.status === "enabled" ? "Disable" : "Enable"}</button><button type="button" disabled={!canManage || working !== null || !skillChangesAvailable} onClick={() => void updateSkill(skill, "remove")} className="rounded-lg px-2 py-2 text-[11px] text-zinc-600 hover:bg-rose-400/6 hover:text-rose-300 disabled:opacity-50">Remove</button></div>}</div></div>)}</div></section>}

        {visibleProviders.length === 0 && visibleSkills.length === 0 && !showOutlook && (filter !== "plugins" && skills === null
          ? <p role="status" className="mt-10 text-center text-sm text-zinc-400">Loading skills…</p>
          : (filter === "plugins" || !catalogIssue) && <div className="mt-10 rounded-2xl border border-white/[0.07] p-10 text-center"><p className="text-sm text-zinc-300">No matching capabilities</p><p className="mt-2 text-xs text-zinc-600">Try a different search or filter.</p></div>)}
      </div>
    </ViewShell>
  );
}

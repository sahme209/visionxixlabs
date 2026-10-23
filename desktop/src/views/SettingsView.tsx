import {parseDesktopUsageSummary,type DesktopUsageSummary} from "../../../lib/desktop/desktopBillingSummary";
import { AGENT_PROFILES } from "../../../lib/axiom/agentRuntime/agentProfiles";
import { DeploymentWorkflowEvidence } from "../components/DeploymentWorkflowEvidence";
import { AwsReadOnlyEnrollment } from "../components/AwsReadOnlyEnrollment";
import { AzureReadOnlyEnrollment } from "../components/AzureReadOnlyEnrollment";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  CircleUserRound,
  Code2,
  CreditCard,
  GitBranch,
  KeyRound,
  Link2,
  LockKeyhole,
  LogOut,
  Palette,
  Server,
  Settings2,
  Search,
  ShieldCheck,
  Trees,
} from "lucide-react";
import { desktopClient, type DeploymentExecution, type VerifiedDesktopIdentity, type WorkspaceMember } from "../lib/desktopClient";
import { deploymentObservationState } from "../lib/deploymentObservationState";
import { signOutDesktopCredentials } from "../lib/activeDesktopCredential";
import { normalizeAiProviderStatus, toggleApprovedModel, setApprovedGatewayDefault, removeUnavailableGatewayApprovals, isModelApproved, isConcreteGatewayModelId, type ModelPolicy, type ProviderModels } from "../lib/aiProviderStatus";
import { markNotificationPrefDirty, notifyResult } from "../lib/notifications";
import {
  readDesktopPreferences,
  writeDesktopPreferences,
  type DesktopPreferences,
} from "../lib/preferences";

const WEB_BASE = "https://visionxixlabs.com";

/**
 * Desktop-safe integration inventory.
 *
 * The installed app must never imply that a provider is connected merely
 * because a browser setup page exists. These states are intentionally
 * conservative until the server has completed the tenant-scoped consent,
 * validation, and audit journey for the provider.
 */
const INTEGRATION_CENTER_ITEMS = [
  { group: "Source control", name: "GitLab & Azure DevOps", detail: "Adapters and release data foundations exist, but customer activation is not presented as complete until OAuth, permissions, and recovery are verified end to end.", state: "In review" },
  { group: "Work management", name: "Jira & ServiceNow", detail: "Change-ticket context belongs on each release. Ticket creation or updates must be approval-gated and recorded in the release audit trail.", state: "In review" },
  { group: "Cloud & delivery", name: "AWS, Azure & Google Cloud", detail: "Cloud access is tenant-scoped and least-privilege. A provider is not marked connected until server-side validation succeeds.", state: "Admin setup" },
  { group: "Observability", name: "Sentry, Datadog & Grafana", detail: "Release-health signals should be inbound and read-only first, with signed delivery and clear source provenance.", state: "Planned" },
] as const;

type Section =
  | "general"
  | "profile"
  | "appearance"
  | "plan"
  | "agents"
  | "models"
  | "permissions"
  | "git"
  | "worktrees"
  | "integrations"
  | "environments"
  | "identity";

const sectionKeywords: Record<Section, string> = {
  general: "startup notifications account",
  profile: "name email session sign out logout",
  appearance: "theme density motion contrast accessibility",
  plan: "billing subscription tokens cost usage",
  agents: "chat keyboard enter conversation queue interrupt approvals",
  models: "AI providers gateway approved models",
  permissions: "roles members organization access governance",
  git: "source control branches attribution pull requests",
  worktrees: "isolated workspace cleanup storage",
  integrations: "connections connectors providers",
  environments: "cloud deployment AWS Azure",
  identity: "OIDC SAML SCIM enterprise authentication",
};

const sections: Array<{ id: Section; label: string; icon: typeof CircleUserRound }> = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "profile", label: "Profile", icon: CircleUserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "plan", label: "Plan & usage", icon: CreditCard },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "models", label: "Models", icon: Code2 },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "git", label: "Git & PRs", icon: GitBranch },
  { id: "environments", label: "Environments", icon: Server },
  { id: "identity", label: "Identity", icon: KeyRound },
  { id: "worktrees", label: "Worktrees", icon: Trees },
  { id: "integrations", label: "Integrations", icon: Link2 },
];

export function SettingsView({ identity, initialSection, onClose, onOpenRepository }: { identity: VerifiedDesktopIdentity; initialSection?: "models" | "agents" | "plan"; onOpenRepository?: () => void; onClose?: () => void }) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Section>(initialSection ?? "general");
  const [prefs, setPrefs] = useState<DesktopPreferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const preferenceWriteInFlight = useRef(false);
  const [preferenceSaveUnconfirmed, setPreferenceSaveUnconfirmed] = useState(false);
  const settingsMounted = useRef(true);
  const savedNoticeTimer = useRef<number | undefined>(undefined);
  useEffect(() => { settingsMounted.current = true; return () => { settingsMounted.current = false; window.clearTimeout(savedNoticeTimer.current); }; }, []);
  const [error, setError] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);

  useEffect(() => {
    let current = true;
    readDesktopPreferences().then(value => { if (current) setPrefs(value); })
      .catch(() => { if (current) setError("Local preferences could not be loaded. Reopen Settings to try again."); });
    return () => { current = false; };
  }, []);

  async function savePreferences(next: DesktopPreferences) {
    if (preferenceWriteInFlight.current || preferenceSaveUnconfirmed || !prefs) return;
    preferenceWriteInFlight.current = true;
    const previous = prefs;
    window.clearTimeout(savedNoticeTimer.current);
    setSavingPreferences(true); setSaved(false); setError(null); setPrefs(next);
    try {
      await writeDesktopPreferences(next);
      markNotificationPrefDirty();
      if (settingsMounted.current) {
        setSaved(true);
        savedNoticeTimer.current = window.setTimeout(() => setSaved(false), 1800);
      }
    } catch {
      if (settingsMounted.current) {
        setPrefs(previous); setPreferenceSaveUnconfirmed(true);
        setError("This preference change could not be confirmed. Reopen Settings to check it before making another change.");
      }
    } finally {
      preferenceWriteInFlight.current = false;
      if (settingsMounted.current) setSavingPreferences(false);
    }
  }

  async function signOut() {
    try {
      await signOutDesktopCredentials();
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out could not be saved. Retry when secure storage is available.");
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 bg-axiom-bg">
      <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="min-h-0 overflow-y-auto border-r border-white/[0.06] bg-[#18191b] px-3 pb-5 pt-8">
          {onClose && <button type="button" onClick={onClose} className="mb-6 flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-zinc-400 hover:bg-white/[0.04] hover:text-white"><ArrowLeft aria-hidden className="h-4 w-4" />Back to workspace</button>}
          <h1 className="sr-only">Settings</h1>
          <label className="mb-4 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 text-zinc-500">
            <Search aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <input type="search" aria-label="Search settings" placeholder="Search settings" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 w-full bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600" />
          </label>
          {search.trim() && !sections.some(section => `${section.label} ${sectionKeywords[section.id]}`.toLowerCase().includes(search.trim().toLowerCase())) && <p role="status" className="px-3 py-2 text-xs text-zinc-500">No matching settings.</p>}
          {sections.filter(section => !search.trim() || `${section.label} ${sectionKeywords[section.id]}`.toLowerCase().includes(search.trim().toLowerCase())).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setActive(id); setSearch(""); }}
              aria-current={active === id ? "page" : undefined}
              className={`relative flex w-full items-center gap-3 rounded-md py-2 pl-3 pr-2 text-left text-[13px] transition-colors ${
                active === id ? "bg-white/[0.06] text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {active === id && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-white" />}
              <Icon aria-hidden className="h-[15px] w-[15px]" strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          ))}
          <div className="mt-6 border-t border-white/[0.06] pl-3 pt-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Signed in workspace</p>
            <p className="mt-2 truncate text-xs text-zinc-400" title={identity.organizationId}>{identity.organizationId}</p>
            <p className="mt-1 text-[11px] text-emerald-300">Service verified</p>
          </div>
        </nav>

        <div className="min-h-0 min-w-0 overflow-y-auto px-5 py-10 lg:px-10"><div className="mx-auto w-full max-w-[760px]">
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          {savingPreferences && <p role="status" className="mb-5 text-xs text-zinc-400">Saving on this computer…</p>}
          {saved && <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"><Check className="h-4 w-4" />Saved on this computer.</div>}
          <fieldset disabled={savingPreferences || preferenceSaveUnconfirmed && ["general", "profile", "appearance", "agents"].includes(active)} className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">Settings controls</legend>
          {active === "general" && <GeneralSection prefs={prefs} onSave={savePreferences} />}
          {active === "profile" && <ProfileSection identity={identity} prefs={prefs} onSave={savePreferences} onRequestSignOut={() => setShowSignOut(true)} />}
          {active === "appearance" && <AppearanceSection prefs={prefs} onSave={savePreferences} />}
          {active === "plan" && <PlanSection identity={identity} />}
          {active === "agents" && <AgentsSection prefs={prefs} onSave={savePreferences} />}
          {active === "models" && <ModelsSection />}
          {active === "permissions" && <PermissionsSection identity={identity} />}
            {active === "git" && <GitSection />}
          {active === "environments" && <EnvironmentsSection identity={identity} />}
          {active === "identity" && <IdentitySection />}
          {active === "worktrees" && <WorktreesSection onOpenRepository={onOpenRepository} />}
          {active === "integrations" && <IntegrationsSection identity={identity} />}
          </fieldset>
        </div></div>
      </div>

      {showSignOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true" aria-labelledby="sign-out-title">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#18191b] p-5 shadow-2xl">
            <h2 id="sign-out-title" className="text-lg font-semibold">Log out?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">You’ll be logged out of Axiom Agent on this device. Externally running workflows are not canceled.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowSignOut(false)} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-white/[0.05] hover:text-white">Cancel</button>
              <button type="button" onClick={() => void signOut()} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-100">Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GeneralSection({ prefs, onSave }: PreferenceSectionProps) {
  return <div>
    <SectionHeading title="General" detail="Application startup, notifications, and account management." />
    <Group label="Account">
      <ActionRow title="Axiom account" detail="Manage your personal profile in the secure browser." action={<WebButton href="/account" label="Open" />} />
      <ActionRow title="Organization governance" detail="Manage roles, policies, approved integrations, AI authority, and billing in Axiom Control." action={<WebButton href="/control" label="Open control plane" />} />
      <ActionRow title="Workspace access" detail="Review the current plan, verified allowance, and desktop access in Plan & usage." action={<span className="text-xs text-zinc-600">Service verified</span>} />
    </Group>
    <Group label="Notifications">
      <ToggleRow title="System notifications" detail="Notify when an approval or deployment needs attention." enabled={prefs?.notifications_enabled ?? false} disabled={!prefs} onToggle={() => prefs && void onSave({ ...prefs, notifications_enabled: !prefs.notifications_enabled })} action={<button type="button" disabled={!prefs?.notifications_enabled} onClick={() => void notifyResult({ title: "Axiom Agent", body: "Desktop notifications are ready." })} className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white disabled:opacity-40">Test</button>} />
      <LockedRow title="Resume observation after restart" detail="Durable operation IDs are reconciled with the service after the app starts again." />
    </Group>
  </div>;
}

function ProfileSection({ identity, prefs, onSave, onRequestSignOut }: PreferenceSectionProps & { identity: VerifiedDesktopIdentity; onRequestSignOut: () => void }) {
  const email = identity.email ?? (identity.kind === "api_key" ? "Administrator credential" : "Not available");
  const shownEmail = prefs?.hide_email && email.includes("@") ? email.replace(/^(.{2}).*(@.*)$/, "$1••••$2") : email;
  return <div>
    <SectionHeading title="Profile" detail="Account & session identity details are provided by the authenticated web account and cannot be silently changed by the desktop app." />
    <Group label="Verified identity">
      <InfoRow label="Name" value={identity.displayName ?? "Not provided"} />
      <InfoRow label="Email" value={shownEmail} />
      <InfoRow label="Workspace" value={identity.organizationId} mono />
      <InfoRow label="Authentication" value={identity.kind === "desktop_session" ? "Browser-authorized desktop session" : "Enterprise recovery credential"} />
      <ToggleRow title="Hide email address" detail="Partially mask the address in this desktop interface." enabled={prefs?.hide_email ?? false} disabled={!prefs} onToggle={() => prefs && void onSave({ ...prefs, hide_email: !prefs.hide_email })} />
    </Group>
    <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div><p className="text-sm text-zinc-200">Log out on this device</p><p className="mt-1 text-xs text-zinc-500">Removes the local credential from the operating-system vault.</p></div>
      <button type="button" onClick={onRequestSignOut} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]"><LogOut className="h-3.5 w-3.5" />Log out</button>
    </div>
  </div>;
}

function AppearanceSection({ prefs, onSave }: PreferenceSectionProps) {
  return <div>
    <SectionHeading title="Appearance" detail="These choices are stored locally and applied immediately across the installed app." />
    <Group label="Theme">
      <SelectRow title="Theme" detail="Axiom currently ships its audited dark interface." value="dark" disabled options={[{ value: "dark", label: "Axiom Dark" }]} onChange={() => undefined} />
      <SelectRow title="Interface density" detail="Compact reduces global type and control spacing." value={prefs?.interface_density ?? "comfortable"} disabled={!prefs} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} onChange={(value) => prefs && void onSave({ ...prefs, interface_density: value as DesktopPreferences["interface_density"] })} />
    </Group>
    <Group label="Accessibility">
      <ToggleRow title="Reduce motion" detail="Minimizes non-essential interface animation." enabled={prefs?.reduce_motion ?? false} disabled={!prefs} onToggle={() => prefs && void onSave({ ...prefs, reduce_motion: !prefs.reduce_motion })} />
      <ToggleRow title="High contrast" detail="Increases contrast across the application surface." enabled={prefs?.high_contrast ?? false} disabled={!prefs} onToggle={() => prefs && void onSave({ ...prefs, high_contrast: !prefs.high_contrast })} />
    </Group>
  </div>;
}

function PlanSection({ identity }: { identity: VerifiedDesktopIdentity }) {
  const context=desktopClient.config;
  const [attempt,setAttempt]=useState(0);
  const [read,setRead]=useState<{context:typeof context;organizationId:string;data:DesktopUsageSummary|null;error:string|null}|null>(null);
  const current=read&&read.context===context&&read.organizationId===identity.organizationId?read:null;
  const usage=current?.data??null;
  const snapshot=usage?.billingSnapshot;
  const legacy=Boolean(usage&&!snapshot);
  useEffect(()=>{
    let alive=true;
    const organizationId=identity.organizationId;
    setRead({context,organizationId,data:null,error:null});
    void desktopClient.usageSummary().then(result=>{
      if(!alive||context!==desktopClient.config)return;
      const data=result.ok?parseDesktopUsageSummary(result.data):null;
      setRead({context,organizationId,data,error:data?null:"Plan and usage could not be verified. Refresh or review billing in the cockpit."});
    }).catch(()=>{if(alive&&context===desktopClient.config)setRead({context,organizationId,data:null,error:"Plan and usage could not be verified. Refresh or review billing in the cockpit."});});
    const refresh=()=>setAttempt(value=>value+1);
    window.addEventListener("focus",refresh);
    const unsubscribe=desktopClient.subscribeContext?.(refresh);
    return()=>{alive=false;window.removeEventListener("focus",refresh);unsubscribe?.();};
  },[context,identity.organizationId,attempt]);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const access = identity.access;
  async function openBillingPortal() {
    setOpening(true); setError(null);
    try {
      const result = await desktopClient.desktopBillingPortal();
      if (!result.ok) throw new Error(result.error);
      const destination = new URL(result.data.url);
      if (destination.protocol !== "https:" || !(destination.hostname === "stripe.com" || destination.hostname.endsWith(".stripe.com"))) throw new Error("The billing service returned an unexpected destination.");
      await open(destination.toString());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The billing portal could not be opened."); }
    finally { setOpening(false); }
  }
  const isNoPlan = access.billingStatus === "no_plan";
  const isNoChargeAccess = access.allowed && !isNoPlan && (
    (access.planTier === "pilot" && access.billingStatus === "active") ||
    (access.planTier === "trial" && access.billingStatus === "trialing")
  );
  const accessModel = isNoPlan ? "No subscription" : isNoChargeAccess
    ? access.planTier === "trial" ? "No-charge trial" : "No-charge pilot"
    : access.planTier;
  return <div>
    <SectionHeading title="Access & usage" detail="Current plan and AI allowance come from the same billing service as the web cockpit." />
    <div className="mb-4 flex items-center justify-between gap-4 text-xs text-zinc-500"><span>Changes made in the cockpit refresh when this window regains focus.</span><button type="button" disabled={!current||(!usage&&!current.error)} onClick={()=>setAttempt(value=>value+1)} className="shrink-0 text-zinc-200 underline disabled:opacity-40">Refresh plan and usage</button></div>
    <div className="grid gap-4 sm:grid-cols-2">
      {snapshot ? <>
        <SummaryCard label="Workspace plan" value={snapshot.plan.available?snapshot.plan.label:"Unavailable"} detail={snapshot.plan.available?snapshot.plan.status.replaceAll("_"," "):"Current subscription state could not be verified"}/>
        <SummaryCard label="Desktop access" value={access.allowed?"Active":access.title} detail={access.message}/>
      </> : legacy ? <>
        <SummaryCard label="Access model" value={accessModel} detail={access.title} />
        <SummaryCard label="Access state" value={isNoPlan ? "No plan" : isNoChargeAccess ? "Active" : access.billingStatus.replaceAll("_", " ")} detail={isNoPlan ? "Sign-in status does not establish a trial or paid subscription" : isNoChargeAccess ? "Provisioned for this workspace; no billing setup is required" : access.currentPeriodEndsAt ? `Period ends ${new Date(access.currentPeriodEndsAt).toLocaleDateString()}` : "Managed by your workspace agreement"} />
      </> : <>
        <SummaryCard label="Workspace plan" value={current?.error?"Unavailable":"Verifying…"} detail="A current subscription is shown only after the billing service responds"/>
        <SummaryCard label="Desktop access" value={access.allowed?"Active":access.title} detail={access.message}/>
      </>}
    </div>
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
      {snapshot ? <>
        <p className="text-sm text-zinc-200">{snapshot.plan.available?`${snapshot.plan.label} workspace plan`:"Billing verification unavailable"}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Billing records and verified credits are shared with the cockpit. A balance is not permission to run an Agent or bypass approvals.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={()=>void open(`${WEB_BASE}/control/usage-billing`).catch(()=>setError("The billing cockpit could not be opened."))} className="text-xs text-zinc-200 underline">View billing in cockpit</button>
          {snapshot.plan.available&&snapshot.plan.hasCustomer&&snapshot.canManageBilling&&(identity.role==="owner"||identity.role==="admin")&&<button type="button" disabled={opening} onClick={()=>void openBillingPortal()} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50">{opening?"Opening…":"Open billing"}</button>}
        </div>
        {error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
      </> : !legacy ? <div>
        <p className="text-sm text-zinc-200">{current?.error?"Billing verification unavailable":"Verifying current plan and usage…"}</p>
        <button type="button" onClick={()=>void open(`${WEB_BASE}/control/usage-billing`).catch(()=>setError("The billing cockpit could not be opened."))} className="mt-3 text-xs text-zinc-200 underline">View billing in cockpit</button>
        {error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
      </div> : isNoPlan ? (
        <div>
          <p className="text-sm text-zinc-200">No subscription is attached to this workspace</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">{access.allowed ? "Identity sign-in is active." : "Check the service sign-in status."} This billing status does not establish approved trial, pilot, or paid access.</p>
        </div>
      ) : isNoChargeAccess ? (
        <div>
          <p className="text-sm text-zinc-200">{access.planTier === "trial" ? "Trial access is active" : "Pilot access is active"}</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">This workspace has approved no-charge access. No card, Stripe customer, or checkout is needed, and production safeguards remain enforced.</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-5"><div><p className="text-sm text-zinc-200">Manage billing securely</p><p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">A short-lived portal session opens in Stripe. Card data is never collected by this app.</p></div><button type="button" disabled={opening||(identity.role!=="owner"&&identity.role!=="admin")} onClick={() => void openBillingPortal()} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50">{opening ? "Opening…" : "Open billing"}</button></div>
          {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
          <p className="mt-4 border-t border-white/[0.06] pt-4 text-[11px] leading-5 text-zinc-600">A return from Checkout does not grant access by itself. Verified subscription state remains authoritative.</p>
        </>
      )}
    </div>
    {usage&&!snapshot&&<p role="status" className="mt-4 text-xs leading-5 text-amber-200">This service version does not report the current plan or allowance. Review them in the cockpit; the access label above is not a current subscription receipt.</p>}
    <UsageSummaryCard usage={usage} error={current?.error??null}/>
  </div>;
}

function UsageSummaryCard({usage,error}:{usage:DesktopUsageSummary|null;error:string|null}) {
  const allowance=usage?.billingSnapshot?.allowance;
  const money=(cents:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs text-zinc-500">AI usage this month{usage ? ` (${usage.periodMonth})` : ""}</p>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      {!usage && !error && <p className="text-xs text-zinc-600">Loading…</p>}
      {allowance&&<div className="mb-4 grid gap-4 sm:grid-cols-2">
        <SummaryCard label="AI allowance remaining" value={allowance.available?money(allowance.includedRemainingCents):"Unavailable"} detail={allowance.available?`${money(allowance.poolCents)} current account allowance · ${money(allowance.heldCents)} held for unresolved requests`:"No zero balance is inferred when the credit service is unavailable"}/>
        <SummaryCard label="Applied paid top-ups" value={allowance.available?money(allowance.addOnCents):"Unavailable"} detail="Only verified paid records increase available credits"/>
      </div>}
      {usage && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="AI invocations" value={usage.aiInvocationCount.toLocaleString()} detail="Agent + automation calls this billing period" />
          <SummaryCard label="Tokens" value={`${(usage.aiInputTokens + usage.aiOutputTokens).toLocaleString()}`} detail={`${usage.aiInputTokens.toLocaleString()} in / ${usage.aiOutputTokens.toLocaleString()} out`} />
          <SummaryCard label="Attributed cost" value={`$${(usage.aiCostCents / 100).toFixed(2)}`} detail="VisionXIXLabs cost, not necessarily billed to you" />
        </div>
      )}
    </div>
  );
}

function AgentsSection({ prefs, onSave }: PreferenceSectionProps) {
  return <div>
    <SectionHeading title="Agents" detail="Conversation behavior is local. Authorization and production safety remain service enforced." />
    <Group label="Conversation">
      <ToggleRow title="Submit with ⌘ / Ctrl + Enter" detail="Use Command–Enter on Mac or Ctrl–Enter on Windows/Linux to send. Enter adds a new line; Shift–Enter always adds a new line." enabled={prefs?.submit_with_command_enter ?? false} disabled={!prefs} onToggle={() => prefs && void onSave({ ...prefs, submit_with_command_enter: !prefs.submit_with_command_enter })} />
      <SelectRow title="Messages sent while an agent is working" detail="Queue waits for the current operation; Interrupt asks the agent to stop at the next safe boundary." value={prefs?.new_message_behavior ?? "queue"} disabled={!prefs} options={[{ value: "queue", label: "Queue" }, { value: "interrupt", label: "Interrupt" }]} onChange={(value) => prefs && void onSave({ ...prefs, new_message_behavior: value as DesktopPreferences["new_message_behavior"] })} />
      <LockedRow title="Confirm consequential actions" detail="Merge, release, workflow dispatch, environment approval, rollback, and closure require policy checks." />
      <LockedRow title="External-file protection" detail="The customer workspace cannot write outside its approved application scope." />
    </Group>
    <ActionRow title="Workspace Agent policy" detail="Review organization-controlled Agent enablement and allowed tools. Desktop settings do not grant execution authority." action={<WebButton href="/control/ai-agents" label="Open Agent governance" />} />
    <Group label="Specialized Agent profiles">
      {AGENT_PROFILES.map(profile => <div key={profile.id} className="border-b border-white/[0.05] px-4 py-3 last:border-0"><p className="text-xs text-zinc-200">{profile.label}</p><p className="mt-1 text-xs text-zinc-500">{profile.description}</p></div>)}
    </Group>
    <p className="mb-3 text-xs text-zinc-500">Profiles narrow the current workspace tool policy. They do not grant credentials, bypass approval or start independent background workers.</p>
    <WebButton href="/control/ai-agents" label="Manage workspace tool permissions" standalone />
    <Notice title="Execution controls are organization policy" detail="Run mode, allowlists, connector permissions, and approval thresholds are managed by the service. The desktop app does not offer local switches that could weaken them." />
  </div>;
}

const ROLE_OPTIONS: Array<{ value: Exclude<WorkspaceMember["role"], "owner">; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "operator", label: "Operator" },
  { value: "security_reviewer", label: "Security reviewer" },
  { value: "finance_viewer", label: "Finance viewer" },
  { value: "read_only", label: "Read only" },
];

const ROLE_SUMMARIES: Record<WorkspaceMember["role"], string> = {
  owner: "All controls, including admins and emergency production bypass.",
  admin: "Manage policy, integrations, members, GitHub changes, and deployments.",
  operator: "Create branches, commit through governed flows, open PRs, and run approved deployments.",
  security_reviewer: "Read evidence and approve or reject Agent actions; cannot deploy or change code.",
  finance_viewer: "Read workspace access and usage only.",
  read_only: "Read workspace and repository context; no changes or execution.",
};

function PermissionsSection({ identity }: { identity: VerifiedDesktopIdentity }) {
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const canManage = identity.capabilities?.includes("members:manage") ?? false;

  const load = useCallback(() => {
    void desktopClient.listWorkspaceMembers().then((result) => {
      if (result.ok) { setMembers(result.data.members); setCurrentUserId(result.data.currentUserId); setError(null); }
      else setError(result.error);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function changeRole(userId: string, role: Exclude<WorkspaceMember["role"], "owner">) {
    setSavingUserId(userId); setError(null);
    const result = await desktopClient.updateWorkspaceMemberRole(userId, role);
    setSavingUserId(null);
    if (!result.ok) { setError(result.error); return; }
    load();
  }

  return <div>
    <SectionHeading title="Permissions" detail="Give people only the authority they need. Every write, approval, deployment, and emergency bypass is checked by the service." />
    <Notice title={`Your role: ${(identity.role ?? "unassigned").replaceAll("_", " ")}`} detail="Permissions are evaluated from current workspace membership on every request. Removing or changing a role takes effect immediately." />
    {error && <p role="alert" className="mb-4 text-[12px] text-rose-300">{error}</p>}
    <Group label="Workspace members">
      {members === null && !error && <ActionRow title="Loading members…" detail="Reading current workspace authority." action={null} />}
      {(members ?? []).map((member) => {
        const isCurrentUser = member.userId === currentUserId;
        const locked = !canManage || member.role === "owner" || isCurrentUser || savingUserId === member.userId;
        return <ActionRow
          key={member.userId}
          title={member.displayName || member.email}
          detail={`${member.email}${isCurrentUser ? " · You" : ""} · ${ROLE_SUMMARIES[member.role]}`}
          action={member.role === "owner"
            ? <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-400">Owner</span>
            : <select
                aria-label={`Role for ${member.email}`}
                value={member.role}
                disabled={locked}
                onChange={(event) => void changeRole(member.userId, event.target.value as Exclude<WorkspaceMember["role"], "owner">)}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 disabled:opacity-50"
              >
                {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>}
        />;
      })}
    </Group>
    <Group label="Authority model">
      <ActionRow title="Read" detail="Workspace and repository context without changes." action={<span className="text-xs text-zinc-500">All accepted roles</span>} />
      <ActionRow title="Write" detail="Branch, commit, and pull-request actions. Protected by repository scope and approvals." action={<span className="text-xs text-zinc-500">Operator, Admin, Owner</span>} />
      <ActionRow title="Execute" detail="Deploy an already governed commit to its selected environment target." action={<span className="text-xs text-zinc-500">Operator, Admin, Owner</span>} />
      <ActionRow title="Production bypass" detail="Emergency-only direct production execution with a mandatory reason and permanent audit record." action={<span className="text-xs text-amber-300">Admin, Owner</span>} />
    </Group>
  </div>;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI GPT",
  anthropic: "Anthropic Claude",
  github_models: "GitHub Models",
  ollama: "Ollama",
  lm_studio: "LM Studio",
  groq: "Groq",
  hugging_face: "Hugging Face",
  openrouter: "OpenRouter",
  gemini: "Google Gemini",
  cloudflare: "Cloudflare Workers AI",
  xai: "xAI",
};

function ModelsSection() {
  const [providers, setProviders] = useState<ProviderModels[] | null>(null);
  const [policy, setPolicy] = useState<ModelPolicy | null>(null);
  const [query, setQuery] = useState("");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [catalogPage, setCatalogPage] = useState(0);
  const [savingModel, setSavingModel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const policyContext = useRef<typeof desktopClient.config | null>(null);

  useEffect(() => {
    let cancelled = false;
    policyContext.current = null;
    setSavingModel(null);
    setLoadError(null);
    setProviders(null);
    setPolicy(null);
    const context = desktopClient.config;
    void desktopClient.aiProviderStatus()
      .then((result) => {
        if (cancelled || context !== desktopClient.config) return;
        if (result.ok) {
          const status = normalizeAiProviderStatus(result.data);
          if (!status) {
            setProviders([]);
            setLoadError("The service returned an unsupported model configuration. Update the app or try again later.");
            return;
          }
          policyContext.current = context;
          setProviders(status.providers);
          setPolicy(status.policy);
          setLoadError(null);
        } else {
          setLoadError(
            result.error === "desktop_session_required"
              ? "Your sign-in needs to refresh. Try signing out and back in."
              : "Could not load provider availability. Try again later.",
          );
        }
      })
      .catch(() => {
        if (!cancelled && context === desktopClient.config) setLoadError("Could not load provider availability. Try again later.");
      });
    return () => { cancelled = true; policyContext.current = null; };
  }, [attempt]);

  const rows = useMemo(() => {
    const listed = (providers ?? []).flatMap(provider => provider.models.map(model => ({ ...model, provider: provider.provider, available: true, managed: provider.provider === "vercel_gateway" && !isConcreteGatewayModelId(model.id) })));
    const approved = policy?.enabled && policy.allowedProviders.includes("vercel_gateway")
      ? policy.gatewaySelection?.approvedModelIds ?? (policy.modelSelections.vercel_gateway ? [policy.modelSelections.vercel_gateway] : []) : [];
    for (const id of approved) {
      if (!listed.some(model => model.provider === "vercel_gateway" && model.id === id)) listed.push({ id, label: id, tier: isConcreteGatewayModelId(id) ? "Unavailable in current catalog · removal only" : "Service-managed legacy route", provider: "vercel_gateway", available: false, managed: !isConcreteGatewayModelId(id) });
    }
    return listed.filter(model => {
      const needle = query.trim().toLowerCase();
      return (!approvedOnly || Boolean(policy && isModelApproved(policy, model.provider, model.id))) && (!needle || `${model.label} ${model.id} ${PROVIDER_LABELS[model.provider] ?? model.provider}`.toLowerCase().includes(needle));
    });
  }, [providers, query, policy, approvedOnly]);

  const safeCatalogPage = Math.min(catalogPage, Math.max(0, Math.ceil(rows.length / 50) - 1));
  const catalogOffset = safeCatalogPage * 50;
  const gatewayCatalog = providers?.find(provider => provider.provider === "vercel_gateway")?.models.map(model => model.id) ?? [];
  const gatewayApprovals = policy?.gatewaySelection?.approvedModelIds ?? (policy?.enabled && policy.allowedProviders.includes("vercel_gateway") && policy.modelSelections.vercel_gateway ? [policy.modelSelections.vercel_gateway] : []);
  const unavailableApprovalCount = gatewayApprovals.filter(id => isConcreteGatewayModelId(id) && !gatewayCatalog.includes(id)).length;
  async function removeUnavailable() {
    if (!policy || savingModel || providers === null || loadError !== null) return;
    const nextPolicy = removeUnavailableGatewayApprovals(policy, gatewayCatalog);
    if (nextPolicy) await saveModelPolicy(nextPolicy, "vercel_gateway:remove-unavailable");
  }

  async function toggleModel(provider: string, modelId: string) {
    if (!policy || savingModel) return;
    const nextPolicy = toggleApprovedModel(policy, provider, modelId);
    if (!nextPolicy) { setLoadError("Approve up to 32 concrete Gateway models. Your previous policy is unchanged."); return; }
    await saveModelPolicy(nextPolicy, `${provider}:${modelId}`);
  }
  async function makeDefault(modelId: string) {
    if (!policy || savingModel) return;
    const nextPolicy = setApprovedGatewayDefault(policy, modelId);
    if (nextPolicy) await saveModelPolicy(nextPolicy, `vercel_gateway:${modelId}`);
  }
  async function saveModelPolicy(nextPolicy: ModelPolicy, key: string) {
    const context = policyContext.current;
    const clearStalePolicy = () => { policyContext.current = null; setPolicy(null); setProviders([]); setSavingModel(null); setLoadError("Your workspace changed. Reload model settings before saving."); };
    if (!context || context !== desktopClient.config) { clearStalePolicy(); return; }
    setSavingModel(key);
    setLoadError(null);
    try {
      const result = await desktopClient.updateAiProviderPolicy(nextPolicy);
      if (context !== desktopClient.config || policyContext.current !== context) {
        if (policyContext.current === context) clearStalePolicy();
        return;
      }
      if (result.ok) {
        const status = normalizeAiProviderStatus({ providers: providers ?? [], policy: result.data.policy });
        if (status) setPolicy(status.policy);
        else setLoadError("The service returned an unsupported model configuration. Your previous selection is unchanged.");
      } else {
        setLoadError(result.error === "workspace_admin_required" ? "Only a workspace administrator can change model availability." : result.error);
      }
    } catch {
      if (context !== desktopClient.config || policyContext.current !== context) {
        if (policyContext.current === context) clearStalePolicy();
        return;
      }
      setLoadError("Could not save model availability. Try again later.");
    } finally {
      if (policyContext.current === context) setSavingModel(null);
    }
  }

  return <div>
    <SectionHeading title="Models" detail="Choose which service-configured models the Agent may use. Turning a model on updates the workspace policy immediately." />
    <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <div className="border-b border-white/[0.06] p-4">
        <label htmlFor="model-search" className="sr-only">Search models</label>
        <input id="model-search" maxLength={200} value={query} onChange={(event) => { setQuery(event.target.value); setCatalogPage(0); }} placeholder="Add or search model" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25" />
        <div className="mt-3 flex gap-2" role="group" aria-label="Model catalog filters">{[false, true].map(approved => <button key={String(approved)} type="button" aria-pressed={approvedOnly === approved} onClick={() => { setApprovedOnly(approved); setCatalogPage(0); }} className={`rounded-md px-2.5 py-1.5 text-[11px] ${approvedOnly === approved ? "bg-white/10 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}>{approved ? "Approved models" : "All models"}</button>)}</div>
        <p className="mt-2 text-[11px] text-zinc-600">Gateway supports up to 32 approved models. Agent chat starts with the workspace default; choose another approved model in the composer. Search a model name or catalog ID, including Grok. Other providers retain one active model.</p>
      </div>
      {providers !== null && loadError === null && unavailableApprovalCount > 0 && <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4 text-xs text-zinc-400"><p>{unavailableApprovalCount} approved Gateway model{unavailableApprovalCount === 1 ? " is" : "s are"} unavailable in the current catalog.</p><button type="button" disabled={Boolean(savingModel)} onClick={() => void removeUnavailable()} className="shrink-0 text-zinc-200 underline underline-offset-2 disabled:opacity-45">Remove unavailable approvals</button></div>}
      {providers === null && loadError === null && <p className="p-4 text-sm text-zinc-500">Checking service-configured models…</p>}
      {loadError !== null && <div role="alert" className="flex items-center justify-between gap-4 p-4 text-sm text-rose-300"><p>{loadError}</p><button type="button" onClick={() => setAttempt((current) => current + 1)} className="shrink-0 text-xs text-zinc-300 underline underline-offset-2">Retry models</button></div>}
      {providers !== null && loadError === null && rows.length === 0 && <p className="p-4 text-sm text-zinc-500">{providers.every((provider) => provider.models.length === 0) ? "No service-configured models are available. Ask a workspace administrator to review service setup." : "No configured model matches this search."}</p>}
      {rows.slice(catalogOffset, catalogOffset + 50).map((model) => {
        const enabled = Boolean(policy && isModelApproved(policy, model.provider, model.id));
        const gatewayDefault = model.provider === "vercel_gateway" && policy?.enabled && policy.modelSelections.vercel_gateway === model.id;
        const key = `${model.provider}:${model.id}`;
        return <div key={key} className="flex items-center justify-between gap-4 border-b border-white/[0.055] px-4 py-3.5 last:border-b-0">
          <div className="min-w-0"><p className="text-sm text-zinc-200">{model.label}{gatewayDefault && <span className="ml-2 text-[10px] text-orange-300">Workspace default</span>}</p><p className="mt-0.5 text-[11px] text-zinc-600">{PROVIDER_LABELS[model.provider] ?? model.provider} · {model.managed ? "Service-managed legacy route" : model.tier}</p></div>
          <div className="flex shrink-0 items-center gap-3">
            {model.provider === "vercel_gateway" && model.available && enabled && !gatewayDefault && <button type="button" aria-label={`Make ${model.label} workspace default`} disabled={Boolean(savingModel)} onClick={() => void makeDefault(model.id)} className="text-xs text-zinc-300 underline underline-offset-2 disabled:opacity-45">Make default</button>}
          <button type="button" role="switch" aria-checked={enabled} aria-label={model.available || model.managed ? `${enabled ? "Disable" : "Enable"} ${model.label}` : `Remove unavailable approval ${model.id}`} disabled={!policy || Boolean(savingModel) || model.provider === "vercel_gateway" && !isConcreteGatewayModelId(model.id) && !enabled} onClick={() => void toggleModel(model.provider, model.id)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-45 ${enabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
            <span aria-hidden className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          </div>
        </div>;
      })}
      {rows.length > 50 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 text-xs text-zinc-400">
        <p role="status">Showing {catalogOffset + 1}–{Math.min(catalogOffset + 50, rows.length)} of {rows.length} models. Search includes the full catalog.</p>
        <div className="flex gap-3">
          <button type="button" disabled={safeCatalogPage === 0} onClick={() => setCatalogPage(safeCatalogPage - 1)} className="rounded-md border border-white/10 px-3 py-1.5 hover:text-white disabled:opacity-40">Previous models</button>
          <button type="button" disabled={catalogOffset + 50 >= rows.length} onClick={() => setCatalogPage(safeCatalogPage + 1)} className="rounded-md border border-white/10 px-3 py-1.5 hover:text-white disabled:opacity-40">Next models</button>
        </div>
      </div>}
    </div>
    <p className="mt-4 text-[11px] leading-5 text-zinc-600">Removing the Gateway default promotes the first remaining approval; removing its last approval disables Gateway. Credentials remain server-managed and never reach this device. Write actions remain approval-gated regardless of model choice.</p>
  </div>;
}

function GitSection() {
  return <div>
    <SectionHeading title="Git & PRs" detail="Clone connected repositories and prepare pull requests. Repository access and branch policies remain separately permissioned." />
    <CloneRepositoryPanel />
    <CreatePullRequestPanel />
    <RepositoriesPanel />
    <BranchPoliciesPanel />
  </div>;
}

/**
 * Clones a tenant-connected repository to a local folder. The server
 * mints a short-lived, repo-scoped GitHub App installation token
 * embedded in the clone URL (POST /api/desktop/github/clone-token) —
 * this process never sees or stores a long-lived credential, and the
 * Rust side (desktop/src-tauri/src/git.rs) scrubs the token from any
 * error text before it reaches this view.
 */
function CloneRepositoryPanel() {
  const [repositoryFullName, setRepositoryFullName] = useState("");
  const [destination, setDestination] = useState("");
  const [status, setStatus] = useState<"idle" | "cloning" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [clonedPath, setClonedPath] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>("default_repos_directory").then((dir) => {
      setDestination((current) => current || dir);
    }).catch(() => undefined);
  }, []);

  async function cloneRepository() {
    setStatus("cloning");
    setError(null);
    setClonedPath(null);
    try {
      const tokenResult = await desktopClient.mintGithubCloneToken({ repositoryFullName });
      if (!tokenResult.ok) throw new Error(tokenResult.error);
      const repoName = repositoryFullName.split("/")[1] ?? repositoryFullName;
      const fullDestination = `${destination.replace(/\/$/, "")}/${repoName}`;
      await invoke<string>("clone_repository", { cloneUrl: tokenResult.data.cloneUrl, destinationPath: fullDestination });
      setClonedPath(fullDestination);
      setStatus("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("idle");
    }
  }

  return (
    <Group label="Clone a repository locally">
      <div className="px-4 py-3.5 space-y-3">
        <LabeledInput label="Repository" placeholder="owner/repo" value={repositoryFullName} onChange={setRepositoryFullName} />
        <LabeledInput label="Destination folder" placeholder="~/AxiomAgent/repos" value={destination} onChange={setDestination} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void cloneRepository()}
            disabled={status === "cloning" || !repositoryFullName.includes("/") || !destination}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50"
          >
            {status === "cloning" ? "Cloning…" : "Clone repository"}
          </button>
          {status === "done" && clonedPath && <span className="text-[12px] text-emerald-300">Cloned to {clonedPath}</span>}
        </div>
        {error && <p role="alert" className="text-[12px] text-rose-300">{error}</p>}
      </div>
    </Group>
  );
}

/**
 * Creates a branch, commits a single file to it, and opens a real pull
 * request — chained in sequence against the tenant's connected GitHub
 * installation. Each step is admin-gated and audited server-side
 * (app/api/desktop/github/{branch,commit,pull-request}/route.ts); this
 * view only orchestrates the sequence and reports exactly which step
 * succeeded if one fails partway through, rather than leaving the user
 * guessing whether anything happened.
 */
function CreatePullRequestPanel() {
  const [repositoryFullName, setRepositoryFullName] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [newBranchName, setNewBranchName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [step, setStep] = useState<"idle" | "branch" | "commit" | "pull_request" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  const busy = step !== "idle" && step !== "done";
  const canSubmit = [repositoryFullName, baseBranch, newBranchName, filePath, fileContent, commitMessage, prTitle]
    .every((value) => value.trim().length > 0) && repositoryFullName.includes("/");

  const activeRequest = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function submit() {
    if (activeRequest.current || !canSubmit) return;
    activeRequest.current = true;
    const context = desktopClient.config;
    const request = { repositoryFullName, baseBranch, newBranchName, filePath, fileContent, commitMessage, prTitle, prBody };
    let phase: "branch" | "commit" | "pull_request" = "branch";
    const stillCurrent = () => {
      if (!mounted.current) return false;
      if (desktopClient.config === context) return true;
      setError("Your workspace changed. No further writes were sent. Review the branch, commit and PR state in the original workspace before starting again; the last request may already have completed.");
      return false;
    };
    const failed = () => setError(phase === "branch"
      ? "Branch creation was not confirmed. Inspect the original repository before retrying; the branch may already exist. No commit or PR request was sent."
      : phase === "commit"
        ? "The branch was created, but the commit was not confirmed. Inspect the original branch before retrying; the commit may already exist. No PR request was sent."
        : "The branch and commit succeeded, but PR creation was not confirmed. Inspect the original repository before retrying; the PR may already exist.");
    setError(null);
    setPrUrl(null);
    setStep("branch");
    try {
      const branchResult = await desktopClient.createGithubBranch({ repositoryFullName: request.repositoryFullName, baseBranch: request.baseBranch, newBranchName: request.newBranchName });
      if (!stillCurrent()) return;
      if (!branchResult.ok) { failed(); return; }
      phase = "commit";
      setStep(phase);
      const commitResult = await desktopClient.commitGithubFile({ repositoryFullName: request.repositoryFullName, branch: request.newBranchName, path: request.filePath, content: request.fileContent, message: request.commitMessage });
      if (!stillCurrent()) return;
      if (!commitResult.ok) { failed(); return; }
      phase = "pull_request";
      setStep(phase);
      const prResult = await desktopClient.openGithubPullRequest({ repositoryFullName: request.repositoryFullName, head: request.newBranchName, base: request.baseBranch, title: request.prTitle, body: request.prBody });
      if (!stillCurrent()) return;
      if (!prResult.ok) { failed(); return; }
      setPrUrl(prResult.data.htmlUrl);
    } catch {
      if (stillCurrent()) failed();
    } finally {
      activeRequest.current = false;
      if (mounted.current) setStep("idle");
    }
  }

  return (
    <Group label="Create a pull request">
      <div className="px-4 py-3.5 space-y-3">
        <LabeledInput disabled={busy} label="Repository" placeholder="owner/repo" value={repositoryFullName} onChange={setRepositoryFullName} />
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput disabled={busy} label="Base branch" placeholder="main" value={baseBranch} onChange={setBaseBranch} />
          <LabeledInput disabled={busy} label="New branch name" placeholder="axiom/my-change" value={newBranchName} onChange={setNewBranchName} />
        </div>
        <LabeledInput disabled={busy} label="File path" placeholder="path/to/file.ts" value={filePath} onChange={setFilePath} />
        <LabeledTextArea disabled={busy} label="File content" value={fileContent} onChange={setFileContent} />
        <LabeledInput disabled={busy} label="Commit message" placeholder="Describe the change" value={commitMessage} onChange={setCommitMessage} />
        <LabeledInput disabled={busy} label="Pull request title" placeholder="Short summary" value={prTitle} onChange={setPrTitle} />
        <LabeledTextArea disabled={busy} label="Pull request description" value={prBody} onChange={setPrBody} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50"
          >
            {step === "branch" ? "Creating branch…" : step === "commit" ? "Committing file…" : step === "pull_request" ? "Opening pull request…" : "Create pull request"}
          </button>
          {prUrl && <a href={prUrl} target="_blank" rel="noreferrer" className="text-[12px] text-emerald-300 underline">View pull request on GitHub</a>}
        </div>
        {error && <p role="alert" className="text-[12px] text-rose-300 leading-5">{error}</p>}
      </div>
    </Group>
  );
}

/**
 * Environments & AWS deploy — moved here from the hosted web dashboard
 * because the service deliberately never renders live-operations pages
 * in a browser (the "downloadable app is the canonical operational
 * product" rule). Lists/creates Environment rows, configures the AWS
 * ECS deploy target per environment (role ARN never leaves this device
 * except in the POST body to the server that stores it), and triggers a
 * real deploy by dispatching the tenant's own GitHub Actions workflow.
 */
const STANDARD_ENVIRONMENTS = [
  { slug: "dev", name: "Development", tier: "dev" },
  { slug: "test", name: "Testing", tier: "test" },
  { slug: "prod", name: "Production", tier: "prod" },
];

interface EnvironmentListItem {
  id: string; slug: string; name: string; tier: string; displayOrder: number; hasApprovalPolicy: boolean;
}

function EnvironmentsSection({ identity }: { identity: VerifiedDesktopIdentity }) {
  const [environments, setEnvironments] = useState<EnvironmentListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(() => {
    void desktopClient.listEnvironments().then((result) => {
      if (result.ok) { setEnvironments(result.data.environments); setLoadError(null); }
      else setLoadError(result.error);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createStandardSet() {
    setCreating(true);
    setCreateError(null);
    try {
      const existingSlugs = new Set((environments ?? []).map((e) => e.slug));
      for (const env of STANDARD_ENVIRONMENTS) {
        if (existingSlugs.has(env.slug)) continue;
        const result = await desktopClient.createEnvironment(env);
        if (!result.ok) { setCreateError(`${env.name}: ${result.error}`); return; }
      }
      load();
    } finally {
      setCreating(false);
    }
  }

  const missing = STANDARD_ENVIRONMENTS.filter((s) => !(environments ?? []).some((e) => e.slug === s.slug));

  return (
    <div>
      <SectionHeading title="Environments" detail="Choose where a verified commit runs. Development, testing, and production each map to their own cloud target; production additionally requires PR evidence, passing tests, and promotion of the exact commit." />
      <Notice title="A safe path by default" detail="Code moves through branch → pull request → verified development deploy → test → production. Selecting an environment never changes another environment's target." />
      {loadError && <p role="alert" className="mb-4 text-[12px] text-rose-300">{loadError}</p>}
      <Group label="Workspace environments">
        {environments === null && loadError === null && <ActionRow title="Loading…" detail="Checking your workspace's configured environments." action={null} />}
        {environments !== null && environments.length === 0 && (
          <ActionRow
            title="No environments yet"
            detail="Create the standard dev/test/prod set, or add one manually below."
            action={
              <button type="button" onClick={() => void createStandardSet()} disabled={creating} className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50">
                {creating ? "Creating…" : "Create dev/test/prod"}
              </button>
            }
          />
        )}
        {environments !== null && environments.length > 0 && missing.length > 0 && (
          <ActionRow
            title="Missing standard environments"
            detail={`Not yet configured: ${missing.map((s) => s.slug).join(", ")}`}
            action={
              <button type="button" onClick={() => void createStandardSet()} disabled={creating} className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50">
                {creating ? "Creating…" : "Add missing"}
              </button>
            }
          />
        )}
        {createError && <div className="px-4 py-2 text-[12px] text-rose-300">{createError}</div>}
        {(environments ?? []).map((env) => (
          <div key={env.id} className="border-b border-white/[0.045] last:border-b-0">
            <ActionRow
              title={`${env.name} (${env.tier})`}
              detail={`slug: ${env.slug}${env.hasApprovalPolicy ? " · approval policy attached" : ""}`}
              action={
                <button type="button" onClick={() => setExpandedId(expandedId === env.id ? null : env.id)} className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.06]">
                  {expandedId === env.id ? "Hide" : "AWS deploy"}
                </button>
              }
            />
            {expandedId === env.id && <DeploymentTargetPanel environment={env} environments={environments ?? []} identity={identity} />}
          </div>
        ))}
      </Group>
      <NewEnvironmentForm onCreated={load} />
    </div>
  );
}

function NewEnvironmentForm({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [tier, setTier] = useState("dev");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit() {
    setBusy(true); setError(null); setOk(false);
    try {
      const result = await desktopClient.createEnvironment({ slug, name, tier });
      if (!result.ok) { setError(result.error); return; }
      setOk(true);
      setSlug(""); setName("");
      onCreated();
      setTimeout(() => setOk(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Group label="New environment">
      <div className="px-4 py-3.5 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <LabeledInput label="Slug" placeholder="staging" value={slug} onChange={setSlug} />
          <LabeledInput label="Display name" placeholder="Staging" value={name} onChange={setName} />
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Tier</span>
            <select value={tier} onChange={(event) => setTier(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
              {["dev", "test", "qa", "uat", "stage", "preprod", "prod"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void submit()} disabled={busy || !slug || !name} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50">
            {busy ? "Creating…" : "Create environment"}
          </button>
          {ok && <span className="text-[12px] text-emerald-300">Created</span>}
        </div>
        {error && <p role="alert" className="text-[12px] text-rose-300">{error}</p>}
      </div>
    </Group>
  );
}

function DeploymentTargetPanel({ environment, environments, identity }: { environment: EnvironmentListItem; environments: EnvironmentListItem[]; identity: VerifiedDesktopIdentity }) {
  const environmentId = environment.id;
  const [roleArn, setRoleArn] = useState("");
  const [region, setRegion] = useState("");
  const [ecsCluster, setEcsCluster] = useState("");
  const [ecsService, setEcsService] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const [deployRepo, setDeployRepo] = useState("");
  const deployOperationRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [deployRepositories, setDeployRepositories] = useState<Array<{ id: string; displayName: string; provider: string }>>([]);
  const [sourceRef, setSourceRef] = useState("main");
  const [sourceKind, setSourceKind] = useState<"branch" | "tag">("branch");
  const [pullRequestNumber, setPullRequestNumber] = useState("");
  const [promotedFromExecutionId, setPromotedFromExecutionId] = useState("");
  const [successfulExecutions, setSuccessfulExecutions] = useState<DeploymentExecution[]>([]);
  const [emergencyBypass, setEmergencyBypass] = useState(false);
  const [bypassReason, setBypassReason] = useState("");
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{ policyId: string | null; sourceCommitSha: string; pullRequestUrl: string | null; governanceMode: "policy_enforced" | "emergency_bypass" } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployOk, setDeployOk] = useState(false);
  const [execution, setExecution] = useState<DeploymentExecution | null>(null);
  const [refreshingExecution, setRefreshingExecution] = useState(false);
  const [observationError, setObservationError] = useState<{ executionId: string; message: string } | null>(null);
  const observationEpoch = useRef(0);
  const executionId = execution?.id;
  const observation = execution ? deploymentObservationState(execution) : null;
  const canObserve = execution?.environmentId === environmentId && observation?.canPoll === true;

  useEffect(() => {
    const epoch = ++observationEpoch.current;
    setRefreshingExecution(false);
    setObservationError(null);
    void Promise.all([
      desktopClient.getDeploymentTarget(environmentId),
      desktopClient.listDeploymentExecutions(),
      desktopClient.listRepositories(),
    ]).then(([result, executions, repositories]) => {
      if (epoch !== observationEpoch.current) return;
      if (result.ok) {
        if (result.data.target) {
          setRoleArn(result.data.target.roleArn);
          setRegion(result.data.target.region);
          setEcsCluster(result.data.target.ecsCluster);
          setEcsService(result.data.target.ecsService);
        }
      } else {
        setLoadError(result.error);
      }
      if (executions.ok) {
        setExecution(executions.data.executions.find((item) => item.environmentId === environmentId) ?? null);
        setSuccessfulExecutions(executions.data.executions.filter((item) => item.environmentId !== environmentId && item.status === "completed" && item.conclusion === "success" && Boolean(item.sourceCommitSha)));
      }
      if (repositories.ok) {
        const githubRepositories = repositories.data.repositories.filter((repository) => repository.provider === "github");
        setDeployRepositories(githubRepositories);
        setDeployRepo((current) => current || githubRepositories[0]?.displayName || "");
      }
      setLoaded(true);
    });
    return () => { observationEpoch.current += 1; };
  }, [environmentId]);

  useEffect(() => {
    if (!executionId || !canObserve) return;
    let cancelled = false;
    const observe = async () => {
      const result = await desktopClient.observeDeploymentExecution(executionId);
      if (!cancelled && result.ok) setExecution(result.data);
    };
    void observe();
    const timer = window.setInterval(() => void observe(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [executionId, canObserve]);

  async function refreshExecution() {
    if (!executionId) return;
    const epoch = observationEpoch.current;
    setRefreshingExecution(true);
    setObservationError(null);
    try {
      const result = await desktopClient.observeDeploymentExecution(executionId);
      if (epoch !== observationEpoch.current) return;
      if (result.ok) setExecution((current) => current?.id === executionId ? result.data : current);
      else setObservationError({ executionId, message: result.error });
    } catch {
      if (epoch === observationEpoch.current) setObservationError({ executionId, message: "Status could not be refreshed. The recorded outcome is unchanged." });
    } finally {
      if (epoch === observationEpoch.current) setRefreshingExecution(false);
    }
  }

  async function save() {
    setSaving(true); setSaveError(null); setSaveOk(false);
    try {
      const result = await desktopClient.saveDeploymentTarget({ environmentId, roleArn, region, ecsCluster, ecsService });
      if (!result.ok) { setSaveError(result.error); return; }
      // A readiness result is only valid for the deployment target that was checked.
      setReadiness(null);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  async function triggerDeploy() {
    setDeploying(true); setDeployError(null); setDeployOk(false);
    try {
      const parsedPullRequestNumber = pullRequestNumber.trim() ? Number(pullRequestNumber) : undefined;
      if (parsedPullRequestNumber !== undefined && (!Number.isInteger(parsedPullRequestNumber) || parsedPullRequestNumber <= 0)) {
        setDeployError("Pull request number must be a positive whole number.");
        return;
      }
      const fingerprint = JSON.stringify({ repositoryFullName: deployRepo, environmentId, sourceRef, sourceKind, parsedPullRequestNumber, promotedFromExecutionId, emergencyBypass, bypassReason });
      if (deployOperationRef.current?.fingerprint !== fingerprint) {
        deployOperationRef.current = { fingerprint, key: crypto.randomUUID() };
      }
      const result = await desktopClient.triggerAwsDeploy({
        repositoryFullName: deployRepo,
        environmentId,
        sourceRef,
        sourceKind,
        ...(parsedPullRequestNumber !== undefined ? { pullRequestNumber: parsedPullRequestNumber } : {}),
        ...(promotedFromExecutionId ? { promotedFromExecutionId } : {}),
        ...(emergencyBypass ? { emergencyBypass: true, bypassReason } : {}),
        idempotencyKey: deployOperationRef.current.key,
      });
      if (!result.ok) {
        setDeployError(result.error === "deployment_outcome_unknown"
          ? "Deployment outcome unconfirmed. The provider may have accepted it; its hold is retained. Review the external outcome before retrying."
          : result.error === "deployment_already_in_progress"
            ? "This deployment is still in progress or awaiting outcome verification. Its hold prevents another dispatch."
            : result.error);
        return;
      }
      deployOperationRef.current = null;
      setDeployOk(true);
      setExecution(result.data.execution ? { ...result.data.execution, evidence: result.data.evidence ?? result.data.execution.evidence } : null);
    } finally {
      setDeploying(false);
    }
  }

  async function checkReadiness() {
    setCheckingReadiness(true); setReadinessError(null); setReadiness(null);
    try {
      const parsedPullRequestNumber = pullRequestNumber.trim() ? Number(pullRequestNumber) : undefined;
      if (parsedPullRequestNumber !== undefined && (!Number.isInteger(parsedPullRequestNumber) || parsedPullRequestNumber <= 0)) {
        setReadinessError("Pull request number must be a positive whole number.");
        return;
      }
      const result = await desktopClient.preflightAwsDeploy({
        repositoryFullName: deployRepo,
        environmentId,
        sourceRef,
        sourceKind,
        ...(parsedPullRequestNumber !== undefined ? { pullRequestNumber: parsedPullRequestNumber } : {}),
        ...(promotedFromExecutionId ? { promotedFromExecutionId } : {}),
        ...(emergencyBypass ? { emergencyBypass: true, bypassReason } : {}),
      });
      if (!result.ok) { setReadinessError(result.error); return; }
      setReadiness(result.data);
    } finally {
      setCheckingReadiness(false);
    }
  }

  if (!loaded) return <div className="px-4 py-3 text-[12px] text-zinc-500">Loading deploy target…</div>;
  if (loadError) return <div className="px-4 py-3 text-[12px] text-rose-300">{loadError}</div>;

  return (
    <div className="border-t border-white/[0.04] bg-black/20 px-4 py-3.5 space-y-3">
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-[12px] text-zinc-400">
        <span className="font-medium text-zinc-200">{environment.name}</span> deploys only to <span className="font-mono text-zinc-300">{region || "region"} / {ecsCluster || "cluster"} / {ecsService || "service"}</span>.
        {environment.tier === "prod" ? " Production is fail-closed until the full promotion evidence is valid." : " Changes remain isolated from production."}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="Role ARN" placeholder="arn:aws:iam::123456789012:role/axiom-deploy" value={roleArn} onChange={setRoleArn} />
        <LabeledInput label="Region" placeholder="us-east-2" value={region} onChange={setRegion} />
        <LabeledInput label="ECS cluster" placeholder="axiom-prod-cluster" value={ecsCluster} onChange={setEcsCluster} />
        <LabeledInput label="ECS service" placeholder="axiom-web-service" value={ecsService} onChange={setEcsService} />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={saving || !roleArn || !region || !ecsCluster || !ecsService} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50">
          {saving ? "Saving…" : "Save deploy target"}
        </button>
        {saveOk && <span className="text-[12px] text-emerald-300">Saved</span>}
      </div>
      {saveError && <p role="alert" className="text-[12px] text-rose-300">{saveError}</p>}

      <div className="mt-2 border-t border-white/[0.04] pt-3">
        <p className="mb-2 text-[11px] text-zinc-500">
          Add .github/workflows/axiom-deploy-aws-ecs.yml to the target repo once (see the Git &amp; PRs section to commit it via a pull request), then dispatch that workflow here. The bundled four-input template requests an ECS service restart; it does not release a new source artifact. Installed custom workflow behavior remains unverified.
        </p>
        <div className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[1.4fr_1fr_0.65fr_0.65fr_auto_auto]">
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Repository</span>
            <select value={deployRepo} onChange={(event) => { setDeployRepo(event.target.value); setReadiness(null); }} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
              {deployRepositories.length === 0 && <option value="">Register a GitHub repository first</option>}
              {deployRepositories.map((repository) => <option key={repository.id} value={repository.displayName}>{repository.displayName}</option>)}
            </select>
          </label>
          <LabeledInput label="Workflow source branch or tag" placeholder="main or v1.2.3" value={sourceRef} onChange={(value) => { setSourceRef(value); setReadiness(null); }} />
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Source type</span>
            <select value={sourceKind} onChange={(event) => { setSourceKind(event.target.value as "branch" | "tag"); setReadiness(null); }} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
              <option value="branch">Branch</option>
              <option value="tag">Tag</option>
            </select>
          </label>
          <LabeledInput label="PR number" placeholder="optional" value={pullRequestNumber} onChange={(value) => { setPullRequestNumber(value); setReadiness(null); }} />
          <button type="button" onClick={() => void checkReadiness()} disabled={checkingReadiness || deploying || !deployRepo || !sourceRef.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50 shrink-0">
            {checkingReadiness ? "Checking…" : "Check readiness"}
          </button>
          <button type="button" onClick={() => void triggerDeploy()} disabled={deploying || !deployRepo.includes("/") || !sourceRef.trim() || !readiness || (emergencyBypass && bypassReason.trim().length < 20)} title={readiness ? "Dispatch the policy-checked workflow; artifact release remains unverified" : "Check workflow policy before dispatch"} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/[0.14] disabled:opacity-50 shrink-0">
            {deploying ? "Dispatching…" : "Dispatch workflow"}
          </button>
        </div>
        {environment.tier !== "dev" && <p className="mt-3 text-[11px] text-zinc-500">A successful workflow is not source-artifact promotion evidence. Promotion remains blocked until artifact identity and provenance are verified.</p>}
        {environment.tier !== "dev" && (
          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] text-zinc-500">Prior workflow receipt (not verified artifact promotion)</span>
            <select value={promotedFromExecutionId} onChange={(event) => { setPromotedFromExecutionId(event.target.value); setReadiness(null); }} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
              <option value="">Select a prior workflow receipt…</option>
              {successfulExecutions.map((item) => {
                const sourceEnvironment = environments.find((candidate) => candidate.id === item.environmentId);
                return <option key={item.id} value={item.id}>{sourceEnvironment?.name ?? "Prior environment"} · {item.repositoryFullName} · {item.sourceCommitSha?.slice(0, 12)}</option>;
              })}
            </select>
          </label>
        )}
        {environment.tier === "prod" && identity.capabilities?.includes("deploy:production_bypass") && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
            <label className="flex items-start gap-2 text-xs text-amber-200">
              <input type="checkbox" checked={emergencyBypass} onChange={(event) => { setEmergencyBypass(event.target.checked); setReadiness(null); }} className="mt-0.5" />
              <span><strong>Emergency production bypass</strong><br /><span className="text-amber-200/70">Skips normal promotion evidence. Admin-only, reason required, and permanently audited.</span></span>
            </label>
            {emergencyBypass && <textarea aria-label="Emergency bypass reason" value={bypassReason} onChange={(event) => { setBypassReason(event.target.value); setReadiness(null); }} placeholder="Explain the incident and why the normal release path cannot be used (minimum 20 characters)." className="mt-3 min-h-20 w-full rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none" />}
          </div>
        )}
        {readinessError && <p role="alert" className="mt-2 text-[12px] text-rose-300">{readinessError}</p>}
        {readiness && (
          <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-[12px] text-emerald-200">
            Workflow policy check passed for source <span className="font-mono">{readiness.sourceCommitSha.slice(0, 12)}</span>
            {readiness.governanceMode === "emergency_bypass" ? " · emergency admin bypass will be audited" : readiness.policyId ? " · configured branch policy satisfied" : " · development target verified"}
            {readiness.pullRequestUrl && <> · <button type="button" onClick={() => void open(readiness.pullRequestUrl!)} className="underline underline-offset-2">verified pull request</button></>}
          </div>
        )}
        {deployOk && !execution && <p className="text-[12px] text-amber-300">Workflow dispatched, but tracking could not be saved. Open GitHub Actions to verify the outcome.</p>}
        {deployError && <p role="alert" className="text-[12px] text-rose-300">{deployError}</p>}
        {execution && execution.environmentId === environmentId && (
          <div className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-zinc-200">{execution.repositoryFullName}</p>
                {execution.sourceRef && (
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">
                    {execution.sourceKind ?? "ref"} {execution.sourceRef}
                    {execution.sourceCommitSha ? ` · ${execution.sourceCommitSha.slice(0, 12)}` : ""}
                    {execution.branchPolicyId ? " · policy enforced" : ""}
                  </p>
                )}
                <p className="mt-1 text-zinc-500">
                  {observation?.label}
                </p>
                <DeploymentWorkflowEvidence execution={execution} />
                {!observation?.canPoll && execution.status !== "completed" && <p className="mt-1 text-zinc-500">Refresh the recorded status after reviewing the provider outcome. This does not dispatch or retry a deployment.</p>}
                {observationError?.executionId === execution.id && <p role="alert" className="mt-1 text-rose-300">{observationError.message}</p>}
              </div>
              <button type="button" onClick={() => void refreshExecution()} disabled={refreshingExecution} className="rounded-md border border-white/10 px-2.5 py-1.5 text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{refreshingExecution ? "Refreshing…" : "Refresh status"}</button>
              {execution.workflowUrl && (
                <button type="button" onClick={() => void open(execution.workflowUrl!)} className="rounded-md border border-white/10 px-2.5 py-1.5 text-zinc-300 hover:bg-white/[0.06]">
                  View evidence ↗
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Enterprise identity — docs/ENTERPRISE_IDENTITY_DESIGN.md. Config
 * management only: nothing here makes SSO live. A connected provider
 * starts and stays "pending" until a real metadata exchange + test
 * assertion ships in a later phase — this view never implies a
 * provider is active just because it was saved.
 */
interface IdentityProviderListItem {
  id: string; protocol: string; status: string; issuerOrEntityId: string; managedDomains: string[]; requireMfaClaim: boolean; revokedAt: string | null;
}

function IdentitySection() {
  const [providers, setProviders] = useState<IdentityProviderListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    void desktopClient.listIdentityProviders().then((result) => {
      if (result.ok) { setProviders(result.data.providers); setLoadError(null); }
      else setLoadError(result.error);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <SectionHeading title="Identity" detail="Enterprise SSO (OIDC/SAML) and SCIM lifecycle config — design-only until a real metadata exchange ships. No sign-in path reads this yet; connecting a provider here never grants anyone access on its own." />
      {loadError && <p role="alert" className="mb-4 text-[12px] text-rose-300">{loadError}</p>}
      <Group label="Configured identity providers">
        {providers === null && loadError === null && <ActionRow title="Loading…" detail="Checking configured providers." action={null} />}
        {providers !== null && providers.length === 0 && <ActionRow title="No identity provider configured" detail="Add one below. It stays pending — sign-in is unaffected until a later phase ships the live OIDC/SAML client." action={null} />}
        {(providers ?? []).map((p) => (
          <ActionRow
            key={p.id}
            title={`${p.protocol.toUpperCase()} — ${p.issuerOrEntityId}`}
            detail={`${p.status}${p.revokedAt ? " · revoked" : ""} · domains: ${p.managedDomains.join(", ")}${p.requireMfaClaim ? " · MFA required" : ""}`}
            action={!p.revokedAt ? <RevokeProviderButton id={p.id} onRevoked={load} /> : null}
          />
        ))}
      </Group>
      <NewIdentityProviderForm onCreated={load} />
      <ScimPreviewPanel />
    </div>
  );
}

function RevokeProviderButton({ id, onRevoked }: { id: string; onRevoked: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function revoke() {
    setBusy(true); setError(null);
    try {
      const result = await desktopClient.revokeIdentityProvider(id);
      if (!result.ok) { setError(result.error); return; }
      onRevoked();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => void revoke()} disabled={busy} className="rounded-md border border-rose-500/30 bg-rose-500/[0.08] px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-500/[0.14] disabled:opacity-50">
        {busy ? "Revoking…" : "Revoke"}
      </button>
      {error && <span className="text-[11px] text-rose-300">{error}</span>}
    </div>
  );
}

function NewIdentityProviderForm({ onCreated }: { onCreated: () => void }) {
  const [protocol, setProtocol] = useState("oidc");
  const [issuer, setIssuer] = useState("");
  const [metadataDocument, setMetadataDocument] = useState("");
  const [domains, setDomains] = useState("");
  const [claimKey, setClaimKey] = useState("groups");
  const [claimValue, setClaimValue] = useState("");
  const [role, setRole] = useState("admin");
  const [requireMfaClaim, setRequireMfaClaim] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit() {
    setBusy(true); setError(null); setOk(false);
    try {
      const result = await desktopClient.createIdentityProvider({
        protocol, issuerOrEntityId: issuer, metadataDocument,
        managedDomains: domains.split(",").map((d) => d.trim()).filter(Boolean),
        roleMapping: [{ claimKey, claimValue, role }],
        requireMfaClaim,
      });
      if (!result.ok) { setError(result.error); return; }
      setOk(true);
      setIssuer(""); setMetadataDocument(""); setDomains(""); setClaimValue("");
      onCreated();
      setTimeout(() => setOk(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = issuer && metadataDocument && domains && claimValue;

  return (
    <Group label="Connect an identity provider">
      <div className="px-4 py-3.5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Protocol</span>
            <select value={protocol} onChange={(event) => setProtocol(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
              <option value="oidc">OIDC</option>
              <option value="saml">SAML</option>
            </select>
          </label>
          <LabeledInput label="Issuer URL / entity ID" placeholder="https://idp.acme.com" value={issuer} onChange={setIssuer} />
        </div>
        <LabeledTextArea label="Metadata document (OIDC discovery JSON or SAML metadata XML)" value={metadataDocument} onChange={setMetadataDocument} />
        <LabeledInput label="Managed domains (comma-separated)" placeholder="acme.com, acme.io" value={domains} onChange={setDomains} />
        <div className="grid grid-cols-3 gap-3">
          <LabeledInput label="Claim key" placeholder="groups" value={claimKey} onChange={setClaimKey} />
          <LabeledInput label="Claim value" placeholder="axiom-admins" value={claimValue} onChange={setClaimValue} />
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Maps to role</span>
            <select value={role} onChange={(event) => setRole(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
              {["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={requireMfaClaim} onChange={(event) => setRequireMfaClaim(event.target.checked)} />
          Require MFA claim at sign-in (fails closed if absent, once live)
        </label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void submit()} disabled={busy || !canSubmit} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50">
            {busy ? "Saving…" : "Save (pending)"}
          </button>
          {ok && <span className="text-[12px] text-emerald-300">Saved — pending</span>}
        </div>
        {error && <p role="alert" className="text-[12px] text-rose-300">{error}</p>}
      </div>
    </Group>
  );
}

function ScimPreviewPanel() {
  const [employeesJson, setEmployeesJson] = useState('[\n  { "id": "e1", "email": "a@acme.com", "status": "active", "desiredRoles": ["admin"] }\n]');
  const [grantsJson, setGrantsJson] = useState("[]");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ actions: Array<{ kind: string; userId: string; role: string; reason: string }>; joinersCount: number; moversCount: number; leaversCount: number } | null>(null);

  async function preview() {
    setBusy(true); setError(null); setPlan(null);
    try {
      let employees: unknown; let currentGrants: unknown;
      try {
        employees = JSON.parse(employeesJson);
        currentGrants = JSON.parse(grantsJson);
      } catch {
        setError("Both fields must be valid JSON.");
        return;
      }
      const result = await desktopClient.previewScimLifecycle({ employees, currentGrants });
      if (!result.ok) { setError(result.error); return; }
      setPlan(result.data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Group label="SCIM lifecycle preview (stage only — nothing executes)">
      <div className="px-4 py-3.5 space-y-3">
        <LabeledTextArea label="Directory employees (JSON)" value={employeesJson} onChange={setEmployeesJson} />
        <LabeledTextArea label="Current grants (JSON)" value={grantsJson} onChange={setGrantsJson} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void preview()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50">
            {busy ? "Computing…" : "Compute plan"}
          </button>
        </div>
        {error && <p role="alert" className="text-[12px] text-rose-300">{error}</p>}
        {plan && (
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <p className="mb-2 text-[11px] text-zinc-500">{plan.joinersCount} joiner(s) · {plan.moversCount} mover(s) · {plan.leaversCount} leaver(s)</p>
            {plan.actions.length === 0 ? (
              <p className="text-[12px] text-zinc-500">No changes staged.</p>
            ) : (
              <ul className="space-y-1">
                {plan.actions.map((a, i) => (
                  <li key={i} className="text-[12px] text-zinc-300">
                    <span className="text-zinc-500">{a.kind}</span> — {a.userId}{a.role ? ` (${a.role})` : ""}: <span className="text-zinc-500">{a.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Group>
  );
}

/**
 * Repository registration + branch policy config — the (repository,
 * environment, branch pattern) rule and its requirement flags are real
 * and persisted here, but nothing in the AWS deploy-trigger path
 * enforces them yet (it has no concept of "which branch" today). This
 * is config-only, same posture as the Identity tab's provider
 * connections before a real sign-in path exists.
 */
interface RepositoryListItem { id: string; displayName: string; provider: string; defaultBranch: string }

function RepositoriesPanel() {
  const [repositories, setRepositories] = useState<RepositoryListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [provider, setProvider] = useState("github");
  const [remoteOwner, setRemoteOwner] = useState("");
  const [remoteName, setRemoteName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void desktopClient.listRepositories().then((result) => {
      if (result.ok) { setRepositories(result.data.repositories); setLoadError(null); }
      else setLoadError(result.error);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function register() {
    setBusy(true); setError(null);
    try {
      const result = await desktopClient.registerRepository({ provider, remoteOwner, remoteName });
      if (!result.ok) { setError(result.error); return; }
      setRemoteOwner(""); setRemoteName("");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Group label="Repositories">
      {loadError && <div className="px-4 py-2 text-[12px] text-rose-300">{loadError}</div>}
      {repositories !== null && repositories.length === 0 && <ActionRow title="No repositories registered" detail="Register one below to configure branch policies for it." action={null} />}
      {(repositories ?? []).map((r) => (
        <ActionRow key={r.id} title={r.displayName} detail={`${r.provider} · default branch: ${r.defaultBranch}`} action={null} />
      ))}
      <div className="px-4 py-3.5 space-y-3 border-t border-white/[0.04]">
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Provider</span>
            <select value={provider} onChange={(event) => setProvider(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
              <option value="azuredevops">Azure DevOps</option>
              <option value="other">Other</option>
            </select>
          </label>
          <LabeledInput label="Owner / org" placeholder="acme" value={remoteOwner} onChange={setRemoteOwner} />
          <LabeledInput label="Repo name" placeholder="widgets" value={remoteName} onChange={setRemoteName} />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void register()} disabled={busy || !remoteOwner || !remoteName} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50">
            {busy ? "Registering…" : "Register repository"}
          </button>
        </div>
        {error && <p role="alert" className="text-[12px] text-rose-300">{error}</p>}
      </div>
    </Group>
  );
}

function BranchPoliciesPanel() {
  const [policies, setPolicies] = useState<Array<{ id: string; repositoryId: string; environmentId: string; branchPattern: string; requirePrLink: boolean; requireReleaseTag: boolean; requireCodeowners: boolean; requireChangeTicket: boolean; requireTestsPassing: boolean; requirePromotionFromEnvironmentId: string | null }> | null>(null);
  const [repositories, setRepositories] = useState<Array<{ id: string; displayName: string }>>([]);
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string; tier: string }>>([]);
  const [repositoryId, setRepositoryId] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [branchPattern, setBranchPattern] = useState("");
  const [requirePrLink, setRequirePrLink] = useState(true);
  const [requireReleaseTag, setRequireReleaseTag] = useState(false);
  const [requireCodeowners, setRequireCodeowners] = useState(false);
  const [requireChangeTicket, setRequireChangeTicket] = useState(false);
  const [requireTestsPassing, setRequireTestsPassing] = useState(true);
  const [requirePromotionFromEnvironmentId, setRequirePromotionFromEnvironmentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void Promise.all([
      desktopClient.listBranchPolicies(),
      desktopClient.listRepositories(),
      desktopClient.listEnvironments(),
    ]).then(([policyResult, repositoryResult, environmentResult]) => {
      if (policyResult.ok) setPolicies(policyResult.data.policies);
      if (repositoryResult.ok) {
        setRepositories(repositoryResult.data.repositories);
        setRepositoryId((current) => current || repositoryResult.data.repositories[0]?.id || "");
      }
      if (environmentResult.ok) {
        setEnvironments(environmentResult.data.environments);
        setEnvironmentId((current) => current || environmentResult.data.environments[0]?.id || "");
      }
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedEnvironment = environments.find((environment) => environment.id === environmentId);
  const isProductionPolicy = selectedEnvironment?.tier === "prod";
  useEffect(() => {
    if (isProductionPolicy) {
      setRequirePrLink(true);
      setRequireTestsPassing(true);
    }
  }, [isProductionPolicy]);

  async function create() {
    setBusy(true); setError(null);
    try {
      const result = await desktopClient.createBranchPolicy({
        repositoryId,
        environmentId,
        branchPattern,
        requirePrLink,
        requireReleaseTag,
        requireCodeowners,
        requireChangeTicket,
        requireTestsPassing,
        ...(requirePromotionFromEnvironmentId ? { requirePromotionFromEnvironmentId } : {}),
      });
      if (!result.ok) { setError(result.error); return; }
      setBranchPattern("");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Group label="Branch policies (enforced before deploy)">
      {policies !== null && policies.length === 0 && <ActionRow title="No branch policies configured" detail="Define which branch patterns need a PR link, release tag, etc. before deploying to an environment." action={null} />}
      {(policies ?? []).map((p) => (
        <ActionRow key={p.id} title={p.branchPattern} detail={[p.requirePrLink && "merged PR", p.requireTestsPassing && "tests passing", p.requireReleaseTag && "release tag", p.requireCodeowners && "codeowners", p.requireChangeTicket && "change ticket", p.requirePromotionFromEnvironmentId && "prior-environment promotion"].filter(Boolean).join(", ") || "no requirements set"} action={null} />
      ))}
      <div className="px-4 py-3.5 space-y-3 border-t border-white/[0.04]">
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Repository</span>
            <select value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
              {repositories.length === 0 && <option value="">Register a repository first</option>}
              {repositories.map((repository) => <option key={repository.id} value={repository.id}>{repository.displayName}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Environment</span>
            <select value={environmentId} onChange={(event) => { setEnvironmentId(event.target.value); setRequirePromotionFromEnvironmentId(""); }} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
              {environments.length === 0 && <option value="">Create an environment first</option>}
              {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name} · {environment.tier}</option>)}
            </select>
          </label>
          <LabeledInput label="Branch pattern" placeholder="release/*" value={branchPattern} onChange={setBranchPattern} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Require a linked, merged pull request", checked: requirePrLink, set: setRequirePrLink, locked: isProductionPolicy },
            { label: "Require repository tests to pass", checked: requireTestsPassing, set: setRequireTestsPassing, locked: isProductionPolicy },
            { label: "Require a release tag", checked: requireReleaseTag, set: setRequireReleaseTag },
            { label: "Require CODEOWNERS enforcement and approval", checked: requireCodeowners, set: setRequireCodeowners },
            { label: "Require a CHG, INC, or REQ ticket in the PR", checked: requireChangeTicket, set: setRequireChangeTicket },
          ].map((item) => (
            <label key={item.label} className="flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={item.checked} disabled={item.locked} onChange={(event) => item.set(event.target.checked)} />
              {item.label}
            </label>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] text-zinc-500">Promote only after a successful deploy in</span>
          <select value={requirePromotionFromEnvironmentId} onChange={(event) => setRequirePromotionFromEnvironmentId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25">
            <option value="">No prior environment required</option>
            {environments.filter((candidate) => candidate.id !== environmentId).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.tier}</option>)}
          </select>
          {isProductionPolicy && <span className="mt-1 block text-[11px] text-amber-300">Production requires a prior environment, a merged PR, and passing tests.</span>}
        </label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void create()} disabled={busy || !repositoryId || !environmentId || !branchPattern || (isProductionPolicy && !requirePromotionFromEnvironmentId)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50">
            {busy ? "Saving…" : "Add policy"}
          </button>
        </div>
        {error && <p role="alert" className="text-[12px] text-rose-300">{error}</p>}
      </div>
    </Group>
  );
}

function LabeledInput({ label, placeholder, value, onChange, disabled = false }: { label: string; placeholder?: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
      <input
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25"
      />
    </label>
  );
}

function LabeledTextArea({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
      <textarea
        disabled={disabled}
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25 font-mono"
      />
    </label>
  );
}

function WorktreesSection({ onOpenRepository }: {onOpenRepository?: () => void}) {
  return <div>
    <SectionHeading title="Worktrees" detail="Isolate tasks in separate local checkouts and branches without changing the original working tree." />
    <Notice title="Managed in GitHub repositories" detail="Open a repository and expand Workspaces to create or switch checkouts. New checkouts start at the selected checkout’s committed HEAD; uncommitted edits stay in their original checkout. Removing a checkout preserves its branch and commits and refuses changed, untracked, ignored or locked state." />
    <Group label="Local limits"><InfoRow label="Maximum checkouts per repository" value="25" /><InfoRow label="Combined file bytes per repository" value="50 GB" /></Group>
    {onOpenRepository && <button type="button" onClick={onOpenRepository} className="btn-secondary">Open repository workspaces</button>}
  </div>;
}

function IntegrationsSection({ identity }: { identity: VerifiedDesktopIdentity }) {
  const [integrationStatus, setIntegrationStatus] = useState<{
    configuration?: Record<"github" | "slack" | "teams" | "linear", boolean>;
    cloud: Array<{ provider: "aws" | "azure" | "gcp"; status: string; lastTransitionAt: string | null }>;
    github: { status: string; repositorySelection: string };
    collaboration: Array<{ provider: "slack" | "teams" | "linear"; status: string; lastValidatedAt: string | null }>;
  } | null>(null);
  const [health, setHealth] = useState<{
    status: "healthy" | "degraded" | "preview" | "blocked" | "disabled" | "unknown";
    sourceMode: string;
    summary: { total: number; healthy: number; degraded: number; preview: number; blocked: number; disabled: number };
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [validatingGitHub, setValidatingGitHub] = useState(false);
  const [githubValidationNote, setGithubValidationNote] = useState<string | null>(null);
  const [validatingSlack, setValidatingSlack] = useState(false);
  const [slackValidationNote, setSlackValidationNote] = useState<string | null>(null);
  const [validatingTeams, setValidatingTeams] = useState(false);
  const [teamsValidationNote, setTeamsValidationNote] = useState<string | null>(null);
  const [validatingLinear, setValidatingLinear] = useState(false);
  const [linearValidationNote, setLinearValidationNote] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<"github" | "slack" | "teams" | "linear" | null>(null);
  const [connectionNote, setConnectionNote] = useState<string | null>(null);

  const loadCloudConnections = useCallback(async () => {
    setRefreshing(true);
    const [result, healthResult] = await Promise.all([
      desktopClient.integrationStatus(),
      desktopClient.integrationHealth(),
    ]);
    if (result.ok) setIntegrationStatus(result.data);
    if (healthResult.ok) setHealth(healthResult.data);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadCloudConnections(); }, 0);
    window.addEventListener("focus", loadCloudConnections);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("focus", loadCloudConnections);
    };
  }, [loadCloudConnections]);

  const cloudConnections = integrationStatus?.cloud ?? null;
  const github = integrationStatus?.github ?? null;
  const collaboration = integrationStatus?.collaboration ?? null;
  const cloudState = cloudConnections
    ? cloudConnections.some((connection) => connection.status === "connected")
      ? `${cloudConnections.filter((connection) => connection.status === "connected").length} verified`
      : "Not connected"
    : "Checking status";
  const cloudDetail = cloudConnections
    ? cloudConnections.map((connection) => `${connection.provider.toUpperCase()} ${connection.status.replaceAll("_", " ")}`).join(" · ")
    : "Loading the service-verified state for AWS, Azure, and Google Cloud.";
  const githubState = github
    ? github.status === "validated_read_only" ? "Validated read-only" : github.status === "installation_recorded" ? "Consent recorded" : github.status === "validation_overdue" ? "Validation overdue" : github.status.replaceAll("_", " ")
    : "Checking status";
  const githubDetail = github
    ? github.status === "validated_read_only"
      ? `GitHub App access was verified with a scoped, read-only request. ${github.repositorySelection === "all" ? "All-repository" : "Selected-repository"} scope remains managed by GitHub.`
      : github.status === "installation_recorded"
      ? `GitHub App consent and ${github.repositorySelection === "all" ? "all-repository" : "selected-repository"} scope were recorded. Live read-only access is not shown as verified until service validation succeeds.`
      : github.status === "validation_overdue"
      ? `GitHub App access was validated previously, but that verification is more than 24 hours old. Run the harmless read-only validation again before relying on it for release evidence.`
      : "No active GitHub App installation is recorded for this workspace. Connect in the browser to choose repository scope."
    : "Loading the service-verified GitHub App state.";
  async function validateGitHub() {
    setValidatingGitHub(true);
    setGithubValidationNote(null);
    const result = await desktopClient.validateGitHubReadOnly();
    if (result.ok) {
      setGithubValidationNote("GitHub read-only access is verified for this workspace.");
      await loadCloudConnections();
    } else {
      setGithubValidationNote("GitHub could not complete a read-only validation. Review the App installation and try again.");
    }
    setValidatingGitHub(false);
  }

  async function validateSlack() {
    setValidatingSlack(true);
    setSlackValidationNote(null);
    const result = await desktopClient.validateSlackConnection();
    if (result.ok) {
      setSlackValidationNote("Slack access is verified for this workspace.");
      await loadCloudConnections();
    } else {
      setSlackValidationNote("Slack could not complete a read-only validation. Review the consent record and try again.");
    }
    setValidatingSlack(false);
  }

  async function validateTeams() {
    setValidatingTeams(true);
    setTeamsValidationNote(null);
    const result = await desktopClient.validateTeamsConnection();
    if (result.ok) {
      setTeamsValidationNote("Microsoft identity is verified for this workspace. Teams message permissions remain separately controlled.");
      await loadCloudConnections();
    } else {
      setTeamsValidationNote("Microsoft could not complete an identity validation. Review the consent record and try again.");
    }
    setValidatingTeams(false);
  }

  async function validateLinear() {
    setValidatingLinear(true);
    setLinearValidationNote(null);
    const result = await desktopClient.validateLinearConnection();
    if (result.ok) {
      setLinearValidationNote("Linear app identity is verified for this workspace.");
      await loadCloudConnections();
    } else {
      setLinearValidationNote("Linear could not complete a read-only identity validation. Review consent and try again.");
    }
    setValidatingLinear(false);
  }

  const slackCanValidate = collaboration?.some((connection) => connection.provider === "slack" && (connection.status === "awaiting_validation" || connection.status === "needs_attention")) ?? false;
  const teamsCanValidate = collaboration?.some((connection) => connection.provider === "teams" && (connection.status === "awaiting_validation" || connection.status === "needs_attention")) ?? false;
  const linearCanValidate = collaboration?.some((connection) => connection.provider === "linear" && (connection.status === "awaiting_validation" || connection.status === "needs_attention")) ?? false;

  async function connectProvider(provider: "github" | "slack" | "teams" | "linear") {
    setConnectingProvider(provider);
    setConnectionNote(null);
    try {
      const result = await desktopClient.startIntegrationConnection(provider);
      if (!result.ok) throw new Error(result.error);
      const destination = new URL(result.data.consentUrl);
      const allowedHosts: Record<typeof provider, readonly string[]> = {
        github: ["github.com"], slack: ["slack.com"], teams: ["login.microsoftonline.com"], linear: ["linear.app"],
      };
      if (destination.protocol !== "https:" || !allowedHosts[provider].includes(destination.hostname)) throw new Error("untrusted_consent_destination");
      await open(destination.toString());
      setConnectionNote("Secure consent opened in your browser. Return here after approval; status refreshes when this window regains focus.");
    } catch {
      setConnectionNote("The secure connection could not be started. Confirm this provider is configured for the workspace and try again.");
    } finally {
      setConnectingProvider(null);
    }
  }

  const providerStatus = (provider: "slack" | "teams" | "linear") => collaboration?.find((item) => item.provider === provider)?.status ?? "not_connected";
  const providerAction = (provider: "github" | "slack" | "teams" | "linear", status: string, canValidate: boolean, validating: boolean, validate: () => Promise<void>) => {
    if (integrationStatus?.configuration?.[provider] === false) return <button type="button" onClick={() => void open(`${WEB_BASE}/docs/integration-setup#${provider}`)} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]">Setup guide ↗</button>;
    if (canValidate) return <button type="button" disabled={validating} onClick={() => void validate()} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-zinc-100 disabled:opacity-50">{validating ? "Checking access…" : status === "validation_overdue" ? "Revalidate now" : "Finish connection"}</button>;
    if (status === "active" || status === "validated_read_only") return <WebButton href="/account/integrations" label="Manage" />;
    return <button type="button" disabled={connectingProvider !== null} onClick={() => void connectProvider(provider)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-zinc-100 disabled:opacity-50">{connectingProvider === provider ? "Opening…" : "Connect ↗"}</button>;
  };

  return <div>
    <SectionHeading title="Integration Center" detail="Connect the systems that already run your releases. Every connection is tenant-scoped, least-privilege, and shown as connected only after server-side validation." />
    <Notice title="Provider-specific secure connections" detail="OAuth connections use browser consent. The Azure read-only candidate accepts an existing service-principal secret transiently and sends it to the backend encrypted vault; it clears after submission and is not persisted in desktop settings. Cloud changes remain unavailable." />
    <div className="space-y-3">
      <IntegrationRow name="GitHub" group="Source control" detail={githubDetail} state={githubState} tone={github?.status === "validation_overdue" ? "attention" : undefined} action={providerAction("github", github?.status ?? "not_connected", github?.status === "installation_recorded" || github?.status === "validation_overdue", validatingGitHub, validateGitHub)} />
      <IntegrationRow name="Slack" group="Collaboration" detail="Release notifications with channels:read and chat:write. Consent is not active access until Axiom validates the token server-side." state={formatConnectorState(providerStatus("slack"))} action={providerAction("slack", providerStatus("slack"), slackCanValidate, validatingSlack, validateSlack)} />
      <IntegrationRow name="Microsoft Teams" group="Collaboration" detail="Verifies Microsoft workspace identity with PKCE. Message permissions remain separately gated." state={formatConnectorState(providerStatus("teams"))} action={providerAction("teams", providerStatus("teams"), teamsCanValidate, validatingTeams, validateTeams)} />
      <IntegrationRow name="Linear" group="Work management" detail="Governed issue delegation with read and issues:create scopes, short-lived tokens, and automatic refresh rotation." state={formatConnectorState(providerStatus("linear"))} action={providerAction("linear", providerStatus("linear"), linearCanValidate, validatingLinear, validateLinear)} />
      {INTEGRATION_CENTER_ITEMS.map((item) => (
        <IntegrationRow
          key={item.name}
          name={item.name}
          group={item.group}
          detail={item.name === "AWS, Azure & Google Cloud" ? `${item.detail} Current workspace state: ${cloudDetail}` : item.detail}
          state={item.name === "AWS, Azure & Google Cloud" ? cloudState : item.state}
        />
      ))}
    </div>
    <AwsReadOnlyEnrollment identity={identity} />
    <AzureReadOnlyEnrollment identity={identity} />
    {connectionNote && <p role="status" className="mt-3 text-xs text-zinc-400">{connectionNote}</p>}
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-sm text-zinc-200">What happens when you connect</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">You review the requested access in your browser, approve only the workspace you intend to connect, then return here to see the service-verified status and any required next action.</p>
    </div>
    <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-sm text-zinc-200">Connected-system health</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        {health
          ? `${health.status.replaceAll("_", " ")} · ${health.summary.healthy} healthy · ${health.summary.degraded} needs attention · ${health.summary.preview} not yet live.`
          : "Checking the read-only health of connected-system foundations."}
      </p>
      <p className="mt-2 text-[11px] text-zinc-600">This is integration health only. Production release observation remains unavailable until an observability connection is verified.</p>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <WebButton href="/account/integrations" label="Manage connections" />
      <button type="button" onClick={() => void loadCloudConnections()} disabled={refreshing} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">
        {refreshing ? "Checking…" : "Refresh verified status"}
      </button>
    </div>
    {githubValidationNote && <p className="mt-3 text-xs text-zinc-400">{githubValidationNote}</p>}
    {slackValidationNote && <p className="mt-3 text-xs text-zinc-400">{slackValidationNote}</p>}
    {teamsValidationNote && <p className="mt-3 text-xs text-zinc-400">{teamsValidationNote}</p>}
    {linearValidationNote && <p className="mt-3 text-xs text-zinc-400">{linearValidationNote}</p>}
  </div>;
}

type PreferenceSectionProps = { prefs: DesktopPreferences | null; onSave: (prefs: DesktopPreferences) => Promise<void> };
type Option = { value: string; label: string };

function SectionHeading({ title, detail }: { title: string; detail: string }) { return <div className="mb-6"><h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">{detail}</p></div>; }
function Group({ label, children }: { label: string; children: ReactNode }) { return <section className="mb-6"><p className="mb-2 text-xs text-zinc-500">{label}</p><div className="overflow-hidden rounded-lg border border-white/[0.05] bg-white/[0.015]">{children}</div></section>; }
function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-start justify-between gap-8 border-b border-white/[0.045] px-4 py-3.5 last:border-b-0"><span className="text-sm text-zinc-400">{label}</span><span className={`max-w-[65%] break-all text-right text-sm text-zinc-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</span></div>; }
function ActionRow({ title, detail, action }: { title: string; detail: string; action: ReactNode }) { return <div className="flex items-center gap-4 border-b border-white/[0.045] px-4 py-3.5 last:border-b-0"><div className="min-w-0 flex-1"><p className="text-sm text-zinc-200">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div>{action}</div>; }
function ToggleRow({ title, detail, enabled, disabled, onToggle, action }: { title: string; detail: string; enabled: boolean; disabled: boolean; onToggle: () => void; action?: ReactNode }) { return <ActionRow title={title} detail={detail} action={<div className="flex items-center gap-3">{action}<button type="button" role="switch" aria-checked={enabled} aria-label={title} disabled={disabled} onClick={onToggle} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-emerald-600" : "bg-zinc-700"} disabled:opacity-50`}><span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} /></button></div>} />; }
function SelectRow({ title, detail, value, disabled, options, onChange }: { title: string; detail: string; value: string; disabled: boolean; options: Option[]; onChange: (value: string) => void }) { return <ActionRow title={title} detail={detail} action={<select aria-label={title} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-[#17181a] px-3 py-2 text-xs text-zinc-200 outline-none disabled:opacity-50">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>} />; }
function LockedRow({ title, detail }: { title: string; detail: string }) { return <ActionRow title={title} detail={detail} action={<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300"><LockKeyhole className="h-3 w-3" />Always on</span>} />; }
function Notice({ title, detail }: { title: string; detail: string }) { return <div className="mb-6 rounded-lg border border-white/15 bg-white/[0.04] p-4"><p className="text-sm font-medium text-zinc-100">{title}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{detail}</p></div>; }
function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold capitalize">{value}</p><p className="mt-2 text-sm text-zinc-500">{detail}</p></div>; }
function formatConnectorState(state: string) { return state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function IntegrationRow({ name, group, detail, state, action, tone }: { name: string; group: string; detail: string; state: string; action?: ReactNode; tone?: "attention" }) {
  const connected = /verified|connected/i.test(state) && !/not connected/i.test(state);
  const stateClass = tone === "attention"
    ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
    : connected ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-white/20 bg-white/10 text-zinc-200";
  return <div className="flex items-center gap-4 rounded-lg border border-white/[0.05] bg-white/[0.015] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.05] bg-black/20 text-zinc-300"><Link2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">{group}</p><p className="mt-0.5 text-sm text-zinc-200">{name}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[10px] ${stateClass}`}>{state}</span>{action}</div></div>;
}
function WebButton({ href, label, standalone = false }: { href: string; label: string; standalone?: boolean }) { return <button type="button" onClick={() => void open(`${WEB_BASE}${href}`)} className={`${standalone ? "mt-1" : ""} inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]`}>{label}<ChevronRight className="h-3.5 w-3.5" /></button>; }

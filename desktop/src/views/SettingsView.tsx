import { useDesktopUsage, type DesktopUsageRead } from "../lib/useDesktopUsage";
import { DESKTOP_PRODUCT_NAME } from "../lib/desktopMetadata";
import {GovernanceWorkspacePreview} from './GovernanceWorkspacePreview';
import {OutlookIntegrationCard} from '../components/OutlookIntegrationCard';
import {ProviderLogo,ProviderLogoGroup,type CatalogProvider} from "../components/CatalogIcon";
import { browserNavigationIntentPath, parseBrowserNavigationIntent } from "../../../lib/desktop/browserNavigationIntent";
import { Disclosure } from "../components/Disclosure";
import { isVerifiedIntegrationStatus } from "../lib/integrationStatusPresentation";
import {type DesktopUsageSummary} from "../../../lib/desktop/desktopBillingSummary";
import { AGENT_PROFILES } from "../../../lib/axiom/agentRuntime/agentProfiles";
import { DeploymentWorkflowEvidence } from "../components/DeploymentWorkflowEvidence";
import {AzureGuidedConnection} from "../components/AzureGuidedConnection";
import {AwsGuidedConnection} from "../components/AwsGuidedConnection";
import {GcpGuidedConnection} from "../components/GcpGuidedConnection";
import { AwsReadOnlyEnrollment } from "../components/AwsReadOnlyEnrollment";
import { AzureReadOnlyEnrollment } from "../components/AzureReadOnlyEnrollment";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  CircleUserRound,
  Code2,
  Copy,
  CreditCard,
  FileText,
  GitBranch,
  KeyRound,
  Link2,
  LockKeyhole,
  LogOut,
  Palette,
  Plus,
  Server,
  Settings2,
  Search,
  ShieldCheck,
  Trees,
} from "lucide-react";
import { normalizeTags, planFanOut } from "../../../lib/releaseops/environmentTags";
import { desktopClient, type DatabaseChangeEvidence, type DeploymentExecution, type VerifiedDesktopIdentity, type WorkspaceMember } from "../lib/desktopClient";
import { StatusIconChip } from "../components/StatusBadge";
import { desktopUpdateState } from "../../../lib/desktop/desktopVersionCompare";
import { useSearchShortcut } from "../lib/useSearchShortcut";
import { deploymentObservationState } from "../lib/deploymentObservationState";
import { signOutDesktopCredentials } from "../lib/activeDesktopCredential";
import { normalizeAiProviderStatus, toggleApprovedModel, setApprovedGatewayDefault, removeUnavailableGatewayApprovals, isModelApproved, isConcreteGatewayModelId, type ModelPolicy, type ProviderModels } from "../lib/aiProviderStatus";
import { markNotificationPrefDirty, notifyResult, type NotificationRequestResult } from "../lib/notifications";
import {
  readDesktopPreferences,
  writeDesktopPreferences,
  type DesktopPreferences,
} from "../lib/preferences";

const WEB_BASE = "https://visionxixlabs.com";
const preferenceReadIssue = "Local preferences could not be loaded. Reopen Settings to try again.";

/**
 * Desktop-safe integration inventory.
 *
 * The installed app must never imply that a provider is connected merely
 * because a browser setup page exists. These states are intentionally
 * conservative until the server has completed the tenant-scoped consent,
 * validation, and audit journey for the provider.
 */
const INTEGRATION_CENTER_ITEMS = [
  { group: "Cloud & delivery", name: "AWS, Azure & Google Cloud", detail: "Cloud access is tenant-scoped and least-privilege. A provider is not marked connected until server-side validation succeeds.", state: "Admin setup" },
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
  general: "startup notifications account installed desktop version updates releases about",
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

const sectionGroups = ["Account & preferences", "Agent & security", "Development & connections"] as const;
const sections: Array<{ id: Section; label: string; icon: typeof CircleUserRound; group:typeof sectionGroups[number] }> = [
  { id: "general", group: "Account & preferences", label: "General", icon: Settings2 },
  { id: "profile", group: "Account & preferences", label: "Profile", icon: CircleUserRound },
  { id: "appearance", group: "Account & preferences", label: "Appearance", icon: Palette },
  { id: "plan", group: "Account & preferences", label: "Plan & usage", icon: CreditCard },
  { id: "agents", group: "Agent & security", label: "Agents", icon: Bot },
  { id: "models", group: "Agent & security", label: "Models", icon: Code2 },
  { id: "permissions", group: "Agent & security", label: "Permissions", icon: ShieldCheck },
  { id: "git", group: "Development & connections", label: "Git & PRs", icon: GitBranch },
  { id: "environments", group: "Development & connections", label: "Environments", icon: Server },
  { id: "identity", group: "Agent & security", label: "Identity", icon: KeyRound },
  { id: "worktrees", group: "Development & connections", label: "Worktrees", icon: Trees },
  { id: "integrations", group: "Development & connections", label: "Integrations", icon: Link2 },
];

export function SettingsView({ identity, initialSection, onClose, onOpenRepository, onSignOut, desktopUsage, usageRequest }: { onSignOut?: () => Promise<void>; identity: VerifiedDesktopIdentity; initialSection?: "models" | "agents" | "plan" | "integrations"; desktopUsage?: DesktopUsageRead; usageRequest?: number; onOpenRepository?: () => void; onClose?: () => void }) {
  const [governancePreview, setGovernancePreview] = useState<"records" | "limits">();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Section>(initialSection ?? "general");
  const sectionContent = useRef<HTMLDivElement>(null);
  const sectionNav = useRef<HTMLElement>(null);
  const sectionSearch = useRef<HTMLInputElement>(null);
  const focusSectionOnChange = useRef(Boolean(initialSection));
  useEffect(() => {
    if (focusSectionOnChange.current) {
      focusSectionOnChange.current = false;
      if (sectionContent.current) {
        sectionContent.current.scrollTop = 0;
        sectionContent.current.focus();
      }
    }
  }, [active]);

  useEffect(() => {
    if (initialSection) openSection(initialSection);
  }, [initialSection, usageRequest]);

  function openSection(section: Section) {
    setSearch("");
    if (section === active) {
      sectionContent.current?.focus();
      return;
    }
    focusSectionOnChange.current = true;
    setActive(section);
  }

  const [prefs, setPrefs] = useState<DesktopPreferences | null>(null);
  const [preferenceReadFailed, setPreferenceReadFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const preferenceWriteInFlight = useRef(false);
  const [preferenceSaveUnconfirmed, setPreferenceSaveUnconfirmed] = useState(false);
  const settingsMounted = useRef(true);
  const savedNoticeTimer = useRef<number | undefined>(undefined);
  useEffect(() => { settingsMounted.current = true; return () => { settingsMounted.current = false; window.clearTimeout(savedNoticeTimer.current); }; }, []);
  const [error, setError] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);
  const [auditLogOpenFailed, setAuditLogOpenFailed] = useState(false);
  useSearchShortcut(sectionSearch, !showSignOut && !governancePreview);

  useEffect(() => {
    let current = true;
    readDesktopPreferences().then(value => { if (current) setPrefs(value); })
      .catch(() => { if (current) setPreferenceReadFailed(true); });
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

  async function openAuditLog() {
    setAuditLogOpenFailed(false);
    try {
      await open(`${WEB_BASE}/control/audit-security`);
    } catch {
      if (settingsMounted.current) setAuditLogOpenFailed(true);
    }
  }

  async function signOut() {
    try {
      if (onSignOut) { await onSignOut(); return; }
      await signOutDesktopCredentials();
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out could not be saved. Retry when secure storage is available.");
    }
  }

  const preferenceControls = {prefs, onSave: savePreferences, preferencesLocked: savingPreferences || preferenceSaveUnconfirmed};

  if (import.meta.env.DEV && governancePreview) return <GovernanceWorkspacePreview identity={identity} executionLimits={governancePreview === "limits"} onClose={() => setGovernancePreview(undefined)} />;
  return (
    <div className="settings-workbench studio-settings relative flex min-h-0 flex-1 flex-col bg-axiom-bg">
      <header className="studio-settings-heading">
        <div>
          <h1>Settings</h1>
          <p>Workspace identity, access, safety, and personal preferences.</p>
        </div>
        <button type="button" className="btn-secondary" aria-describedby="settings-audit-scope" onClick={() => void openAuditLog()}>
          <FileText size={15} strokeWidth={1.75} aria-hidden="true" />View audit log
        </button>
        <span id="settings-audit-scope" className="sr-only">Opens Audit &amp; Security for the workspace selected in your browser. Access requires a workspace owner or administrator.</span>
        {auditLogOpenFailed && <div className="studio-settings-audit-error" role="alert">The audit log could not be opened. Try again.</div>}
      </header>
      <div className="studio-settings-grid grid min-h-0 flex-1">
        <nav ref={sectionNav} aria-label="Settings sections" className="min-h-0 overflow-y-auto border-r border-white/6 bg-axiom-surface px-3 pb-5 pt-8">
          <p className="studio-settings-nav-label">Workspace settings</p>
          <label className="mb-4 flex items-center gap-2 rounded-lg border border-white/8 bg-white/2.5 px-2.5 py-2 text-zinc-500">
            <Search aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <input data-help-id="settings.workspace.section-search" ref={sectionSearch} type="search" aria-label="Search settings" aria-keyshortcuts="/" placeholder="Search settings" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 w-full bg-transparent text-xs text-zinc-200 outline-hidden placeholder:text-zinc-400" />
            <kbd aria-hidden="true" className="studio-settings-search-key">/</kbd>
          </label>
          {search.trim() && !sections.some(section => `${section.label} ${sectionKeywords[section.id]}`.toLowerCase().includes(search.trim().toLowerCase())) && <p role="status" className="px-3 py-2 text-xs text-zinc-500">No matching settings.</p>}
          {sectionGroups.map(group => {const visible=sections.filter(section=>section.group===group&&(!search.trim()||`${section.label} ${sectionKeywords[section.id]}`.toLowerCase().includes(search.trim().toLowerCase())));return visible.length>0&&<div key={group} role="group" aria-label={group} className="mb-4"><p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">{group}</p>{visible.map(({ id, label, icon: Icon }) => (
            <button data-help-id="settings.workspace.section-select"
              key={id}
              type="button"
              onClick={() => openSection(id)}
              aria-current={active === id ? "page" : undefined}
              className={`relative flex w-full items-center gap-3 rounded-md py-2 pl-3 pr-2 text-left text-[13px] transition-colors ${
                active === id ? "bg-white/6 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {active === id && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-white" />}
              <Icon aria-hidden className="h-[15px] w-[15px]" strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          ))}</div>})}
          <div className="mt-6 border-t border-white/6 pl-3 pt-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Current workspace</p>
            <p className="mt-2 truncate text-xs text-zinc-400" title={identity.organizationId}>{identity.organizationId}</p>
            <p className="mt-1 text-[11px] text-zinc-400">{identity.kind === "desktop_session" ? "Paired desktop session" : "Enterprise recovery credential"}</p>
          </div>
          {onClose && <button data-help-id="settings.workspace.back-to-workspace" type="button" onClick={onClose} className="mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-zinc-400 hover:bg-white/4 hover:text-white"><ArrowLeft aria-hidden className="h-4 w-4" />Back to workspace</button>}
        </nav>

        <div ref={sectionContent} role="region" aria-label="Current settings section" tabIndex={-1} onKeyDown={event => {
          if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 ||
            (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable], [role="dialog"], [role="alertdialog"]'))) return;
          const selected = sectionNav.current?.querySelector<HTMLButtonElement>('button[aria-current="page"]');
          const target = selected ?? sectionSearch.current;
          if (!target) return;
          event.preventDefault();
          target.focus();
        }} className="min-h-0 min-w-0 overflow-y-auto studio-settings-content"><div className="w-full">
          {preferenceReadFailed && active !== "general" && <p role="alert" className="studio-settings-preference-issue">{preferenceReadIssue}</p>}
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          {savingPreferences && <p role="status" className="mb-5 text-xs text-zinc-400">Saving on this computer…</p>}
          {saved && <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"><Check className="h-4 w-4" />Saved on this computer.</div>}
          <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">Settings controls</legend>
          {active === "general" && <GeneralSection identity={identity} onOpenSection={openSection} {...preferenceControls} preferenceReadFailed={preferenceReadFailed} onOpenGovernance={() => setGovernancePreview("records")} onOpenExecutionLimits={() => setGovernancePreview("limits")} />}
          {active === "profile" && <ProfileSection identity={identity} {...preferenceControls} onRequestSignOut={() => setShowSignOut(true)} />}
          {active === "appearance" && <AppearanceSection {...preferenceControls} />}
          {active === "plan" && (desktopUsage ? <PlanSection identity={identity} read={desktopUsage} /> : <StandalonePlanSection identity={identity} />)}
          {active === "agents" && <AgentsSection {...preferenceControls} />}
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
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-axiom-surface p-5 shadow-2xl">
            <h2 id="sign-out-title" className="text-lg font-semibold">Log out?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">You’ll be logged out of {DESKTOP_PRODUCT_NAME} on this device. Externally running workflows are not canceled.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button data-help-id="settings.workspace.sign-out-cancel" type="button" onClick={() => setShowSignOut(false)} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">Cancel</button>
              <button data-help-id="settings.workspace.sign-out-confirm" type="button" onClick={() => void signOut()} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-100">Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GeneralSection({ identity, onOpenSection, prefs, preferenceReadFailed, preferencesLocked, onSave, onOpenGovernance, onOpenExecutionLimits }: PreferenceSectionProps & {
  identity: VerifiedDesktopIdentity;
  onOpenSection: (section: Section) => void;
  preferenceReadFailed: boolean;
  onOpenGovernance: () => void;
  onOpenExecutionLimits: () => void;
}) {
  const [installedVersion, setInstalledVersion] = useState<string | null>();
  const [releasePageError, setReleasePageError] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    let current = true;
    mounted.current = true;
    async function readVersion() {
      try {
        // Same read-only core command used by the installed Tauri SDK's
        // getVersion. A source/package version is not an installed receipt.
        const value = await invoke<unknown>("plugin:app|version");
        const displayable = typeof value === "string" && value.length <= 64 && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value);
        if (current) setInstalledVersion(displayable ? value : null);
      } catch { if (current) setInstalledVersion(null); }
    }
    void readVersion();
    return () => { current = false; mounted.current = false; };
  }, []);
  async function reviewReleases() {
    setReleasePageError(false);
    try { await open(`${WEB_BASE}/download`); }
    catch { if (mounted.current) setReleasePageError(true); }
  }
  const access = useWorkspaceAccessOverview(identity);
  const owners = access.members?.filter(member => member.role === "owner" && member.acceptedAt &&
    Number.isFinite(Date.parse(member.acceptedAt))).map(member => member.displayName?.trim() || member.email) ?? [];
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <div className="studio-settings-general">
    <div className="studio-settings-overview-column">
    <h2 className="studio-settings-general-title">General</h2>
    <dl className="studio-settings-facts">
      <WorkspaceIdFact key={identity.organizationId} id={identity.organizationId} />
      <div><dt>Device time zone</dt><dd>{localZone || "Unavailable"}</dd></div>
      {identity.kind === "desktop_session" && <div className="studio-settings-owner-fact">
        <dt>{owners.length > 1 ? "Owners" : "Owner"}</dt>
        <dd>{access.members === undefined ? "Checking…" :
          access.members === null ? "Unavailable" : owners.length ? owners.join(", ") : "No accepted owner recorded"}</dd>
      </div>}
    </dl>
    <div className="studio-settings-configuration">
      {([
        {id: "environments", title: "Environments", description: "Review configured deployment targets.", action: "Review environments"},
        {id: "models", title: "Models & AI", description: "Review the workspace's model policy.", action: "Review models"},
        {id: "identity", title: "Security", description: "Review workspace identity settings.", action: "Review identity"},
      ] as const).map(({id, title, description, action}) => (
        <section key={id} aria-labelledby={`settings-overview-${id}`}>
          <h2 id={`settings-overview-${id}`}>{title}</h2>
          <div>
            <p>{description}</p>
            <button data-help-id={`settings.workspace.overview-${id}`} type="button" className="btn-secondary" onClick={() => onOpenSection(id)}>{action}</button>
          </div>
        </section>
      ))}
    </div>
    <section className="studio-settings-overview-links" aria-label="Account">
      <h2>Account</h2>
      <ActionRow title={identity.displayName?.trim() || "Account profile"} detail="Review the verified identity for this session." action={<button type="button" className="btn-secondary" onClick={() => onOpenSection("profile")}>Review profile</button>} />
      <ActionRow title="Account settings" detail="Manage your personal profile in the secure browser." action={<WebButton href="/account" label="Open" />} />
      {import.meta.env.DEV && <ActionRow title="Governance evidence preview" detail="Inspect saved evidence and baseline history. Enforcement and authoring remain unavailable in this local preview." action={<button data-help-id="settings.workspace.governance-evidence-preview" type="button" className="btn-secondary" onClick={onOpenGovernance}>Inspect saved Governance</button>} />}
      {import.meta.env.DEV && <ActionRow title="Execution limits preview" detail="Review or propose limits for an exact saved baseline. Limits do not enable Governance enforcement or provider actions." action={<button data-help-id="governance.execution-limits.entry" type="button" className="btn-secondary" onClick={onOpenExecutionLimits}>Review execution limits preview</button>} />}
      <ActionRow title="Workspace access" detail="Review the current plan, verified allowance, and desktop access." action={<button type="button" className="btn-secondary" onClick={() => onOpenSection("plan")}>Review plan</button>} />
    </section>
    </div>
    <div className="studio-settings-overview-column">
    {identity.kind === "desktop_session" && <WorkspaceAccessOverview access={access} onOpenPermissions={() => onOpenSection("permissions")} />}
    <section className="studio-settings-overview-links" aria-label="Approval policy">
      <h2>Approval policy</h2>
      <ActionRow title="Organization governance" detail="Review roles, policy proposals and independent approvals in the browser." action={<WebButton href="/control/governance" label="Open governance" />} />
    </section>
    <section className="studio-settings-overview-links" aria-label="Notifications">
      <h2>Notifications</h2>
      {preferenceReadFailed && <p role="alert" className="studio-settings-preference-issue">{preferenceReadIssue}</p>}
      <NotificationPreference prefs={prefs} onSave={onSave} preferencesLocked={preferencesLocked}/>
      <LockedRow title="Resume observation after restart" detail="Durable operation IDs are reconciled with the service after the app starts again." />
    </section>
    <section className="studio-settings-overview-links" aria-label="About this app">
      <h2>About this app</h2>
      <InfoRow label="Installed version" value={installedVersion === undefined ? "Checking…" : installedVersion ?? "Unavailable"} mono />
      <LatestReleaseRow installedVersion={installedVersion} />
      <ActionRow title="Desktop updates" detail="Website deployments do not replace this installed app. Review a verified desktop release before upgrading." action={<button data-help-id="settings.workspace.desktop-release-review" type="button" onClick={() => void reviewReleases()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/6">Review releases<ChevronRight className="h-3.5 w-3.5" /></button>} />
    </section>
    {releasePageError && <p role="alert" className="mt-2 text-xs leading-5 text-zinc-400">The download page could not be opened. Visit visionxixlabs.com/download in your browser.</p>}
    </div>
  </div>;
}

const notificationTestStatus: Record<NotificationRequestResult, string> = {
  requested: "Test requested. Check your system notifications.",
  disabled: "System notifications are turned off.",
  denied: "Allow notifications for V19 in system settings, then retry.",
  unavailable: "Could not request a test notification on this device.",
};

function NotificationPreference({prefs, onSave, preferencesLocked}: PreferenceSectionProps) {
  const [result, setResult] = useState<NotificationRequestResult>();
  const [testing, setTesting] = useState(false);
  const inFlight = useRef(false);
  const enabled = prefs?.notifications_enabled ?? false;
  async function testNotification() {
    if (!enabled || preferencesLocked || inFlight.current) return;
    inFlight.current = true;
    setTesting(true);
    setResult(undefined);
    try {
      setResult(await notifyResult({title: DESKTOP_PRODUCT_NAME, body: "V19 test notification."}));
    } finally {
      inFlight.current = false;
      setTesting(false);
    }
  }
  return <div className="studio-settings-notification">
    <ToggleRow title="System notifications" detail="Notify when an approval or deployment needs attention."
      enabled={enabled} disabled={preferencesLocked || !prefs || testing}
      onToggle={() => {
        setResult(undefined);
        if (prefs) void onSave({...prefs, notifications_enabled: !enabled});
      }}
      action={<button data-help-id="settings.workspace.notification-test" type="button"
        className="btn-secondary" disabled={preferencesLocked || !enabled} aria-disabled={testing}
        onClick={() => void testNotification()}>Test</button>}/>
    {enabled && <p className="studio-settings-notification-status" role="status">
      {testing ? "Requesting a test notification…" : result ? notificationTestStatus[result] : ""}
    </p>}
  </div>;
}

function WorkspaceIdFact({id}: {id: string}) {
  const [status, setStatus] = useState<"copied" | "unavailable">();
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);

  async function copyWorkspaceId() {
    const current = ++request.current;
    setStatus(undefined);
    try {
      await navigator.clipboard.writeText(id);
      if (request.current === current) setStatus("copied");
    } catch {
      if (request.current === current) setStatus("unavailable");
    }
  }

  return <div>
    <dt>Workspace ID</dt>
    <dd className="studio-settings-workspace-id">
      <span>{id}</span>
      <button type="button" aria-label="Copy workspace ID" title="Copy workspace ID" onClick={() => void copyWorkspaceId()}>
        <Copy size={13} aria-hidden="true" />
      </button>
      {status === "copied" && <p role="status">Workspace ID copied.</p>}
      {status === "unavailable" && <>
        <p role="status">Clipboard unavailable. Select the workspace ID to copy it manually.</p>
        <input type="text" aria-label="Workspace ID for manual copy" readOnly value={id} onFocus={event => event.currentTarget.select()} />
      </>}
    </dd>
  </div>;
}

type MembershipRead = { currentUserId: string; currentRole: string | null; capabilities: string[]; members: WorkspaceMember[] };

function manageMembership(read: MembershipRead | null | undefined) {
  if (!read?.capabilities?.includes("members:manage")) return undefined;
  const self = read.members.find(member => member.userId === read.currentUserId);
  return self?.acceptedAt && self.updatedAt ? self : undefined;
}

async function openWorkspaceMemberCockpit(organizationId: string, expectedUserId: string, owns: () => boolean) {
  if (!owns()) return false;
  const fresh = await desktopClient.listWorkspaceMembers();
  if (!owns() || !fresh.ok || fresh.data.currentUserId !== expectedUserId) return false;
  const currentMember = manageMembership(fresh.data);
  const now = Date.now();
  const hint = currentMember && parseBrowserNavigationIntent({
    destination: "members", expectedUserId, organizationId, membershipAcceptedAt: currentMember.acceptedAt,
    membershipUpdatedAt: currentMember.updatedAt, issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 300_000).toISOString(),
  }, now);
  if (!hint || !owns()) return false;
  // The browser rechecks authentication and the exact workspace and membership.
  await open(`${WEB_BASE}${browserNavigationIntentPath(hint)}`);
  return true;
}

function useWorkspaceAccessOverview(identity: VerifiedDesktopIdentity) {
  const paired = identity.kind === "desktop_session";
  const config = paired ? desktopClient.config : null;
  const revision = paired ? desktopClient.getContextRevision() : null;
  const {organizationId, userId} = identity;
  const scope = useMemo(() => ({config, revision, organizationId, userId}), [config, revision, organizationId, userId]);
  const activeScope = useRef<typeof scope | null>(scope);
  activeScope.current = scope;
  const [read, setRead] = useState<{scope: typeof scope; data: MembershipRead | null}>();
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState<typeof scope | null>(null);
  const [inviteError, setInviteError] = useState<typeof scope | null>(null);
  const inviteFlight = useRef<typeof scope | null>(null);
  const memberReadFlight = useRef<typeof scope | null>(null);
  const inviteStatus = useRef<HTMLParagraphElement>(null);
  const current = paired && read?.scope === scope ? read.data : undefined;
  const members = current === null ? null : current?.members;
  const self = manageMembership(current);
  useEffect(() => {
    if (!paired) return;
    activeScope.current = scope;
    const ownsRead = () => activeScope.current === scope && config === desktopClient.config && revision === desktopClient.getContextRevision();
    let current = true;
    memberReadFlight.current = scope;
    void desktopClient.listWorkspaceMembers().then(result => {
      if (!current || !ownsRead()) return;
      setRead({scope, data: result.ok && (!userId || result.data.currentUserId === userId) ? result.data : null});
    }).catch(() => {
      if (current && ownsRead()) setRead({scope, data: null});
    }).finally(() => {
      if (current && memberReadFlight.current === scope) memberReadFlight.current = null;
    });
    return () => {
      current = false;
      if (memberReadFlight.current === scope) memberReadFlight.current = null;
      if (activeScope.current === scope) activeScope.current = null;
    };
  }, [scope, config, revision, userId, attempt, paired]);

  useEffect(() => {
    if (inviteError === scope && document.activeElement === document.body) inviteStatus.current?.focus();
  }, [inviteError, scope]);

  async function inviteMember() {
    if (!self || !current || inviteFlight.current === scope) return;
    const owns = () => activeScope.current === scope && config === desktopClient.config && revision === desktopClient.getContextRevision();
    if (!owns()) return;
    inviteFlight.current = scope;
    setOpening(scope);
    setInviteError(null);
    function refuse() {
      if (!owns()) return;
      setRead({scope, data: null});
      setInviteError(scope);
    }
    try {
      if (!await openWorkspaceMemberCockpit(organizationId, current.currentUserId, owns)) refuse();
    } catch {
      refuse();
    } finally {
      if (inviteFlight.current === scope) inviteFlight.current = null;
      if (owns()) setOpening(null);
    }
  }

  const refreshMembers = useCallback(() => {
    if (!paired || activeScope.current !== scope || config !== desktopClient.config ||
      revision !== desktopClient.getContextRevision() || memberReadFlight.current === scope ||
      inviteFlight.current === scope) return false;
    memberReadFlight.current = scope;
    setRead(undefined);
    setInviteError(null);
    setAttempt(value => value + 1);
    return true;
  }, [paired, scope, config, revision]);

  return {members, canInvite: Boolean(self), opening: opening === scope,
    inviteFailed: inviteError === scope, inviteStatus, inviteMember, refreshMembers};
}

function WorkspaceAccessOverview({ access, onOpenPermissions }: {
  access: ReturnType<typeof useWorkspaceAccessOverview>;
  onOpenPermissions: () => void;
}) {
  const {members, canInvite, opening, inviteFailed, inviteStatus, inviteMember, refreshMembers} = access;
  const heading = useRef<HTMLHeadingElement>(null);
  const inviteButton = useRef<HTMLButtonElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const refreshDirectory = useCallback(() => {
    if (refreshMembers() &&
      (document.activeElement === inviteButton.current || document.activeElement === refreshButton.current)) {
      heading.current?.focus({preventScroll: true});
    }
  }, [refreshMembers]);
  useEffect(() => {
    window.addEventListener("focus", refreshDirectory);
    return () => window.removeEventListener("focus", refreshDirectory);
  }, [refreshDirectory]);
  return <section className="studio-settings-access" aria-labelledby="settings-access-heading">
    <div className="studio-settings-access-header">
      <h2 ref={heading} id="settings-access-heading" tabIndex={-1}>Access &amp; roles</h2>
      {canInvite && <button ref={inviteButton} type="button" className="btn-secondary" aria-disabled={opening} onClick={() => void inviteMember()}>
        <Plus size={14} aria-hidden="true"/>{opening ? "Opening…" : "Invite member"}
      </button>}
    </div>
    {members?.length ? <ul>
      {members.slice(0, 3).map(member => {
        const name = member.displayName?.trim() || member.email;
        const initials = name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
        const role = member.role === "owner" ? "Workspace owner" : ROLE_OPTIONS.find(option => option.value === member.role)?.label;
        const accepted = member.acceptedAt ? new Date(member.acceptedAt) : null;
        return <li key={member.userId}>
          <span className="studio-settings-member-avatar" aria-hidden="true">{initials}</span>
          <span className="studio-settings-member-name">
            <span>{name}</span>
            {accepted && Number.isFinite(accepted.getTime()) && <small>Accepted <time dateTime={accepted.toISOString()}>{accepted.toLocaleDateString()}</time></small>}
          </span>
          <span className="studio-settings-member-role">{role ?? "Role unavailable"}</span>
        </li>;
      })}
    </ul> : <p className="studio-settings-access-status" role="status">{
      members === undefined ? "Loading workspace members…" :
      members === null ? "Workspace members are unavailable." : "No workspace members were returned."
    }</p>}
    {inviteFailed && <p ref={inviteStatus} tabIndex={-1} role="alert" className="studio-settings-access-status">
      The workspace invitation page could not be verified. Refresh members to try again.
    </p>}
    <div className="studio-settings-access-footer">
      {members && members.length > 0 && <p className="studio-settings-member-count">
        {members.length} accepted {members.length === 1 ? "member" : "members"}
      </p>}
      {members === null && <button ref={refreshButton} type="button" className="btn-secondary" onClick={refreshDirectory}>Refresh members</button>}
      <button data-help-id="settings.workspace.overview-permissions" type="button" className="btn-secondary"
        onClick={onOpenPermissions}>View permissions</button>
    </div>
  </section>;
}

function ProfileSection({ identity, prefs, onSave, preferencesLocked, onRequestSignOut }: PreferenceSectionProps & { identity: VerifiedDesktopIdentity; onRequestSignOut: () => void }) {
  const email = identity.email ?? (identity.kind === "api_key" ? "Administrator credential" : "Not available");
  const shownEmail = prefs?.hide_email && email.includes("@") ? email.replace(/^(.{2}).*(@.*)$/, "$1••••$2") : email;
  return <div>
    <SectionHeading title="Profile" detail="Account & session identity details are provided by the authenticated web account and cannot be silently changed by the desktop app." />
    <Group label="Verified identity">
      <InfoRow label="Name" value={identity.displayName ?? "Not provided"} />
      <InfoRow label="Email" value={shownEmail} />
      <InfoRow label="Workspace" value={identity.organizationId} mono />
      <InfoRow label="Authentication" value={identity.kind === "desktop_session" ? "Browser-authorized desktop session" : "Enterprise recovery credential"} />
      <ToggleRow title="Hide email address" detail="Partially mask the address in this desktop interface." enabled={prefs?.hide_email ?? false} disabled={preferencesLocked || !prefs} onToggle={() => prefs && void onSave({ ...prefs, hide_email: !prefs.hide_email })} />
    </Group>
    <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/2 p-4">
      <div><p className="text-sm text-zinc-200">Log out on this device</p><p className="mt-1 text-xs text-zinc-500">Removes the local credential from the operating-system vault.</p></div>
      <button data-help-id="settings.workspace.sign-out-open" type="button" onClick={onRequestSignOut} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/6"><LogOut className="h-3.5 w-3.5" />Log out</button>
    </div>
  </div>;
}

function AppearanceSection({ prefs, onSave, preferencesLocked }: PreferenceSectionProps) {
  return <div>
    <SectionHeading title="Appearance" detail="These choices are stored locally and applied immediately across the installed app." />
    <Group label="Theme">
      <SelectRow title="Theme" detail="Choose a light or dark workspace, or follow your Mac appearance." value={prefs?.theme ?? "dark"} disabled={preferencesLocked || !prefs} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} onChange={(value) => prefs && void onSave({ ...prefs, theme: value as DesktopPreferences["theme"] })} />
      <SelectRow title="Interface density" detail="Compact reduces global type and control spacing." value={prefs?.interface_density ?? "comfortable"} disabled={preferencesLocked || !prefs} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} onChange={(value) => prefs && void onSave({ ...prefs, interface_density: value as DesktopPreferences["interface_density"] })} />
    </Group>
    <Group label="Accessibility">
      <ToggleRow title="Reduce motion" detail="Minimizes non-essential interface animation." enabled={prefs?.reduce_motion ?? false} disabled={preferencesLocked || !prefs} onToggle={() => prefs && void onSave({ ...prefs, reduce_motion: !prefs.reduce_motion })} />
      <ToggleRow title="High contrast" detail="Increases contrast across the application surface." enabled={prefs?.high_contrast ?? false} disabled={preferencesLocked || !prefs} onToggle={() => prefs && void onSave({ ...prefs, high_contrast: !prefs.high_contrast })} />
    </Group>
  </div>;
}

function StandalonePlanSection({ identity }: { identity: VerifiedDesktopIdentity }) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const read = useDesktopUsage(identity.organizationId, desktopClient.config, revision);
  return <PlanSection identity={identity} read={read} />;
}

function PlanSection({ identity, read }: { identity: VerifiedDesktopIdentity; read: DesktopUsageRead }) {
  const { usage, verifiedAt, error: usageError, loading, refresh } = read;
  const snapshot = usage?.billingSnapshot;
  const legacy = Boolean(usage && !snapshot);
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
    <div className="mb-4 flex items-center justify-between gap-4 text-xs text-zinc-500"><span>Changes made in the cockpit refresh when this window regains focus.</span><button data-help-id="settings.workspace.usage-refresh" type="button" disabled={loading} onClick={refresh} className="shrink-0 text-zinc-200 underline disabled:opacity-40">Refresh plan and usage</button></div>
    {verifiedAt !== undefined && <p className="mb-4 text-xs text-zinc-400">Last checked <time dateTime={new Date(verifiedAt).toISOString()}>{new Date(verifiedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {snapshot ? <>
        <SummaryCard label="Workspace plan" value={snapshot.plan.available?snapshot.plan.label:"Unavailable"} detail={snapshot.plan.available?snapshot.plan.status.replaceAll("_"," "):"Current subscription state could not be verified"}/>
        <SummaryCard label="Desktop access" value={access.allowed?"Active":access.title} detail={access.message}/>
      </> : legacy ? <>
        <SummaryCard label="Access model" value={accessModel} detail={access.title} />
        <SummaryCard label="Access state" value={isNoPlan ? "No plan" : isNoChargeAccess ? "Active" : access.billingStatus.replaceAll("_", " ")} detail={isNoPlan ? "Sign-in status does not establish a trial or paid subscription" : isNoChargeAccess ? "Provisioned for this workspace; no billing setup is required" : access.currentPeriodEndsAt ? `Period ends ${new Date(access.currentPeriodEndsAt).toLocaleDateString()}` : "Managed by your workspace agreement"} />
      </> : <>
        <SummaryCard label="Workspace plan" value={usageError?"Unavailable":"Verifying…"} detail="A current subscription is shown only after the billing service responds"/>
        <SummaryCard label="Desktop access" value={access.allowed?"Active":access.title} detail={access.message}/>
      </>}
    </div>
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/2.5 p-5">
      {snapshot ? <>
        <p className="text-sm text-zinc-200">{snapshot.plan.available?`${snapshot.plan.label} workspace plan`:"Billing verification unavailable"}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Billing records and verified credits are shared with the cockpit. A balance is not permission to run an Agent or bypass approvals.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button data-help-id="settings.workspace.billing-cockpit-current" type="button" onClick={()=>void open(`${WEB_BASE}/control/usage-billing`).catch(()=>setError("The billing cockpit could not be opened."))} className="text-xs text-zinc-200 underline">View billing in cockpit</button>
          {snapshot.plan.available&&snapshot.plan.hasCustomer&&snapshot.canManageBilling&&(identity.role==="owner"||identity.role==="admin")&&<button data-help-id="settings.workspace.billing-portal-current" type="button" disabled={opening} onClick={()=>void openBillingPortal()} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50">{opening?"Opening…":"Open billing"}</button>}
        </div>
        {error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
      </> : !legacy ? <div>
        <p className="text-sm text-zinc-200">{usageError?"Billing verification unavailable":"Verifying current plan and usage…"}</p>
        <button data-help-id="settings.workspace.billing-cockpit-legacy" type="button" onClick={()=>void open(`${WEB_BASE}/control/usage-billing`).catch(()=>setError("The billing cockpit could not be opened."))} className="mt-3 text-xs text-zinc-200 underline">View billing in cockpit</button>
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
          <div className="flex items-start justify-between gap-5"><div><p className="text-sm text-zinc-200">Manage billing securely</p><p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">A short-lived portal session opens in Stripe. Card data is never collected by this app.</p></div><button data-help-id="settings.workspace.billing-portal-legacy" type="button" disabled={opening||(identity.role!=="owner"&&identity.role!=="admin")} onClick={() => void openBillingPortal()} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50">{opening ? "Opening…" : "Open billing"}</button></div>
          {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
          <p className="mt-4 border-t border-white/6 pt-4 text-[11px] leading-5 text-zinc-400">A return from Checkout does not grant access by itself. Verified subscription state remains authoritative.</p>
        </>
      )}
    </div>
    {usage&&!snapshot&&<p role="status" className="mt-4 text-xs leading-5 text-amber-200">This service version does not report the current plan or allowance. Review them in the cockpit; the access label above is not a current subscription receipt.</p>}
    <UsageSummaryCard usage={usage} error={usageError}/>
  </div>;
}

function UsageSummaryCard({usage,error}:{usage:DesktopUsageSummary|null;error:string|null}) {
  const allowance=usage?.billingSnapshot?.allowance;
  const budget = usage?.billingSnapshot?.budget;
  const limit = budget?.available ? budget.limit : null;
  const money=(cents:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs text-zinc-500">AI usage this month{usage ? ` (${usage.periodMonth})` : ""}</p>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      {!usage && !error && <p className="text-xs text-zinc-400">Loading…</p>}
      {allowance&&<div className="mb-4 grid gap-4 sm:grid-cols-2">
        <SummaryCard label="AI allowance remaining" value={allowance.available?money(allowance.includedRemainingCents):"Unavailable"} detail={allowance.available?`${money(allowance.poolCents)} current account allowance · ${money(allowance.heldCents)} held for unresolved requests`:"No zero balance is inferred when the credit service is unavailable"}/>
        <SummaryCard label="Applied paid top-ups" value={allowance.available?money(allowance.addOnCents):"Unavailable"} detail="Only verified paid records increase available credits"/>
      </div>}
      {budget && <div className="mb-4">
        <SummaryCard
          label="Monthly workspace AI budget"
          value={limit ? `${money(limit.remainingCents)} remaining` : budget.available ? "No limit set" : "Unavailable"}
          detail={limit ? `${money(limit.monthlyLimitCents)} monthly limit · Separate from prepaid credits`
            : budget.available ? "Prepaid credits still limit AI usage." : "The workspace AI budget could not be verified."}
        />
        {limit?.warningReached && <p className="studio-billing-warning mt-2 text-xs">Budget warning threshold reached.</p>}
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

function AgentsSection({ prefs, onSave, preferencesLocked }: PreferenceSectionProps) {
  return <div>
    <SectionHeading title="Agents" detail="Conversation behavior is local. Authorization and production safety remain service enforced." />
    <Group label="Conversation">
      <ToggleRow title="Submit with ⌘ / Ctrl + Enter" detail="Use Command–Enter on Mac or Ctrl–Enter on Windows/Linux to send. Enter adds a new line; Shift–Enter always adds a new line." enabled={prefs?.submit_with_command_enter ?? false} disabled={preferencesLocked || !prefs} onToggle={() => prefs && void onSave({ ...prefs, submit_with_command_enter: !prefs.submit_with_command_enter })} />
      <SelectRow title="Messages sent while an agent is working" detail="Queue waits for the current operation; Interrupt asks the agent to stop at the next safe boundary." value={prefs?.new_message_behavior ?? "queue"} disabled={preferencesLocked || !prefs} options={[{ value: "queue", label: "Queue" }, { value: "interrupt", label: "Interrupt" }]} onChange={(value) => prefs && void onSave({ ...prefs, new_message_behavior: value as DesktopPreferences["new_message_behavior"] })} />
      <LockedRow title="Confirm consequential actions" detail="Merge, release, workflow dispatch, environment approval, rollback, and closure require policy checks." />
      <LockedRow title="External-file protection" detail="The customer workspace cannot write outside its approved application scope." />
    </Group>
    <ActionRow title="Workspace Agent policy" detail="Review organization-controlled Agent enablement and allowed tools. Desktop settings do not grant execution authority." action={<WebButton href="/control/ai-agents" label="Open Agent governance" />} />
    <Group label="Specialized Agent profiles">
      {AGENT_PROFILES.map(profile => <div key={profile.id} className="border-b border-white/5 px-4 py-3 last:border-0"><p className="text-xs text-zinc-200">{profile.label}</p><p className="mt-1 text-xs text-zinc-500">{profile.description}</p></div>)}
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
  const context = desktopClient.config;
  const {organizationId, userId} = identity;
  const revision = desktopClient.getContextRevision();
  const identityScope = JSON.stringify([organizationId, userId, identity.kind, identity.role, identity.capabilities]);
  const scope = useMemo(() => ({ context, organizationId, revision }), [context, identityScope, revision]);
  const activeScope = useRef<typeof scope | null>(scope);
  activeScope.current = scope;
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ scope: typeof scope; data: MembershipRead | null; error: string | null } | null>(null);
  const [saving, setSaving] = useState<{ scope: typeof scope; userId: string } | null>(null);
  const current = read?.scope === scope ? read : null;
  const members = current?.data?.members ?? null;
  const currentUserId = current?.data?.currentUserId ?? null;
  const error = current?.error ?? null;
  const savingUserId = saving?.scope === scope ? saving.userId : null;
  const [openingBrowser, setOpeningBrowser] = useState<typeof scope | null>(null);
  const browserOpenInFlight = useRef<typeof scope | null>(null);
  const ownMember = manageMembership(current?.data);
  const canManage = current?.data?.capabilities.includes("members:manage") ?? false;
  const load = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    let alive = true;
    setRead({ scope, data: null, error: null });
    void desktopClient.listWorkspaceMembers().then(result => {
      if (!alive || activeScope.current !== scope || desktopClient.config !== context || desktopClient.getContextRevision() !== revision) return;
      if (result.ok && userId && result.data.currentUserId !== userId) {
        setRead({ scope, data: null, error: "Workspace permissions could not be verified. Refresh to try again." });
        return;
      }
      setRead({ scope, data: result.ok ? result.data : null, error: result.ok ? null : result.error });
    }).catch(() => {
      if (alive && activeScope.current === scope && desktopClient.config === context && desktopClient.getContextRevision() === revision)
        setRead({ scope, data: null, error: "Workspace permissions could not be verified. Refresh to try again." });
    });
    window.addEventListener("focus", load);
    const unsubscribe = desktopClient.subscribeContext?.(load);
    return () => { alive = false; window.removeEventListener("focus", load); unsubscribe?.(); };
  }, [scope, context, revision, attempt, load, userId]);
  useEffect(() => { activeScope.current = scope; return () => { if (activeScope.current === scope) activeScope.current = null; }; }, [scope]);

  async function manageInCockpit() {
    if (!ownMember || !current?.data || browserOpenInFlight.current === scope) return;
    const owns = () => activeScope.current === scope && desktopClient.config === context && desktopClient.getContextRevision() === revision;
    if (!owns()) return;
    browserOpenInFlight.current = scope;
    setOpeningBrowser(scope);
    function refuse() {
      if (owns()) setRead({ scope, data: null, error: "Browser navigation could not be confirmed. Refresh Permissions before trying again." });
    }
    try {
      if (!await openWorkspaceMemberCockpit(organizationId, current.data.currentUserId, owns)) refuse();
    } catch {
      refuse();
    } finally {
      if (browserOpenInFlight.current === scope) browserOpenInFlight.current = null;
      if (owns()) setOpeningBrowser(null);
    }
  }

  async function changeRole(userId: string, role: Exclude<WorkspaceMember["role"], "owner">) {
    if (!canManage || savingUserId || desktopClient.config !== context || desktopClient.getContextRevision() !== revision) return;
    setSaving({ scope, userId });
    try {
      const result = await desktopClient.updateWorkspaceMemberRole(userId, role);
      if (activeScope.current !== scope || desktopClient.config !== context || desktopClient.getContextRevision() !== revision) return;
      setSaving(null);
      if (!result.ok) { setRead({ scope, data: null, error: result.error }); return; }
      load();
    } catch {
      if (activeScope.current === scope && desktopClient.config === context && desktopClient.getContextRevision() === revision) {
        setSaving(null); setRead({ scope, data: null, error: "Workspace role could not be updated. Refresh before trying again." });
      }
    }
  }

  return <div>
    <SectionHeading title="Permissions" detail="Give people only the authority they need. Every write, approval, deployment, and emergency bypass is checked by the service." />
    <Notice title={`Your role: ${(current?.data?.currentRole ?? "unverified").replaceAll("_", " ")}`} detail="Permissions are evaluated from current workspace membership on every request. Removing or changing a role takes effect immediately." />
    {error && <p role="alert" className="mb-4 text-[12px] text-rose-300">{error}</p>}
    <button data-help-id="settings.workspace.members-refresh" type="button" onClick={load} disabled={Boolean(savingUserId)} className="mb-4 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Refresh members</button>
    {canManage && ownMember?.acceptedAt && ownMember.updatedAt && <button data-help-id="settings.workspace.members-cockpit" type="button" onClick={() => void manageInCockpit()} disabled={openingBrowser === scope || Boolean(savingUserId)} className="mb-4 ml-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">{openingBrowser === scope ? "Opening…" : "Manage in cockpit"}</button>}
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
            : <select data-help-id="settings.workspace.member-role"
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
  customer_hosted: "Customer-hosted · offline",
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
  const [installationMode, setInstallationMode] = useState<string | undefined>(undefined);
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
    setInstallationMode(undefined);
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
          setInstallationMode(status.installationAIMode);
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
    <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-white/2">
      <div className="border-b border-white/6 p-4">
        <label htmlFor="model-search" className="sr-only">Search models</label>
        <input data-help-id="settings.workspace.model-search" id="model-search" maxLength={200} value={query} onChange={(event) => { setQuery(event.target.value); setCatalogPage(0); }} placeholder="Add or search model" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-hidden placeholder:text-zinc-400 focus:border-white/25" />
        <div className="mt-3 flex gap-2" role="group" aria-label="Model catalog filters">{[false, true].map(approved => <button data-help-id="settings.workspace.model-filter" key={String(approved)} type="button" aria-pressed={approvedOnly === approved} onClick={() => { setApprovedOnly(approved); setCatalogPage(0); }} className={`rounded-md px-2.5 py-1.5 text-[11px] ${approvedOnly === approved ? "bg-white/10 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}>{approved ? "Approved models" : "All models"}</button>)}</div>
        <p className="mt-2 text-[11px] text-zinc-400">{installationMode === "offline" ? "The deployment operator manages the local server and token cap. Choose one accepted model; missing or expired verification blocks calls. No cloud fallback." : "Gateway supports up to 32 approved models. Agent chat starts with the workspace default; choose another approved model in the composer. Search a model name or catalog ID, including Grok. Other providers retain one active model."}</p>
      </div>
      {installationMode === "offline" && policy?.enabled && <div className="flex justify-end border-b border-white/6 px-4 py-3"><button data-help-id="settings.workspace.model-disable-workspace-ai" type="button" disabled={Boolean(savingModel)} onClick={() => void saveModelPolicy({enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]}, "customer_hosted:disable")} className="text-xs text-zinc-300 underline underline-offset-2 disabled:opacity-45">Disable workspace AI</button></div>}
      {providers !== null && loadError === null && unavailableApprovalCount > 0 && <div className="flex items-center justify-between gap-3 border-b border-white/6 p-4 text-xs text-zinc-400"><p>{unavailableApprovalCount} approved Gateway model{unavailableApprovalCount === 1 ? " is" : "s are"} unavailable in the current catalog.</p><button data-help-id="settings.workspace.model-remove-unavailable" type="button" disabled={Boolean(savingModel)} onClick={() => void removeUnavailable()} className="shrink-0 text-zinc-200 underline underline-offset-2 disabled:opacity-45">Remove unavailable approvals</button></div>}
      {providers === null && loadError === null && <p className="p-4 text-sm text-zinc-500">Checking service-configured models…</p>}
      {loadError !== null && <div role="alert" className="flex items-center justify-between gap-4 p-4 text-sm text-rose-300"><p>{loadError}</p><button data-help-id="settings.workspace.model-retry" type="button" onClick={() => setAttempt((current) => current + 1)} className="shrink-0 text-xs text-zinc-300 underline underline-offset-2">Retry models</button></div>}
      {providers !== null && loadError === null && rows.length === 0 && <p className="p-4 text-sm text-zinc-500">{providers.every((provider) => provider.models.length === 0) ? installationMode === "offline" ? "No accepted local models are available. Ask the deployment operator to review verification and the workspace token budget." : "No service-configured models are available. Ask a workspace administrator to review service setup." : "No configured model matches this search."}</p>}
      {rows.slice(catalogOffset, catalogOffset + 50).map((model) => {
        const enabled = Boolean(policy && isModelApproved(policy, model.provider, model.id));
        const gatewayDefault = model.provider === "vercel_gateway" && policy?.enabled && policy.modelSelections.vercel_gateway === model.id;
        const key = `${model.provider}:${model.id}`;
        return <div key={key} className="flex items-center justify-between gap-4 border-b border-white/5.5 px-4 py-3.5 last:border-b-0">
          <div className="min-w-0"><p className="text-sm text-zinc-200">{model.label}{gatewayDefault && <span className="ml-2 text-[10px] text-zinc-300">Workspace default</span>}</p><p className="mt-0.5 text-[11px] text-zinc-400">{PROVIDER_LABELS[model.provider] ?? model.provider} · {model.provider === "customer_hosted" ? "Operator-reviewed limits" : model.managed ? "Service-managed legacy route" : model.tier}</p></div>
          <div className="flex shrink-0 items-center gap-3">
            {model.provider === "vercel_gateway" && model.available && enabled && !gatewayDefault && <button data-help-id="settings.workspace.model-make-default" type="button" aria-label={`Make ${model.label} workspace default`} disabled={Boolean(savingModel)} onClick={() => void makeDefault(model.id)} className="text-xs text-zinc-300 underline underline-offset-2 disabled:opacity-45">Make default</button>}
          <button data-help-id="settings.workspace.model-approval-toggle" type="button" role="switch" aria-checked={enabled} aria-label={model.available || model.managed ? `${enabled ? "Disable" : "Enable"} ${model.label}` : `Remove unavailable approval ${model.id}`} disabled={!policy || Boolean(savingModel) || model.provider === "vercel_gateway" && !isConcreteGatewayModelId(model.id) && !enabled} onClick={() => void toggleModel(model.provider, model.id)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-45 ${enabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
            <span aria-hidden className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          </div>
        </div>;
      })}
      {rows.length > 50 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 px-4 py-3 text-xs text-zinc-400">
        <p role="status">Showing {catalogOffset + 1}–{Math.min(catalogOffset + 50, rows.length)} of {rows.length} models. Search includes the full catalog.</p>
        <div className="flex gap-3">
          <button data-help-id="settings.workspace.model-previous" type="button" disabled={safeCatalogPage === 0} onClick={() => setCatalogPage(safeCatalogPage - 1)} className="rounded-md border border-white/10 px-3 py-1.5 hover:text-white disabled:opacity-40">Previous models</button>
          <button data-help-id="settings.workspace.model-next" type="button" disabled={catalogOffset + 50 >= rows.length} onClick={() => setCatalogPage(safeCatalogPage + 1)} className="rounded-md border border-white/10 px-3 py-1.5 hover:text-white disabled:opacity-40">Next models</button>
        </div>
      </div>}
    </div>
    <p className="mt-4 text-[11px] leading-5 text-zinc-400">Removing the Gateway default promotes the first remaining approval; removing its last approval disables Gateway. Credentials remain server-managed and never reach this device. Write actions remain approval-gated regardless of model choice.</p>
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
          <button data-help-id="settings.workspace.repository-clone"
            type="button"
            onClick={() => void cloneRepository()}
            disabled={status === "cloning" || !repositoryFullName.includes("/") || !destination}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-200 hover:bg-white/8 disabled:opacity-50"
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
          <button data-help-id="settings.workspace.pull-request-create"
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-200 hover:bg-white/8 disabled:opacity-50"
          >
            {step === "branch" ? "Creating branch…" : step === "commit" ? "Committing file…" : step === "pull_request" ? "Opening pull request…" : "Create pull request"}
          </button>
          {prUrl && <a data-help-id="settings.workspace.pull-request-link" href={prUrl} target="_blank" rel="noreferrer" className="text-[12px] text-emerald-300 underline">View pull request on GitHub</a>}
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
  id: string; slug: string; name: string; tier: string; displayOrder: number; hasApprovalPolicy: boolean; tags?: string[];
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
              <button data-help-id="settings.workspace.environments-create-standard-empty" type="button" onClick={() => void createStandardSet()} disabled={creating} className="rounded-md border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/8 disabled:opacity-50">
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
              <button data-help-id="settings.workspace.environments-create-standard-missing" type="button" onClick={() => void createStandardSet()} disabled={creating} className="rounded-md border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/8 disabled:opacity-50">
                {creating ? "Creating…" : "Add missing"}
              </button>
            }
          />
        )}
        {createError && <div className="px-4 py-2 text-[12px] text-rose-300">{createError}</div>}
        {(environments ?? []).map((env) => (
          <div key={env.id} className="border-b border-white/4.5 last:border-b-0">
            <ActionRow
              title={`${env.name} (${env.tier})`}
              detail={`slug: ${env.slug}${env.hasApprovalPolicy ? " · approval policy attached" : ""}${env.tags?.length ? ` · ${env.tags.join(" ")}` : ""}`}
              action={
                <button data-help-id="settings.workspace.environment-target-toggle" type="button" onClick={() => setExpandedId(expandedId === env.id ? null : env.id)} className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/6">
                  {expandedId === env.id ? "Hide" : "AWS deploy"}
                </button>
              }
            />
            {expandedId === env.id && <EnvironmentTagsEditor environment={env} onSaved={load} />}
            {expandedId === env.id && <DeploymentTargetPanel environment={env} environments={environments ?? []} identity={identity} />}
          </div>
        ))}
      </Group>
      {(environments ?? []).some((e) => e.tags?.length) && <FanOutPreview environments={environments ?? []} />}
      <NewEnvironmentForm onCreated={load} />
    </div>
  );
}

/** Edit key:value tags (tenant:acme, region:eu, ring:1). Saved with a compare-and-set on the tags shown. */
export function EnvironmentTagsEditor({ environment, onSaved }: { environment: EnvironmentListItem; onSaved: () => void }) {
  const [text, setText] = useState((environment.tags ?? []).join(" "));
  const [state, setState] = useState<{ kind: "idle" | "busy" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });
  const proposed = text.split(/[\s,]+/).filter(Boolean);
  const normalized = normalizeTags(proposed);
  async function save() {
    if (!normalized.ok) return;
    setState({ kind: "busy" });
    const r = await desktopClient.setEnvironmentTags(environment.id, normalized.tags, environment.tags ?? []).catch(() => ({ ok: false as const, error: "unavailable" }));
    if (r.ok) { setState({ kind: "saved" }); onSaved(); return; }
    setState({ kind: "error", message: r.error === "tags_changed" ? "Someone changed these tags. Reload the list and try again." : r.error === "desktop_session_required" ? "Only owners and admins can change environment tags." : "Tags could not be saved. Try again." });
  }
  return (
    <div className="mx-4 mb-3 rounded-lg border border-white/8 bg-white/[0.02] p-3 text-[12px]">
      <label className="block text-zinc-400">Tags (key:value, space separated)
        <input data-help-id="settings.workspace.environment-tags" value={text} onChange={(e) => { setText(e.target.value); setState({ kind: "idle" }); }} placeholder="tenant:acme region:eu ring:1" spellCheck={false} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[12px] text-zinc-200" />
      </label>
      {!normalized.ok && <p className="mt-1 text-amber-300">Use lowercase key:value tags, for example tenant:acme. Not valid: {normalized.invalid.join(", ")}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button data-help-id="settings.workspace.environment-tags-save" type="button" disabled={!normalized.ok || state.kind === "busy"} onClick={() => void save()} className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/6 disabled:opacity-50">{state.kind === "busy" ? "Saving…" : "Save tags"}</button>
        <span aria-live="polite" className={state.kind === "error" ? "text-amber-300" : "text-zinc-400"}>{state.kind === "saved" ? "Saved." : state.kind === "error" ? state.message : ""}</span>
      </div>
    </div>);
}

/** Preview which environments a tag selector would reach, in ring order. Planning only; nothing is deployed. */
export function FanOutPreview({ environments }: { environments: EnvironmentListItem[] }) {
  const [selector, setSelector] = useState("tenant:*");
  const plan = planFanOut(environments.map((e) => ({ id: e.id, name: e.name, tier: e.tier, tags: e.tags ?? [] })), selector);
  return (
    <Group label="Tenant fan-out preview">
      <div className="px-4 py-3 text-[12px]">
        <label className="block text-zinc-400">Tag selector (all terms must match; key:* matches any value)
          <input data-help-id="settings.workspace.fanout-selector" value={selector} onChange={(e) => setSelector(e.target.value)} spellCheck={false} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[12px] text-zinc-200" />
        </label>
        <div aria-live="polite" className="mt-3">
          {!plan.ok ? <p className="text-amber-300">Use key:value terms, for example tenant:* region:eu.</p>
            : plan.plan.matched === 0 ? <p className="text-zinc-400">No environments match.</p>
            : <ol className="space-y-1.5">{plan.plan.rings.map((r) => <li key={String(r.ring)}><span className="text-zinc-400">{r.ring === null ? "No ring (last)" : `Ring ${r.ring}`}:</span> <span className="text-zinc-200">{r.environments.map((e) => e.name).join(", ")}</span></li>)}</ol>}
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">A plan only. Each environment still deploys on its own, with its own policy, checks and approvals. A ring above 0 cannot deploy a commit until the previous ring has deployed it successfully.</p>
      </div>
    </Group>);
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
            <select data-help-id="settings.workspace.environment-tier" value={tier} onChange={(event) => setTier(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
              {["dev", "test", "qa", "uat", "stage", "preprod", "prod"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button data-help-id="settings.workspace.environment-create" type="button" onClick={() => void submit()} disabled={busy || !slug || !name} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-200 hover:bg-white/8 disabled:opacity-50">
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
  const [readiness, setReadiness] = useState<{ policyId: string | null; sourceCommitSha: string; pullRequestUrl: string | null; governanceMode: "policy_enforced" | "emergency_bypass"; databaseChanges?: DatabaseChangeEvidence } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [blockingChecks, setBlockingChecks] = useState<Array<{ key: string; name: string; kind: string; stage: string; enforced: boolean }> | "unavailable" | null>(null);
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => desktopClient.listBlockingDeploymentChecks()).then((r) => { if (live) setBlockingChecks(r.ok ? r.data.checks : "unavailable"); }, () => { if (live) setBlockingChecks("unavailable"); });
    return () => { live = false; };
  }, []);
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
            : result.error === "deployment_checks_blocking"
              ? "Blocking deployment checks for earlier stages have not passed in CI for this commit. Run them for this commit, or review them in Control → Checks. Nothing was dispatched."
              : result.error === "previous_ring_not_deployed"
                ? "This environment is in a later ring. Deploy this commit successfully to an environment in the previous ring first. Nothing was dispatched."
              : result.error === "ring_gate_unavailable"
                ? "Ring tags could not be checked, so nothing was dispatched. Try again shortly."
              : result.error === "deployment_checks_unavailable"
                ? "Deployment checks could not be read, so nothing was dispatched. Try again shortly."
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
    <div className="border-t border-white/4 bg-black/20 px-4 py-3.5 space-y-3">
      <div className="rounded-lg border border-white/[0.07] bg-white/2.5 px-3 py-2.5 text-[12px] text-zinc-400">
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
        <button data-help-id="settings.workspace.deploy-target-save" type="button" onClick={() => void save()} disabled={saving || !roleArn || !region || !ecsCluster || !ecsService} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-200 hover:bg-white/8 disabled:opacity-50">
          {saving ? "Saving…" : "Save deploy target"}
        </button>
        {saveOk && <span className="text-[12px] text-emerald-300">Saved</span>}
      </div>
      {saveError && <p role="alert" className="text-[12px] text-rose-300">{saveError}</p>}

      <div className="mt-2 border-t border-white/4 pt-3">
        <p className="mb-2 text-[11px] text-zinc-500">
          Add .github/workflows/axiom-deploy-aws-ecs.yml to the target repo once (see the Git &amp; PRs section to commit it via a pull request), then dispatch that workflow here. The bundled four-input template requests an ECS service restart; it does not release a new source artifact. Installed custom workflow behavior remains unverified.
        </p>
        <div className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[1.4fr_1fr_0.65fr_0.65fr_auto_auto]">
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Repository</span>
            <select data-help-id="settings.workspace.deploy-repository" value={deployRepo} onChange={(event) => { setDeployRepo(event.target.value); setReadiness(null); }} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
              {deployRepositories.length === 0 && <option value="">Register a GitHub repository first</option>}
              {deployRepositories.map((repository) => <option key={repository.id} value={repository.displayName}>{repository.displayName}</option>)}
            </select>
          </label>
          <LabeledInput label="Workflow source branch or tag" placeholder="main or v1.2.3" value={sourceRef} onChange={(value) => { setSourceRef(value); setReadiness(null); }} />
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Source type</span>
            <select data-help-id="settings.workspace.deploy-source-kind" value={sourceKind} onChange={(event) => { setSourceKind(event.target.value as "branch" | "tag"); setReadiness(null); }} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
              <option value="branch">Branch</option>
              <option value="tag">Tag</option>
            </select>
          </label>
          <LabeledInput label="PR number" placeholder="optional" value={pullRequestNumber} onChange={(value) => { setPullRequestNumber(value); setReadiness(null); }} />
          <button data-help-id="settings.workspace.deploy-readiness" type="button" onClick={() => void checkReadiness()} disabled={checkingReadiness || deploying || !deployRepo || !sourceRef.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-200 hover:bg-white/8 disabled:opacity-50 shrink-0">
            {checkingReadiness ? "Checking…" : "Check readiness"}
          </button>
          <button data-help-id="settings.workspace.deploy-dispatch" type="button" onClick={() => void triggerDeploy()} disabled={deploying || !deployRepo.includes("/") || !sourceRef.trim() || !readiness || (emergencyBypass && bypassReason.trim().length < 20)} title={readiness ? "Dispatch the policy-checked workflow; artifact release remains unverified" : "Check workflow policy before dispatch"} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/[0.14] disabled:opacity-50 shrink-0">
            {deploying ? "Dispatching…" : "Dispatch workflow"}
          </button>
        </div>
        {environment.tier !== "dev" && <p className="mt-3 text-[11px] text-zinc-500">A successful workflow is not source-artifact promotion evidence. Promotion remains blocked until artifact identity and provenance are verified.</p>}
        {environment.tier !== "dev" && (
          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] text-zinc-500">Prior workflow receipt (not verified artifact promotion)</span>
            <select data-help-id="settings.workspace.deploy-prior-receipt" value={promotedFromExecutionId} onChange={(event) => { setPromotedFromExecutionId(event.target.value); setReadiness(null); }} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
              <option value="">Select a prior workflow receipt…</option>
              {successfulExecutions.map((item) => {
                const sourceEnvironment = environments.find((candidate) => candidate.id === item.environmentId);
                return <option key={item.id} value={item.id}>{sourceEnvironment?.name ?? "Prior environment"} · {item.repositoryFullName} · {item.sourceCommitSha?.slice(0, 12)}</option>;
              })}
            </select>
          </label>
        )}
        {environment.tier === "prod" && identity.capabilities?.includes("deploy:production_bypass") && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/4 p-3">
            <label className="flex items-start gap-2 text-xs text-amber-200">
              <input data-help-id="settings.workspace.deploy-emergency-bypass" type="checkbox" checked={emergencyBypass} onChange={(event) => { setEmergencyBypass(event.target.checked); setReadiness(null); }} className="mt-0.5" />
              <span><strong>Emergency production bypass</strong><br /><span className="text-amber-200/70">Skips normal promotion evidence. Admin-only, reason required, and permanently audited.</span></span>
            </label>
            {emergencyBypass && <textarea data-help-id="settings.workspace.deploy-bypass-reason" aria-label="Emergency bypass reason" value={bypassReason} onChange={(event) => { setBypassReason(event.target.value); setReadiness(null); }} placeholder="Explain the incident and why the normal release path cannot be used (minimum 20 characters)." className="mt-3 min-h-20 w-full rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-hidden" />}
          </div>
        )}
        <BlockingChecksNote checks={blockingChecks} commit={readiness?.sourceCommitSha ?? null} bypass={emergencyBypass} />
        {readiness?.databaseChanges && <DatabaseChangesNote evidence={readiness.databaseChanges} />}
        {readinessError && <p role="alert" className="mt-2 text-[12px] text-rose-300">{readinessError}</p>}
        {readiness && (
          <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/6 px-3 py-2 text-[12px] text-emerald-200">
            Workflow policy check passed for source <span className="font-mono">{readiness.sourceCommitSha.slice(0, 12)}</span>
            {readiness.governanceMode === "emergency_bypass" ? " · emergency admin bypass will be audited" : readiness.policyId ? " · configured branch policy satisfied" : " · development target verified"}
            {readiness.pullRequestUrl && <> · <button data-help-id="settings.workspace.deploy-verified-pr-link" type="button" onClick={() => void open(readiness.pullRequestUrl!)} className="underline underline-offset-2">verified pull request</button></>}
          </div>
        )}
        {deployOk && !execution && <p className="text-[12px] text-amber-300">Workflow dispatched, but tracking could not be saved. Open GitHub Actions to verify the outcome.</p>}
        {deployError && <p role="alert" className="text-[12px] text-rose-300">{deployError}</p>}
        {execution && execution.environmentId === environmentId && (
          <div className="mt-3 rounded-lg border border-white/[0.07] bg-white/2.5 p-3 text-[12px]">
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
              <button data-help-id="settings.workspace.deploy-status-refresh" type="button" onClick={() => void refreshExecution()} disabled={refreshingExecution} className="rounded-md border border-white/10 px-2.5 py-1.5 text-zinc-300 hover:bg-white/6 disabled:opacity-50">{refreshingExecution ? "Refreshing…" : "Refresh status"}</button>
              {execution.workflowUrl && (
                <button data-help-id="settings.workspace.deploy-evidence-link" type="button" onClick={() => void open(execution.workflowUrl!)} className="rounded-md border border-white/10 px-2.5 py-1.5 text-zinc-300 hover:bg-white/6">
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
      <button data-help-id="settings.workspace.identity-provider-revoke" type="button" onClick={() => void revoke()} disabled={busy} className="rounded-md border border-rose-500/30 bg-rose-500/8 px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-500/[0.14] disabled:opacity-50">
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
            <select data-help-id="settings.workspace.identity-protocol" value={protocol} onChange={(event) => setProtocol(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
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
            <select data-help-id="settings.workspace.identity-mapped-role" value={role} onChange={(event) => setRole(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
              {["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input data-help-id="settings.workspace.identity-require-mfa-pending" type="checkbox" checked={requireMfaClaim} onChange={(event) => setRequireMfaClaim(event.target.checked)} />
          Require MFA claim at sign-in (fails closed if absent, once live)
        </label>
        <div className="flex items-center gap-3">
          <button data-help-id="settings.workspace.identity-provider-save-pending" type="button" onClick={() => void submit()} disabled={busy || !canSubmit} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-200 hover:bg-white/8 disabled:opacity-50">
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
          <button data-help-id="settings.workspace.scim-compute-preview" type="button" onClick={() => void preview()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-200 hover:bg-white/8 disabled:opacity-50">
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
      <div className="px-4 py-3.5 space-y-3 border-t border-white/4">
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Provider</span>
            <select data-help-id="settings.workspace.repository-provider" value={provider} onChange={(event) => setProvider(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
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
          <button data-help-id="settings.workspace.repository-register" type="button" onClick={() => void register()} disabled={busy || !remoteOwner || !remoteName} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-200 hover:bg-white/8 disabled:opacity-50">
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
      <div className="px-4 py-3.5 space-y-3 border-t border-white/4">
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Repository</span>
            <select data-help-id="settings.workspace.branch-policy-repository" value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
              {repositories.length === 0 && <option value="">Register a repository first</option>}
              {repositories.map((repository) => <option key={repository.id} value={repository.id}>{repository.displayName}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Environment</span>
            <select data-help-id="settings.workspace.branch-policy-environment" value={environmentId} onChange={(event) => { setEnvironmentId(event.target.value); setRequirePromotionFromEnvironmentId(""); }} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
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
              <input data-help-id="settings.workspace.branch-policy-requirement" type="checkbox" checked={item.checked} disabled={item.locked} onChange={(event) => item.set(event.target.checked)} />
              {item.label}
            </label>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] text-zinc-500">Promote only after a successful deploy in</span>
          <select data-help-id="settings.workspace.branch-policy-prior-environment" value={requirePromotionFromEnvironmentId} onChange={(event) => setRequirePromotionFromEnvironmentId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25">
            <option value="">No prior environment required</option>
            {environments.filter((candidate) => candidate.id !== environmentId).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.tier}</option>)}
          </select>
          {isProductionPolicy && <span className="mt-1 block text-[11px] text-amber-300">Production requires a prior environment, a merged PR, and passing tests.</span>}
        </label>
        <div className="flex items-center gap-3">
          <button data-help-id="settings.workspace.branch-policy-create" type="button" onClick={() => void create()} disabled={busy || !repositoryId || !environmentId || !branchPattern || (isProductionPolicy && !requirePromotionFromEnvironmentId)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-zinc-200 hover:bg-white/8 disabled:opacity-50">
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
      <input data-help-id="settings.workspace.labeled-text-field"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25"
      />
    </label>
  );
}

function LabeledTextArea({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
      <textarea data-help-id="settings.workspace.labeled-multiline-field"
        disabled={disabled}
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-white/25 font-mono"
      />
    </label>
  );
}

function WorktreesSection({ onOpenRepository }: {onOpenRepository?: () => void}) {
  return <div>
    <SectionHeading title="Worktrees" detail="Isolate tasks in separate local checkouts and branches without changing the original working tree." />
    <Notice title="Managed in GitHub repositories" detail="Open a repository and expand Workspaces to create or switch checkouts. New checkouts start at the selected checkout’s committed HEAD; uncommitted edits stay in their original checkout. Removing a checkout preserves its branch and commits and refuses changed, untracked, ignored or locked state." />
    <Group label="Local limits"><InfoRow label="Maximum checkouts per repository" value="25" /><InfoRow label="Combined file bytes per repository" value="50 GB" /></Group>
    {onOpenRepository && <button data-help-id="settings.workspace.repository-workspaces-open" type="button" onClick={onOpenRepository} className="btn-secondary">Open repository workspaces</button>}
  </div>;
}

function IntegrationsSection({ identity }: { identity: VerifiedDesktopIdentity }) {
  const validationRecovery=useSyncExternalStore(desktopClient.subscribeIntegrationValidationRecovery??(()=>()=>{}),desktopClient.integrationValidationRecoverySnapshot??(()=>''),()=> '');
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

  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const integrationMounted = useRef(true);
  const integrationGeneration = useRef(0);
  const integrationActionEpoch = useRef(0);
  const verifiedIntegrationContext = useRef<object | null>(null);
  const loadCloudConnections = useCallback(async () => {
    const generation = ++integrationGeneration.current;
    const context = desktopClient.config;
    const owned = () => integrationMounted.current && generation === integrationGeneration.current && context === desktopClient.config;
    setRefreshing(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_resolve, reject) => {timer = setTimeout(() => reject(new Error("connection_status_timeout")), 15000);});
      const [result, healthResult] = await Promise.race([Promise.allSettled([
        desktopClient.integrationStatus(), desktopClient.integrationHealth(),
      ] as const), deadline]);
      if (!owned()) return;
      const statusAvailable = result.status === "fulfilled" && result.value.ok;
      const healthAvailable = healthResult.status === "fulfilled" && healthResult.value.ok;
      verifiedIntegrationContext.current = statusAvailable ? context : null;
      setIntegrationStatus(result.status === "fulfilled" && result.value.ok ? result.value.data : null);
      setHealth(healthResult.status === "fulfilled" && healthResult.value.ok ? healthResult.value.data : null);
      setRefreshNote(!statusAvailable ? "Connection status could not be verified. Try refreshing."
        : !healthAvailable ? "Connection diagnostics could not be verified. Try refreshing." : null);
    } catch {
      if (owned()) {verifiedIntegrationContext.current = null; setIntegrationStatus(null); setHealth(null); setRefreshNote("Connection status could not be verified. Try refreshing.");}
    } finally {
      clearTimeout(timer);
      if (integrationMounted.current && generation === integrationGeneration.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    integrationMounted.current = true;
    const initialLoad = window.setTimeout(() => { void loadCloudConnections(); }, 0);
    const unsubscribe = desktopClient.subscribeContext(() => {
      integrationActionEpoch.current++; verifiedIntegrationContext.current = null;
      setIntegrationStatus(null); setHealth(null); setRefreshNote(null); setConnectionNote(null);
      setGithubValidationNote(null); setSlackValidationNote(null); setTeamsValidationNote(null); setLinearValidationNote(null);
      setValidatingGitHub(false); setValidatingSlack(false); setValidatingTeams(false); setValidatingLinear(false); setConnectingProvider(null);
      void loadCloudConnections();
    });
    window.addEventListener("focus", loadCloudConnections);
    return () => {
      integrationMounted.current = false; integrationGeneration.current++; integrationActionEpoch.current++; verifiedIntegrationContext.current = null;
      window.clearTimeout(initialLoad); unsubscribe();
      window.removeEventListener("focus", loadCloudConnections);
    };
  }, [loadCloudConnections]);

  const cloudConnections = integrationStatus?.cloud ?? null;
  const github = integrationStatus?.github ?? null;
  const collaboration = integrationStatus?.collaboration ?? null;
  const connectedCloudCount = cloudConnections?.filter(connection => connection.status === "connected").length ?? 0;
  const readOnlyCloudCount = cloudConnections?.filter(connection => connection.status === "read_only_connected").length ?? 0;
  const cloudState = cloudConnections
    ? [connectedCloudCount ? `${connectedCloudCount} verified` : "", readOnlyCloudCount ? `${readOnlyCloudCount} read-only connected` : ""].filter(Boolean).join(" · ") || (cloudConnections.some(connection => connection.status === "unavailable") ? "Status unavailable" : "Not connected")
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
      : github.status === "unavailable"
      ? "The saved GitHub App status could not be verified. Refresh to check the workspace connection."
      : "No active GitHub App installation is recorded for this workspace. Connect in the browser to choose repository scope."
    : "Loading the service-verified GitHub App state.";
  function connectionActionOwnership() {
    const context = desktopClient.config, epoch = integrationActionEpoch.current;
    return () => integrationMounted.current && epoch === integrationActionEpoch.current
      && context === desktopClient.config;
  }
  async function validateConnection(check: () => Promise<{ok: boolean;outcomeUnconfirmed?:boolean}>, setBusy: (value: boolean) => void,
    setNote: (value: string | null) => void, success: string, failure: string, collaborationProvider?:"slack"|"teams") {
    const owned = connectionActionOwnership(); if (!owned() || verifiedIntegrationContext.current !== desktopClient.config || collaborationProvider&&validationRecovery.split(',').includes(collaborationProvider)) return;
    setBusy(true); setNote(null);
    try {
      const result = await check(); if (!owned()) return;
      if(!result.ok&&result.outcomeUnconfirmed&&collaborationProvider){desktopClient.recordIntegrationValidationUnknown?.(collaborationProvider);setNote('Validation outcome is unconfirmed. Reload status and review consent before further validation.');return}
      setNote(result.ok ? success : failure);
      if (result.ok) await loadCloudConnections();
    } catch {if (owned()) {if(collaborationProvider){desktopClient.recordIntegrationValidationUnknown?.(collaborationProvider);setNote('Validation outcome is unconfirmed. Reload status and review consent before further validation.')}else setNote(failure);}}
    finally {if (integrationMounted.current && owned()) setBusy(false);}
  }
  const validateGitHub = () => validateConnection(() => desktopClient.validateGitHubReadOnly(), setValidatingGitHub, setGithubValidationNote,
    "GitHub read-only access is verified for this workspace.", "GitHub could not complete a read-only validation. Review the App installation and try again.");
  const validateSlack = () => validateConnection(() => desktopClient.validateSlackConnection(), setValidatingSlack, setSlackValidationNote,
    "Slack access is verified for this workspace.", "Slack could not complete a read-only validation. Reload status and review the consent record.", "slack");
  const validateTeams = () => validateConnection(() => desktopClient.validateTeamsConnection(), setValidatingTeams, setTeamsValidationNote,
    "Microsoft identity is verified for this workspace. Teams message permissions remain separately controlled.", "Microsoft could not complete an identity validation. Reload status and review the consent record.", "teams");
  const validateLinear = () => validateConnection(() => desktopClient.validateLinearConnection(), setValidatingLinear, setLinearValidationNote,
    "Linear app identity is verified for this workspace.", "Linear could not complete a read-only identity validation. Review consent and try again.");

  const slackCanValidate = collaboration?.some((connection) => connection.provider === "slack" && (connection.status === "awaiting_validation" || connection.status === "needs_attention")) ?? false;
  const teamsCanValidate = collaboration?.some((connection) => connection.provider === "teams" && (connection.status === "awaiting_validation" || connection.status === "needs_attention")) ?? false;
  const linearCanValidate = collaboration?.some((connection) => connection.provider === "linear" && (connection.status === "awaiting_validation" || connection.status === "needs_attention")) ?? false;

  async function connectProvider(provider: "github" | "slack" | "teams" | "linear") {
    const owned = connectionActionOwnership(); if (!owned() || verifiedIntegrationContext.current !== desktopClient.config) return;
    setConnectingProvider(provider);
    setConnectionNote(null);
    try {
      const result = await desktopClient.startIntegrationConnection(provider);
      if (!owned()) return;
      if (!result.ok) throw new Error(result.error);
      const destination = new URL(result.data.consentUrl);
      const allowedHosts: Record<typeof provider, readonly string[]> = {
        github: ["github.com"], slack: ["slack.com"], teams: ["login.microsoftonline.com"], linear: ["linear.app"],
      };
      if (destination.protocol !== "https:" || destination.username || destination.password || (destination.port && destination.port !== "443") || !allowedHosts[provider].includes(destination.hostname)) throw new Error("untrusted_consent_destination");
      await open(destination.toString());
      if (owned()) setConnectionNote("Secure consent opened in your browser. Return here after approval; status refreshes when this window regains focus.");
    } catch {
      if (owned()) setConnectionNote("The secure connection could not be started. Confirm this provider is configured for the workspace and try again.");
    } finally {
      if (owned()) setConnectingProvider(null);
    }
  }

  const providerStatus = (provider: "slack" | "teams" | "linear") => collaboration?.find((item) => item.provider === provider)?.status ?? "not_connected";
  const providerAction = (provider: "github" | "slack" | "teams" | "linear", status: string, canValidate: boolean, validating: boolean, validate: () => Promise<void>) => {
    if (!integrationStatus || status === "unavailable") return <button data-help-id="settings.workspace.connection-status-unavailable" type="button" disabled className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500">{refreshing ? "Checking…" : "Status unavailable"}</button>;
    if (integrationStatus.configuration?.[provider] === false) return <div className="shrink-0 text-right"><button data-help-id="settings.workspace.connection-configuration-unavailable" type="button" disabled aria-label={`Connect ${provider}`} title="The service connection is not configured." className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500">Connect</button><p className="mt-1 text-[10px] text-zinc-500">Service connection unavailable</p></div>;
    if(validationRecovery.split(',').includes(provider))return <div className="flex flex-wrap gap-2"><button data-help-id="settings.workspace.connection-status-reload" type="button" disabled={refreshing} className="btn-secondary" aria-label={`Reload ${provider==='teams'?'Teams':'Slack'} status`} onClick={()=>void loadCloudConnections()}>Reload status</button><WebButton href="/account/integrations" label="Review consent" /></div>;
    if (canValidate) return <button data-help-id="settings.workspace.connection-validate" type="button" disabled={validating} onClick={() => void validate()} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-zinc-100 disabled:opacity-50">{validating ? "Checking access…" : status === "validation_overdue" ? "Revalidate now" : "Finish connection"}</button>;
    if (status === "active" || status === "validated_read_only") return <WebButton href="/account/integrations" label="Manage" />;
    return <button data-help-id="settings.workspace.connection-consent-open" type="button" disabled={connectingProvider !== null} onClick={() => void connectProvider(provider)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-zinc-100 disabled:opacity-50">{connectingProvider === provider ? "Opening…" : "Connect ↗"}</button>;
  };

  return <div>
    <SectionHeading title="Integration Center" detail="Connect the systems that already run your releases. Every connection is tenant-scoped, least-privilege, and shown as connected only after server-side validation." />
    <p className="mb-4 text-xs leading-5 text-zinc-500">Review access in your browser, then return here for verified status. Cloud connections are read-only; deployment access stays separately governed.</p>
    <div className="space-y-3">
      <IntegrationRow name="GitHub" group="Source control" detail={githubDetail} state={githubState} tone={github?.status === "validation_overdue" ? "attention" : undefined} action={providerAction("github", github?.status ?? "not_connected", github?.status === "installation_recorded" || github?.status === "validation_overdue", validatingGitHub, validateGitHub)} />
      <IntegrationRow name="Slack" group="Collaboration" detail="Release notifications with channels:read and chat:write. Consent is not active access until V19 validates the token server-side." state={formatConnectorState(providerStatus("slack"))} action={providerAction("slack", providerStatus("slack"), slackCanValidate, validatingSlack, validateSlack)} />
      <IntegrationRow name="Microsoft Teams" group="Collaboration" detail="Verifies Microsoft workspace identity with PKCE. Message permissions remain separately gated." state={formatConnectorState(providerStatus("teams"))} action={providerAction("teams", providerStatus("teams"), teamsCanValidate, validatingTeams, validateTeams)} />
      <OutlookIntegrationCard />
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
    <div className="mt-4 grid gap-3"><AwsGuidedConnection identity={identity} /><AzureGuidedConnection identity={identity} /><GcpGuidedConnection identity={identity} /></div>
    <Disclosure className="mt-4 rounded-lg border border-white/10 bg-white/1.5 p-4" buttonClassName="text-sm font-medium text-zinc-200" label={<>Advanced cloud account connections <span className="ml-2 text-xs font-normal text-zinc-500">AWS and Azure · read-only</span></>}>
      <div className="mt-4"><AwsReadOnlyEnrollment identity={identity} /><AzureReadOnlyEnrollment identity={identity} /></div>
    </Disclosure>
    {refreshNote && <p role="status" className="mt-3 text-xs text-zinc-400">{refreshNote}</p>}
    {connectionNote && <p role="status" className="mt-3 text-xs text-zinc-400">{connectionNote}</p>}
    <p className="mt-4 text-xs leading-5 text-zinc-500">Approve only the workspace and access you intend to connect. Consent alone does not mark a connection verified.</p>
    <Disclosure className="mt-3 rounded-xl border border-white/[0.07] bg-white/2.5 p-4" buttonClassName="text-sm text-zinc-200" label="Connection diagnostics">
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        {health
          ? `${health.status.replaceAll("_", " ")} · ${health.summary.healthy} healthy · ${health.summary.degraded} needs attention · ${health.summary.preview} not yet live.`
          : "Checking the read-only health of connected-system foundations."}
      </p>
      <p className="mt-2 text-[11px] text-zinc-400">This is integration health only. Production release observation remains unavailable until an observability connection is verified.</p>
    </Disclosure>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <WebButton href="/account/integrations" label="Manage connections" />
      <button data-help-id="settings.workspace.connections-refresh" type="button" onClick={() => void loadCloudConnections()} disabled={refreshing} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/6 disabled:opacity-50">
        {refreshing ? "Checking…" : "Refresh verified status"}
      </button>
    </div>
    {githubValidationNote && <p className="mt-3 text-xs text-zinc-400">{githubValidationNote}</p>}
    {slackValidationNote && <p className="mt-3 text-xs text-zinc-400">{slackValidationNote}</p>}
    {teamsValidationNote && <p className="mt-3 text-xs text-zinc-400">{teamsValidationNote}</p>}
    {linearValidationNote && <p className="mt-3 text-xs text-zinc-400">{linearValidationNote}</p>}
  </div>;
}

type PreferenceSectionProps = { prefs: DesktopPreferences | null; preferencesLocked: boolean; onSave: (prefs: DesktopPreferences) => Promise<void> };
type Option = { value: string; label: string };

function SectionHeading({ title, detail }: { title: string; detail: string }) { return <div className="settings-section-heading mb-6"><h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">{detail}</p></div>; }
function Group({ label, children }: { label: string; children: ReactNode }) { return <section className="mb-6"><p className="mb-2 text-xs text-zinc-500">{label}</p><div className="overflow-hidden rounded-lg border border-white/5 bg-white/1.5">{children}</div></section>; }
/** Latest published desktop release versus this install. Read-only: it never downloads or installs anything. */
function LatestReleaseRow({ installedVersion }: { installedVersion: string | null | undefined }) {
  const [tag, setTag] = useState<string | null | undefined>();
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => desktopClient.releaseManifest()).then(result => { if (live) setTag(result.ok && typeof result.data?.tag === "string" ? result.data.tag : null); }).catch(() => { if (live) setTag(null); });
    return () => { live = false; };
  }, []);
  const state = desktopUpdateState(installedVersion, tag);
  const value = tag === undefined || installedVersion === undefined ? "Checking release…"
    : state.kind === "current" ? `${state.latest} · up to date`
    : state.kind === "available" ? `${state.latest} available`
    : state.kind === "ahead" ? `${state.latest} · this build is newer`
    : "Unavailable";
  return <div className="flex items-start justify-between gap-8 border-b border-white/4.5 px-4 py-3.5 last:border-b-0" data-update={state.kind}>
    <span className="text-sm text-zinc-400">Latest published</span>
    <span className="inline-flex items-center gap-2 text-right font-mono text-xs text-zinc-200">
      {state.kind === "current" && <StatusIconChip tone="green" shape="success" size={11}/>}
      {state.kind === "available" && <StatusIconChip tone="blue" shape="waiting" size={11}/>}
      {value}
    </span>
  </div>;
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-start justify-between gap-8 border-b border-white/4.5 px-4 py-3.5 last:border-b-0"><span className="text-sm text-zinc-400">{label}</span><span className={`max-w-[65%] break-all text-right text-sm text-zinc-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</span></div>; }
function ActionRow({ title, detail, action }: { title: string; detail: string; action: ReactNode }) { return <div className="flex items-center gap-4 border-b border-white/4.5 px-4 py-3.5 last:border-b-0"><div className="min-w-0 flex-1"><p className="text-sm text-zinc-200">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div>{action}</div>; }
function ToggleRow({ title, detail, enabled, disabled, onToggle, action }: { title: string; detail: string; enabled: boolean; disabled: boolean; onToggle: () => void; action?: ReactNode }) { return <ActionRow title={title} detail={detail} action={<div className="flex items-center gap-3">{action}<button data-help-id="settings.workspace.preference-toggle" type="button" role="switch" aria-checked={enabled} aria-label={title} disabled={disabled} onClick={onToggle} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-emerald-600" : "bg-zinc-700"} disabled:opacity-50`}><span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} /></button></div>} />; }
function SelectRow({ title, detail, value, disabled, options, onChange }: { title: string; detail: string; value: string; disabled: boolean; options: Option[]; onChange: (value: string) => void }) { return <ActionRow title={title} detail={detail} action={<select data-help-id="settings.workspace.preference-select" aria-label={title} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-axiom-surface px-3 py-2 text-xs text-zinc-200 outline-hidden disabled:opacity-50">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>} />; }
function LockedRow({ title, detail }: { title: string; detail: string }) { return <ActionRow title={title} detail={detail} action={<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300"><LockKeyhole className="h-3 w-3" />Always on</span>} />; }
function Notice({ title, detail }: { title: string; detail: string }) { return <div className="mb-6 rounded-lg border border-white/15 bg-white/4 p-4"><p className="text-sm font-medium text-zinc-100">{title}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{detail}</p></div>; }
function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-lg border border-white/5 bg-white/1.5 p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold capitalize">{value}</p><p className="mt-2 text-sm text-zinc-500">{detail}</p></div>; }
function formatConnectorState(state: string) { return state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function IntegrationRow({ name, group, detail, state, action, tone }: { name: string; group: string; detail: string; state: string; action?: ReactNode; tone?: "attention" }) {
  const connected = isVerifiedIntegrationStatus(state);
  const stateClass = tone === "attention"
    ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
    : connected ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-white/20 bg-white/10 text-zinc-200";
  const provider = ({GitHub:"github",Slack:"slack","Microsoft Teams":"teams",Linear:"linear"} as Record<string,CatalogProvider>)[name];
  const cloudGroup=name==="AWS, Azure & Google Cloud";
  return <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-white/1.5 px-4 py-3"><span className={`flex h-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-black/20 text-zinc-300 ${cloudGroup?"px-2":"w-8"}`}>{cloudGroup?<ProviderLogoGroup providers={["aws","azure","gcp"]}/>:provider?<ProviderLogo provider={provider}/>:<Link2 className="h-4 w-4" />}</span><div className="min-w-[140px] flex-1"><p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">{group}</p><p className="mt-0.5 text-sm text-zinc-200">{name}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[10px] ${stateClass}`}>{state}</span>{action}</div></div>;
}
function WebButton({ href, label, standalone = false }: { href: string; label: string; standalone?: boolean }) { return <button data-help-id="settings.workspace.browser-handoff" type="button" onClick={() => void open(`${WEB_BASE}${href}`)} className={`${standalone ? "mt-1" : ""} inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/6`}>{label}<ChevronRight className="h-3.5 w-3.5" /></button>; }

export function BlockingChecksNote({ checks, commit, bypass }: { checks: Array<{ key: string; name: string; kind: string; stage: string; enforced: boolean }> | "unavailable" | null; commit: string | null; bypass: boolean }) {
  if (checks === null) return null;
  if (checks === "unavailable") return <p className="mt-3 text-[11px] text-amber-300">Deployment checks could not be read. Dispatch is refused until they can be checked.</p>;
  if (checks.length === 0) return null;
  const stageName = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[12px] text-zinc-300" aria-label="Blocking deployment checks">
      <p>{bypass ? "The emergency bypass skips these blocking checks; the bypass is audited." : <>Before dispatch, these blocking checks must have passed {commit ? <>for <span className="font-mono">{commit.slice(0, 12)}</span></> : "for the source commit"} within the last 72 hours:</>}</p>
      <ul className="mt-2 space-y-1">{checks.map((c) => <li key={c.key}><span className="text-zinc-100">{c.name}</span> <span className="text-zinc-500">· {stageName(c.stage)} · {c.kind.replaceAll("_", " ")}{c.enforced ? "" : " · not enforced yet"}</span></li>)}</ul>
    </div>);
}

/** Advisory database-change evidence for the commit about to deploy. Never changes readiness. */
export function DatabaseChangesNote({ evidence }: { evidence: DatabaseChangeEvidence }) {
  const short = (sha: string) => sha.slice(0, 12);
  if (evidence.status === "detected") return (
    <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-[12px] text-amber-200" aria-label="Database changes">
      <p>This commit changes database migrations since the last successful deployment here (<span className="font-mono">{short(evidence.since)}</span>). Review the migration and its rollback before dispatching.</p>
      <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-amber-100/90">{evidence.paths.slice(0, 10).map((p) => <li key={p}>{p}</li>)}{evidence.paths.length > 10 && <li>…and {evidence.paths.length - 10} more</li>}</ul>
      {evidence.truncated && <p className="mt-1 text-[11px] text-amber-200/80">The comparison lists at most 300 files, so more may have changed.</p>}
    </div>);
  const text = evidence.status === "none_detected" ? `No database migration files changed since the last successful deployment here (${short(evidence.since)})${evidence.truncated ? "; the comparison was truncated, so check large changes yourself" : ""}.`
    : evidence.status === "first_deployment" ? "First recorded deployment of this repository here, so database changes could not be compared."
    : evidence.status === "same_commit" ? "This commit is already the last successful deployment here."
    : "Database changes could not be compared for this commit.";
  return <p className="mt-3 text-[11px] text-zinc-400" aria-label="Database changes">{text}</p>;
}

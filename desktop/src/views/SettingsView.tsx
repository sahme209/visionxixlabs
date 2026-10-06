import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import {
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
  Trees,
} from "lucide-react";
import { ViewShell } from "../components/Primitives";
import { desktopClient, type VerifiedDesktopIdentity } from "../lib/desktopClient";
import { clearApiKey } from "../lib/apiKeyStore";
import { clearAuthSession } from "../lib/authSession";
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
  { group: "Source control", name: "GitHub", detail: "Repositories, pull requests, workflows, and release evidence. Connection remains read-only until a workspace policy explicitly permits a write action.", state: "Browser setup" },
  { group: "Source control", name: "GitLab & Azure DevOps", detail: "Adapters and release data foundations exist, but customer activation is not presented as complete until OAuth, permissions, and recovery are verified end to end.", state: "In review" },
  { group: "Work management", name: "Jira, Linear & ServiceNow", detail: "Change-ticket context belongs on each release. Ticket creation or updates must be approval-gated and recorded in the release audit trail.", state: "In review" },
  { group: "Communication", name: "Slack & Microsoft Teams", detail: "Approval requests and release notifications are scoped to an approved workspace channel. Notifications never grant deployment authority.", state: "In review" },
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
  | "git"
  | "worktrees"
  | "integrations"
  | "environments"
  | "identity";

const sections: Array<{ id: Section; label: string; icon: typeof CircleUserRound }> = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "profile", label: "Profile", icon: CircleUserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "plan", label: "Plan & usage", icon: CreditCard },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "models", label: "Models", icon: Code2 },
  { id: "git", label: "Git & PRs", icon: GitBranch },
  { id: "environments", label: "Environments", icon: Server },
  { id: "identity", label: "Identity", icon: KeyRound },
  { id: "worktrees", label: "Worktrees", icon: Trees },
  { id: "integrations", label: "Integrations", icon: Link2 },
];

export function SettingsView({ identity }: { identity: VerifiedDesktopIdentity }) {
  const [active, setActive] = useState<Section>("general");
  const [prefs, setPrefs] = useState<DesktopPreferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);

  useEffect(() => {
    readDesktopPreferences().then(setPrefs).catch((cause) => setError(String(cause)));
  }, []);

  async function savePreferences(next: DesktopPreferences) {
    const previous = prefs;
    setError(null);
    setPrefs(next);
    try {
      await writeDesktopPreferences(next);
      markNotificationPrefDirty();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (cause) {
      if (previous) setPrefs(previous);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function signOut() {
    await Promise.allSettled([clearApiKey(), clearAuthSession()]);
    window.location.reload();
  }

  return (
    <ViewShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em]">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Desktop preferences, verified identity, approved access, and governed connections.</p>
      </div>

      <div className="grid min-h-[620px] grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="border-r border-white/[0.06] pr-3">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              aria-current={active === id ? "page" : undefined}
              className={`relative flex w-full items-center gap-3 rounded-md py-2 pl-3 pr-2 text-left text-[13px] transition-colors ${
                active === id ? "text-white" : "text-zinc-500 hover:text-zinc-300"
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

        <div className="min-w-0 pl-8">
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          {saved && <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"><Check className="h-4 w-4" />Saved on this computer.</div>}
          {active === "general" && <GeneralSection prefs={prefs} onSave={savePreferences} />}
          {active === "profile" && <ProfileSection identity={identity} prefs={prefs} onSave={savePreferences} onRequestSignOut={() => setShowSignOut(true)} />}
          {active === "appearance" && <AppearanceSection prefs={prefs} onSave={savePreferences} />}
          {active === "plan" && <PlanSection identity={identity} />}
          {active === "agents" && <AgentsSection prefs={prefs} onSave={savePreferences} />}
          {active === "models" && <ModelsSection />}
          {active === "git" && <GitSection prefs={prefs} onSave={savePreferences} />}
          {active === "environments" && <EnvironmentsSection />}
          {active === "identity" && <IdentitySection />}
          {active === "worktrees" && <WorktreesSection prefs={prefs} />}
          {active === "integrations" && <IntegrationsSection />}
        </div>
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
    </ViewShell>
  );
}

function GeneralSection({ prefs, onSave }: PreferenceSectionProps) {
  return <div>
    <SectionHeading title="General" detail="Application startup, notifications, and account management." />
    <Group label="Account">
      <ActionRow title="Axiom account" detail="Manage your profile and organization in the secure browser." action={<WebButton href="/dashboard/settings" label="Open" />} />
      <ActionRow title="Pilot access" detail="Pilot access is no-charge today. The service remains authoritative for approved workspace access." action={<span className="text-xs text-zinc-600">See Access & usage</span>} />
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
  const isPilot = access.planTier === "pilot" && access.billingStatus === "active";
  return <div>
    <SectionHeading title="Access & usage" detail="Approved pilot or commercial access is verified by the service before production records load." />
    <div className="grid gap-4 sm:grid-cols-2">
      <SummaryCard label="Access model" value={isPilot ? "No-charge pilot" : access.planTier} detail={access.title} />
      <SummaryCard label="Access state" value={access.billingStatus.replaceAll("_", " ")} detail={isPilot ? "Provisioned for this pilot workspace" : access.currentPeriodEndsAt ? `Period ends ${new Date(access.currentPeriodEndsAt).toLocaleDateString()}` : "Managed by your workspace agreement"} />
    </div>
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
      {isPilot ? (
        <div>
          <p className="text-sm text-zinc-200">Pilot access is no-charge</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">This workspace is in an approved early-access pilot. No card or checkout is needed, and production safeguards remain enforced.</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-5"><div><p className="text-sm text-zinc-200">Manage billing securely</p><p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">A short-lived portal session opens in Stripe. Card data is never collected by this app.</p></div><button type="button" disabled={opening} onClick={() => void openBillingPortal()} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50">{opening ? "Opening…" : "Open billing"}</button></div>
          {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
          <p className="mt-4 border-t border-white/[0.06] pt-4 text-[11px] leading-5 text-zinc-600">A return from Checkout does not grant access by itself. Verified subscription state remains authoritative.</p>
        </>
      )}
    </div>
    <UsageSummaryCard />
  </div>;
}

function UsageSummaryCard() {
  const [usage, setUsage] = useState<{ periodMonth: string; aiInvocationCount: number; aiInputTokens: number; aiOutputTokens: number; aiCostCents: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void desktopClient.usageSummary().then((result) => {
      if (result.ok) setUsage(result.data);
      else setError(result.error);
    });
  }, []);

  return (
    <div className="mt-6">
      <p className="mb-2 text-xs text-zinc-500">AI usage this month{usage ? ` (${usage.periodMonth})` : ""}</p>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      {!usage && !error && <p className="text-xs text-zinc-600">Loading…</p>}
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
      <SelectRow title="Messages sent while an agent is working" detail="Queue waits for the current operation; Interrupt asks the agent to stop at the next safe boundary." value={prefs?.new_message_behavior ?? "queue"} disabled={!prefs} options={[{ value: "queue", label: "Queue" }, { value: "interrupt", label: "Interrupt" }]} onChange={(value) => prefs && void onSave({ ...prefs, new_message_behavior: value as DesktopPreferences["new_message_behavior"] })} />
      <LockedRow title="Confirm consequential actions" detail="Merge, release, workflow dispatch, environment approval, rollback, and closure require policy checks." />
      <LockedRow title="External-file protection" detail="The customer workspace cannot write outside its approved application scope." />
    </Group>
    <Notice title="Execution controls are organization policy" detail="Run mode, allowlists, connector permissions, and approval thresholds are managed by the service. The desktop app does not offer local switches that could weaken them." />
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
  type ModelPolicy = { enabled: boolean; allowedProviders: string[]; modelSelections: Record<string, string>; fallbackOrder: string[] };
  type ProviderModels = { provider: string; models: Array<{ id: string; label: string; tier: string }> };
  const [providers, setProviders] = useState<ProviderModels[] | null>(null);
  const [policy, setPolicy] = useState<ModelPolicy | null>(null);
  const [query, setQuery] = useState("");
  const [savingModel, setSavingModel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void desktopClient.aiProviderStatus().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setProviders(result.data.providers);
        setPolicy(result.data.policy);
      } else {
        setLoadError(
          result.error === "desktop_session_required"
            ? "Your sign-in needs to refresh. Try signing out and back in."
            : "Could not load provider availability. Try again later.",
        );
      }
    });
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => (providers ?? [])
    .flatMap((provider) => provider.models.map((model) => ({ ...model, provider: provider.provider })))
    .filter((model) => {
      const needle = query.trim().toLowerCase();
      return !needle || model.label.toLowerCase().includes(needle) || (PROVIDER_LABELS[model.provider] ?? model.provider).toLowerCase().includes(needle);
    }), [providers, query]);

  async function toggleModel(provider: string, modelId: string) {
    if (!policy || savingModel) return;
    const selected = policy.enabled && policy.modelSelections[provider] === modelId;
    const nextAllowed = selected
      ? policy.allowedProviders.filter((item) => item !== provider)
      : [...policy.allowedProviders.filter((item) => item !== provider), provider];
    const nextSelections = { ...policy.modelSelections };
    if (selected) delete nextSelections[provider];
    else nextSelections[provider] = modelId;
    const nextPolicy: ModelPolicy = nextAllowed.length === 0
      ? { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] }
      : {
          enabled: true,
          allowedProviders: nextAllowed,
          modelSelections: nextSelections,
          fallbackOrder: [...policy.fallbackOrder.filter((item) => nextAllowed.includes(item)), ...nextAllowed.filter((item) => !policy.fallbackOrder.includes(item))],
        };
    setSavingModel(`${provider}:${modelId}`);
    setLoadError(null);
    const result = await desktopClient.updateAiProviderPolicy(nextPolicy);
    if (result.ok) setPolicy(result.data.policy);
    else setLoadError(result.error === "workspace_admin_required" ? "Only a workspace administrator can change model availability." : result.error);
    setSavingModel(null);
  }

  return <div>
    <SectionHeading title="Models" detail="Choose which service-configured models the Agent may use. Turning a model on updates the workspace policy immediately." />
    <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <div className="border-b border-white/[0.06] p-4">
        <label htmlFor="model-search" className="sr-only">Search models</label>
        <input id="model-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Add or search model" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25" />
        <p className="mt-2 text-[11px] text-zinc-600">One active model per provider. Multiple providers can be enabled and are used in fallback order.</p>
      </div>
      {providers === null && loadError === null && <p className="p-4 text-sm text-zinc-500">Checking service-configured models…</p>}
      {loadError !== null && <p role="alert" className="p-4 text-sm text-rose-300">{loadError}</p>}
      {providers !== null && rows.length === 0 && <p className="p-4 text-sm text-zinc-500">No configured model matches this search.</p>}
      {rows.map((model) => {
        const enabled = Boolean(policy?.enabled && policy.modelSelections[model.provider] === model.id);
        const key = `${model.provider}:${model.id}`;
        return <div key={key} className="flex items-center justify-between gap-4 border-b border-white/[0.055] px-4 py-3.5 last:border-b-0">
          <div className="min-w-0"><p className="text-sm text-zinc-200">{model.label}</p><p className="mt-0.5 text-[11px] text-zinc-600">{PROVIDER_LABELS[model.provider] ?? model.provider} · {model.tier}</p></div>
          <button type="button" role="switch" aria-checked={enabled} aria-label={`${enabled ? "Disable" : "Enable"} ${model.label}`} disabled={!policy || Boolean(savingModel)} onClick={() => void toggleModel(model.provider, model.id)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-45 ${enabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
            <span aria-hidden className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>;
      })}
    </div>
    <p className="mt-4 text-[11px] leading-5 text-zinc-600">Credentials remain server-managed and never reach this device. Write actions remain approval-gated regardless of model choice.</p>
  </div>;
}

function GitSection({ prefs, onSave }: PreferenceSectionProps) {
  return <div>
    <SectionHeading title="Git & PRs" detail="Repositories & triggers remain separately permissioned; local link and attribution preferences do not grant repository access." />
    <Group label="Pull requests">
      <SelectRow title="Review provider" detail="Choose how repository review links are constructed." value={prefs?.review_provider ?? "github"} disabled={!prefs} options={[{ value: "github", label: "GitHub" }, { value: "origin", label: "Repository origin" }]} onChange={(value) => prefs && void onSave({ ...prefs, review_provider: value as DesktopPreferences["review_provider"] })} />
      <SelectRow title="PR link destination" detail="Open supported PR links in the browser or in the application." value={prefs?.pr_link_destination ?? "browser"} disabled={!prefs} options={[{ value: "browser", label: "Default browser" }, { value: "inside_app", label: "Inside Axiom" }]} onChange={(value) => prefs && void onSave({ ...prefs, pr_link_destination: value as DesktopPreferences["pr_link_destination"] })} />
      <ToggleRow title="Commit attribution" detail="Mark agent-authored commits as made with Axiom when commit creation is available and authorized." enabled={prefs?.commit_attribution ?? false} disabled={!prefs} onToggle={() => prefs && void onSave({ ...prefs, commit_attribution: !prefs.commit_attribution })} />
      <ToggleRow title="PR attribution" detail="Mark agent-authored pull requests as made with Axiom." enabled={prefs?.pr_attribution ?? false} disabled={!prefs} onToggle={() => prefs && void onSave({ ...prefs, pr_attribution: !prefs.pr_attribution })} />
      <TextRow title="Branch prefix" detail="Stored locally for authorized branch creation." value={prefs?.branch_prefix ?? ""} disabled={!prefs} onCommit={(value) => prefs && void onSave({ ...prefs, branch_prefix: value })} />
    </Group>
    <CloneRepositoryPanel />
    <CreatePullRequestPanel />
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

  async function submit() {
    setError(null);
    setPrUrl(null);

    setStep("branch");
    const branchResult = await desktopClient.createGithubBranch({ repositoryFullName, baseBranch, newBranchName });
    if (!branchResult.ok) {
      setError(`Branch creation failed: ${branchResult.error}. Nothing else was changed.`);
      setStep("idle");
      return;
    }

    setStep("commit");
    const commitResult = await desktopClient.commitGithubFile({ repositoryFullName, branch: newBranchName, path: filePath, content: fileContent, message: commitMessage });
    if (!commitResult.ok) {
      setError(`Branch "${newBranchName}" was created, but committing the file failed: ${commitResult.error}. The branch still exists on GitHub — you can finish the commit there, or delete the branch and retry.`);
      setStep("idle");
      return;
    }

    setStep("pull_request");
    const prResult = await desktopClient.openGithubPullRequest({ repositoryFullName, head: newBranchName, base: baseBranch, title: prTitle, body: prBody });
    if (!prResult.ok) {
      setError(`Branch "${newBranchName}" and the commit both succeeded, but opening the pull request failed: ${prResult.error}. You can open the PR directly on GitHub from that branch.`);
      setStep("idle");
      return;
    }

    setPrUrl(prResult.data.htmlUrl);
    setStep("done");
  }

  return (
    <Group label="Create a pull request">
      <div className="px-4 py-3.5 space-y-3">
        <LabeledInput label="Repository" placeholder="owner/repo" value={repositoryFullName} onChange={setRepositoryFullName} />
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label="Base branch" placeholder="main" value={baseBranch} onChange={setBaseBranch} />
          <LabeledInput label="New branch name" placeholder="axiom/my-change" value={newBranchName} onChange={setNewBranchName} />
        </div>
        <LabeledInput label="File path" placeholder="path/to/file.ts" value={filePath} onChange={setFilePath} />
        <LabeledTextArea label="File content" value={fileContent} onChange={setFileContent} />
        <LabeledInput label="Commit message" placeholder="Describe the change" value={commitMessage} onChange={setCommitMessage} />
        <LabeledInput label="Pull request title" placeholder="Short summary" value={prTitle} onChange={setPrTitle} />
        <LabeledTextArea label="Pull request description" value={prBody} onChange={setPrBody} />
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

function EnvironmentsSection() {
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
      <SectionHeading title="Environments" detail="Dev/test/prod separation for real deploys. Configure an AWS ECS deploy target per environment, then trigger a deploy by dispatching your repo's own GitHub Actions workflow." />
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
            {expandedId === env.id && <DeploymentTargetPanel environmentId={env.id} />}
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

function DeploymentTargetPanel({ environmentId }: { environmentId: string }) {
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
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployOk, setDeployOk] = useState(false);

  useEffect(() => {
    void desktopClient.getDeploymentTarget(environmentId).then((result) => {
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
      setLoaded(true);
    });
  }, [environmentId]);

  async function save() {
    setSaving(true); setSaveError(null); setSaveOk(false);
    try {
      const result = await desktopClient.saveDeploymentTarget({ environmentId, roleArn, region, ecsCluster, ecsService });
      if (!result.ok) { setSaveError(result.error); return; }
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  async function triggerDeploy() {
    setDeploying(true); setDeployError(null); setDeployOk(false);
    try {
      const result = await desktopClient.triggerAwsDeploy({ repositoryFullName: deployRepo, environmentId });
      if (!result.ok) { setDeployError(result.error); return; }
      setDeployOk(true);
    } finally {
      setDeploying(false);
    }
  }

  if (!loaded) return <div className="px-4 py-3 text-[12px] text-zinc-500">Loading deploy target…</div>;
  if (loadError) return <div className="px-4 py-3 text-[12px] text-rose-300">{loadError}</div>;

  return (
    <div className="border-t border-white/[0.04] bg-black/20 px-4 py-3.5 space-y-3">
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
          Add .github/workflows/axiom-deploy-aws-ecs.yml to the target repo once (see the Git &amp; PRs section to commit it via a pull request), then trigger a deploy here:
        </p>
        <div className="flex items-center gap-3">
          <LabeledInput label="Repository" placeholder="owner/repo" value={deployRepo} onChange={setDeployRepo} />
          <button type="button" onClick={() => void triggerDeploy()} disabled={deploying || !deployRepo.includes("/")} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/[0.14] disabled:opacity-50 shrink-0">
            {deploying ? "Deploying…" : "Deploy"}
          </button>
        </div>
        {deployOk && <p className="text-[12px] text-emerald-300">Deploy dispatched — check the repository&apos;s Actions tab for progress.</p>}
        {deployError && <p role="alert" className="text-[12px] text-rose-300">{deployError}</p>}
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

function LabeledInput({ label, placeholder, value, onChange }: { label: string; placeholder?: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25"
      />
    </label>
  );
}

function LabeledTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25 font-mono"
      />
    </label>
  );
}

function WorktreesSection({ prefs }: { prefs: DesktopPreferences | null }) {
  return <div>
    <SectionHeading title="Worktrees" detail="Axiom does not currently create or clean up Git worktrees in the verified customer workflow." />
    <Notice title="No Axiom-managed worktrees on this machine" detail="Cleanup controls remain unavailable until worktree lifecycle operations, disk accounting, and recovery behavior are implemented and tested end to end." />
    <Group label="Reserved local limits">
      <InfoRow label="Maximum worktrees" value={String(prefs?.max_worktrees ?? 25)} />
      <InfoRow label="Maximum total size" value={`${prefs?.max_worktree_size_gb ?? 50} GB`} />
    </Group>
  </div>;
}

function IntegrationsSection() {
  const [integrationStatus, setIntegrationStatus] = useState<{
    cloud: Array<{ provider: "aws" | "azure" | "gcp"; status: string; lastTransitionAt: string | null }>;
    github: { status: string; repositorySelection: string };
    collaboration: Array<{ provider: "slack" | "teams"; status: string; lastValidatedAt: string | null }>;
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
  const collaborationState = collaboration
    ? collaboration.some((connection) => connection.status === "active")
      ? `${collaboration.filter((connection) => connection.status === "active").length} verified`
    : collaboration.some((connection) => connection.status === "awaiting_validation")
      ? "Consent in progress"
      : "Not connected"
    : "Checking status";
  const collaborationDetail = collaboration
    ? collaboration.map((connection) => `${connection.provider === "teams" ? "Teams" : "Slack"} ${connection.status.replaceAll("_", " ")}`).join(" · ")
    : "Loading the service-verified Slack and Teams connection state.";

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

  const slackCanValidate = collaboration?.some((connection) => connection.provider === "slack" && (connection.status === "awaiting_validation" || connection.status === "needs_attention")) ?? false;
  const teamsCanValidate = collaboration?.some((connection) => connection.provider === "teams" && (connection.status === "awaiting_validation" || connection.status === "needs_attention")) ?? false;

  return <div>
    <SectionHeading title="Integration Center" detail="Connect the systems that already run your releases. Every connection is tenant-scoped, least-privilege, and shown as connected only after server-side validation." />
    <Notice title="No secrets in the desktop app" detail="Connections open in the secure browser. The desktop app never collects an identity-provider password or long-lived provider secret, and no connection can silently gain write access." />
    <div className="space-y-3">
      {INTEGRATION_CENTER_ITEMS.map((item) => (
        <IntegrationRow
          key={item.name}
          name={item.name}
          group={item.group}
          detail={item.name === "AWS, Azure & Google Cloud" ? `${item.detail} Current workspace state: ${cloudDetail}` : item.name === "GitHub" ? githubDetail : item.name === "Slack & Microsoft Teams" ? `${item.detail} Current workspace state: ${collaborationDetail}` : item.detail}
          state={item.name === "AWS, Azure & Google Cloud" ? cloudState : item.name === "GitHub" ? githubState : item.name === "Slack & Microsoft Teams" ? collaborationState : item.state}
        />
      ))}
    </div>
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
    <div className="mt-5 flex items-center gap-3">
      <WebButton href="/connect/github" label="Connect GitHub" />
      <button type="button" onClick={() => void validateGitHub()} disabled={validatingGitHub || (github?.status !== "installation_recorded" && github?.status !== "validation_overdue")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">
        {validatingGitHub ? "Validating GitHub…" : "Validate read-only access"}
      </button>
      <button type="button" onClick={() => void validateSlack()} disabled={validatingSlack || !slackCanValidate} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">
        {validatingSlack ? "Validating Slack…" : "Validate Slack"}
      </button>
      <button type="button" onClick={() => void validateTeams()} disabled={validatingTeams || !teamsCanValidate} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">
        {validatingTeams ? "Validating Microsoft…" : "Validate Microsoft"}
      </button>
      <button type="button" onClick={() => void loadCloudConnections()} disabled={refreshing} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">
        {refreshing ? "Checking…" : "Refresh verified status"}
      </button>
    </div>
    {githubValidationNote && <p className="mt-3 text-xs text-zinc-400">{githubValidationNote}</p>}
    {slackValidationNote && <p className="mt-3 text-xs text-zinc-400">{slackValidationNote}</p>}
    {teamsValidationNote && <p className="mt-3 text-xs text-zinc-400">{teamsValidationNote}</p>}
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
function TextRow({ title, detail, value, disabled, onCommit }: { title: string; detail: string; value: string; disabled: boolean; onCommit: (value: string) => void }) { return <ActionRow title={title} detail={detail} action={<input key={value} aria-label={title} defaultValue={value} disabled={disabled} onBlur={(event) => { const next = event.currentTarget.value.trim(); if (next !== value) onCommit(next); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-40 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25 disabled:opacity-50" />} />; }
function LockedRow({ title, detail }: { title: string; detail: string }) { return <ActionRow title={title} detail={detail} action={<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300"><LockKeyhole className="h-3 w-3" />Always on</span>} />; }
function Notice({ title, detail }: { title: string; detail: string }) { return <div className="mb-6 rounded-lg border border-white/15 bg-white/[0.04] p-4"><p className="text-sm font-medium text-zinc-100">{title}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{detail}</p></div>; }
function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold capitalize">{value}</p><p className="mt-2 text-sm text-zinc-500">{detail}</p></div>; }
function IntegrationRow({ name, group, detail, state }: { name: string; group: string; detail: string; state: string }) {
  const connected = /verified|connected/i.test(state) && !/not connected/i.test(state);
  return <div className="flex items-start gap-4 rounded-lg border border-white/[0.05] bg-white/[0.015] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.05] bg-black/20 text-zinc-300"><Link2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">{group}</p><p className="mt-0.5 text-sm text-zinc-200">{name}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${connected ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-white/20 bg-white/10 text-zinc-200"}`}>{state}</span></div>;
}
function WebButton({ href, label, standalone = false }: { href: string; label: string; standalone?: boolean }) { return <button type="button" onClick={() => void open(`${WEB_BASE}${href}`)} className={`${standalone ? "mt-1" : ""} inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]`}>{label}<ChevronRight className="h-3.5 w-3.5" /></button>; }

import { useEffect, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-shell";
import {
  Bot,
  Check,
  ChevronRight,
  CircleUserRound,
  Cloud,
  Code2,
  CreditCard,
  GitBranch,
  Link2,
  LockKeyhole,
  LogOut,
  Palette,
  Settings2,
  ShieldCheck,
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

type Section =
  | "general"
  | "profile"
  | "appearance"
  | "plan"
  | "agents"
  | "models"
  | "git"
  | "worktrees"
  | "integrations";

const sections: Array<{ id: Section; label: string; icon: typeof CircleUserRound }> = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "profile", label: "Profile", icon: CircleUserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "plan", label: "Plan & usage", icon: CreditCard },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "models", label: "Models", icon: Code2 },
  { id: "git", label: "Git & PRs", icon: GitBranch },
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
        <p className="mt-1 text-sm text-zinc-500">Desktop preferences, verified identity, commercial access, and governed connections.</p>
      </div>

      <div className="grid min-h-[620px] grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0c0e]">
        <nav aria-label="Settings sections" className="border-r border-white/[0.07] bg-black/20 p-3">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActive(id)} aria-current={active === id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition ${active === id ? "bg-white/[0.075] text-white" : "text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200"}`}>
              <Icon aria-hidden className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
          <div className="mt-5 border-t border-white/[0.06] px-3 pt-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Signed in workspace</p>
            <p className="mt-2 truncate text-xs text-zinc-300" title={identity.organizationId}>{identity.organizationId}</p>
            <p className="mt-1 text-[11px] text-emerald-300">Service verified</p>
          </div>
        </nav>

        <div className="min-w-0 p-7">
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          {saved && <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"><Check className="h-4 w-4" />Saved on this computer.</div>}
          {active === "general" && <GeneralSection prefs={prefs} onSave={savePreferences} />}
          {active === "profile" && <ProfileSection identity={identity} prefs={prefs} onSave={savePreferences} onRequestSignOut={() => setShowSignOut(true)} />}
          {active === "appearance" && <AppearanceSection prefs={prefs} onSave={savePreferences} />}
          {active === "plan" && <PlanSection identity={identity} />}
          {active === "agents" && <AgentsSection prefs={prefs} onSave={savePreferences} />}
          {active === "models" && <ModelsSection />}
          {active === "git" && <GitSection prefs={prefs} onSave={savePreferences} />}
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
      <ActionRow title="Plan & billing" detail="Billing opens through a short-lived bearer-authenticated portal session from Plan & usage." action={<span className="text-xs text-zinc-600">See Plan & usage</span>} />
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
  return <div>
    <SectionHeading title="Plan & usage" detail="Commercial access is verified by the service before production records load." />
    <div className="grid gap-4 sm:grid-cols-2">
      <SummaryCard label="Current plan" value={access.planTier} detail={access.title} />
      <SummaryCard label="Billing state" value={access.billingStatus.replaceAll("_", " ")} detail={access.currentPeriodEndsAt ? `Period ends ${new Date(access.currentPeriodEndsAt).toLocaleDateString()}` : "Managed by your workspace agreement"} />
    </div>
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-5"><div><p className="text-sm text-zinc-200">Manage billing securely</p><p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">A short-lived portal session opens in Stripe. Card data is never collected by this app.</p></div><button type="button" disabled={opening} onClick={() => void openBillingPortal()} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50">{opening ? "Opening…" : "Open billing"}</button></div>
      {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
      <p className="mt-4 border-t border-white/[0.06] pt-4 text-[11px] leading-5 text-zinc-600">A return from Checkout does not grant access by itself. Verified subscription state remains authoritative.</p>
    </div>
  </div>;
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

function ModelsSection() {
  return <div>
    <SectionHeading title="Models" detail="Model availability is provisioned by the workspace service. Axiom does not imply that an unconfigured provider is active." />
    <Group label="Current product behavior">
      <PolicyRow title="Human-confirmed AI output" detail="Generated playbook content remains proposed until a person reviews it." />
      <PolicyRow title="No desktop BYOK fields" detail="Provider credentials are not accepted by this build. Organization-managed model routing is configured outside the desktop client." />
      <PolicyRow title="Availability is explicit" detail="Unsupported models and providers are not rendered as usable choices." />
    </Group>
    <WebButton href="/capabilities" label="Review released capabilities" standalone />
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
  </div>;
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
  return <div>
    <SectionHeading title="Integrations" detail="Connections are tenant-scoped and administrator configured. A provider is not called connected until the service validates it." />
    <div className="space-y-3">
      <IntegrationRow icon={<GitBranch className="h-4 w-4" />} name="GitHub" detail="Repository discovery, reviews, merges, releases, and workflow dispatch remain separately permissioned." />
      <IntegrationRow icon={<Cloud className="h-4 w-4" />} name="AWS" detail="Assume-role connectivity requires customer and broker configuration before verification." />
      <IntegrationRow icon={<Link2 className="h-4 w-4" />} name="Change systems" detail="Change creation and updates depend on the configured adapter and playbook policy." />
    </div>
    <WebButton href="/integrations" label="Open integration setup" standalone />
  </div>;
}

type PreferenceSectionProps = { prefs: DesktopPreferences | null; onSave: (prefs: DesktopPreferences) => Promise<void> };
type Option = { value: string; label: string };

function SectionHeading({ title, detail }: { title: string; detail: string }) { return <div className="mb-7"><h2 className="text-xl font-semibold tracking-tight">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{detail}</p></div>; }
function Group({ label, children }: { label: string; children: ReactNode }) { return <section className="mb-6"><p className="mb-2 text-xs text-zinc-500">{label}</p><div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">{children}</div></section>; }
function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-start justify-between gap-8 border-b border-white/[0.055] px-5 py-4 last:border-b-0"><span className="text-sm text-zinc-400">{label}</span><span className={`max-w-[65%] break-all text-right text-sm text-zinc-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</span></div>; }
function ActionRow({ title, detail, action }: { title: string; detail: string; action: ReactNode }) { return <div className="flex items-center gap-4 border-b border-white/[0.055] px-5 py-4 last:border-b-0"><div className="min-w-0 flex-1"><p className="text-sm text-zinc-200">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div>{action}</div>; }
function ToggleRow({ title, detail, enabled, disabled, onToggle, action }: { title: string; detail: string; enabled: boolean; disabled: boolean; onToggle: () => void; action?: ReactNode }) { return <ActionRow title={title} detail={detail} action={<div className="flex items-center gap-3">{action}<button type="button" role="switch" aria-checked={enabled} aria-label={title} disabled={disabled} onClick={onToggle} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-emerald-600" : "bg-zinc-700"} disabled:opacity-50`}><span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} /></button></div>} />; }
function SelectRow({ title, detail, value, disabled, options, onChange }: { title: string; detail: string; value: string; disabled: boolean; options: Option[]; onChange: (value: string) => void }) { return <ActionRow title={title} detail={detail} action={<select aria-label={title} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-[#17181a] px-3 py-2 text-xs text-zinc-200 outline-none disabled:opacity-50">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>} />; }
function TextRow({ title, detail, value, disabled, onCommit }: { title: string; detail: string; value: string; disabled: boolean; onCommit: (value: string) => void }) { return <ActionRow title={title} detail={detail} action={<input key={value} aria-label={title} defaultValue={value} disabled={disabled} onBlur={(event) => { const next = event.currentTarget.value.trim(); if (next !== value) onCommit(next); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-40 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25 disabled:opacity-50" />} />; }
function LockedRow({ title, detail }: { title: string; detail: string }) { return <ActionRow title={title} detail={detail} action={<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300"><LockKeyhole className="h-3 w-3" />Always on</span>} />; }
function PolicyRow({ title, detail }: { title: string; detail: string }) { return <div className="flex items-start gap-3 border-b border-white/[0.055] px-5 py-4 last:border-b-0"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" /><div><p className="text-sm text-zinc-200">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div></div>; }
function Notice({ title, detail }: { title: string; detail: string }) { return <div className="mb-6 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-5"><p className="text-sm font-medium text-amber-100">{title}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{detail}</p></div>; }
function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold capitalize">{value}</p><p className="mt-2 text-sm text-zinc-500">{detail}</p></div>; }
function IntegrationRow({ icon, name, detail }: { icon: ReactNode; name: string; detail: string }) { return <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-black/25 text-zinc-300">{icon}</span><div className="min-w-0 flex-1"><p className="text-sm text-zinc-200">{name}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div><span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">Admin setup</span></div>; }
function WebButton({ href, label, standalone = false }: { href: string; label: string; standalone?: boolean }) { return <button type="button" onClick={() => void open(`${WEB_BASE}${href}`)} className={`${standalone ? "mt-1" : ""} inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]`}>{label}<ChevronRight className="h-3.5 w-3.5" /></button>; }

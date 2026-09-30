import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import {
  Bell,
  Check,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  GitBranch,
  Link2,
  LockKeyhole,
  LogOut,
  MessageSquare,
  MonitorCheck,
  ShieldCheck,
} from "lucide-react";
import { ViewShell } from "../components/Primitives";
import { desktopClient, type VerifiedDesktopIdentity } from "../lib/desktopClient";
import { clearApiKey } from "../lib/apiKeyStore";
import { clearAuthSession } from "../lib/authSession";
import { markNotificationPrefDirty, notifyResult } from "../lib/notifications";

const WEB_BASE = "https://visionxixlabs.com";

interface Preferences {
  theme: string;
  notifications_enabled: boolean;
  auto_scan_interval_minutes: number;
  default_provider: string;
  scan_on_launch: boolean;
}

type Section = "account" | "billing" | "workflow" | "repositories" | "integrations";

const sections: Array<{ id: Section; label: string; icon: typeof CircleUserRound }> = [
  { id: "account", label: "Account & session", icon: CircleUserRound },
  { id: "billing", label: "Plan & billing", icon: CreditCard },
  { id: "workflow", label: "Workflow behavior", icon: ShieldCheck },
  { id: "repositories", label: "Repositories & triggers", icon: GitBranch },
  { id: "integrations", label: "Integrations", icon: Link2 },
];

export function SettingsView({ identity }: { identity: VerifiedDesktopIdentity }) {
  const [active, setActive] = useState<Section>("account");
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<Preferences>("get_preferences").then(setPrefs).catch((cause) => setError(String(cause)));
  }, []);

  async function savePreferences(next: Preferences) {
    setError(null);
    setPrefs(next);
    try {
      await invoke("set_preferences", { prefs: next });
      markNotificationPrefDirty();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (cause) {
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
        <p className="mt-1 text-sm text-zinc-500">Your account, commercial access, workstation behavior, and governed connections.</p>
      </div>

      <div className="grid min-h-[560px] grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0c10]">
        <nav aria-label="Settings sections" className="border-r border-white/[0.07] bg-black/20 p-3">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActive(id)} aria-current={active === id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${active === id ? "bg-white/[0.07] text-white" : "text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200"}`}>
              <Icon aria-hidden className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
          <div className="mt-5 border-t border-white/[0.06] px-3 pt-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-600">Signed in workspace</p>
            <p className="mt-2 truncate text-xs text-zinc-300" title={identity.organizationId}>{identity.organizationId}</p>
            <p className="mt-1 text-[11px] text-emerald-300">Production access active</p>
          </div>
        </nav>

        <div className="p-7">
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          {saved && <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"><Check className="h-4 w-4" />Preference saved on this computer.</div>}
          {active === "account" && <AccountSection identity={identity} onSignOut={signOut} />}
          {active === "billing" && <BillingSection identity={identity} />}
          {active === "workflow" && <WorkflowSection prefs={prefs} onSave={savePreferences} />}
          {active === "repositories" && <RepositorySection />}
          {active === "integrations" && <IntegrationsSection />}
        </div>
      </div>
    </ViewShell>
  );
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="mb-7"><p className="text-[11px] text-zinc-500">{eyebrow}</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{detail}</p></div>;
}

function AccountSection({ identity, onSignOut }: { identity: VerifiedDesktopIdentity; onSignOut: () => Promise<void> }) {
  return <div>
    <SectionHeading eyebrow="Identity" title="Account & desktop session" detail="The browser verified your identity and authorized this installed copy of Axiom Agent. Credentials remain in the operating-system credential vault." />
    <SettingsCard>
      <InfoRow label="Name" value={identity.displayName ?? "Not provided"} />
      <InfoRow label="Email" value={identity.email ?? (identity.kind === "api_key" ? "Administrator credential" : "Not available")} />
      <InfoRow label="Workspace" value={identity.organizationId} mono />
      <InfoRow label="Authentication" value={identity.kind === "desktop_session" ? "Browser-authorized desktop session" : "Enterprise recovery credential"} />
      <InfoRow label="Service" value="visionxixlabs.com · verified" />
    </SettingsCard>
    <div className="mt-5 flex items-center justify-between gap-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div><p className="text-sm font-medium text-zinc-200">Sign out on this computer</p><p className="mt-1 text-xs leading-5 text-zinc-500">Removes the local desktop credential. It does not cancel externally running workflows.</p></div>
      <button type="button" onClick={() => void onSignOut()} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-500/15"><LogOut className="h-3.5 w-3.5" />Sign out</button>
    </div>
  </div>;
}

function BillingSection({ identity }: { identity: VerifiedDesktopIdentity }) {
  const access = identity.access;
  const [opening, setOpening] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  async function openBillingPortal() {
    setOpening(true);
    setPortalError(null);
    try {
      const result = await desktopClient.desktopBillingPortal();
      if (!result.ok) throw new Error(result.error);
      const destination = new URL(result.data.url);
      if (destination.protocol !== "https:" || !(destination.hostname === "stripe.com" || destination.hostname.endsWith(".stripe.com"))) {
        throw new Error("The billing service returned an unexpected destination.");
      }
      await open(destination.toString());
    } catch (cause) {
      setPortalError(cause instanceof Error ? cause.message : "The billing portal could not be opened.");
    } finally {
      setOpening(false);
    }
  }

  return <div>
    <SectionHeading eyebrow="Commercial access" title="Plan & billing" detail="Axiom verifies entitlement with the service before loading deployment records. Payment redirects use hosted billing pages; card data is never collected by the desktop app." />
    <div className="grid gap-4 sm:grid-cols-2">
      <SettingsCard className="p-5">
        <p className="text-xs text-zinc-500">Current plan</p><p className="mt-2 text-2xl font-semibold capitalize">{access.planTier}</p>
        <p className="mt-2 text-sm text-emerald-300">{access.title}</p>
      </SettingsCard>
      <SettingsCard className="p-5">
        <p className="text-xs text-zinc-500">Billing state</p><p className="mt-2 text-2xl font-semibold capitalize">{access.billingStatus.replaceAll("_", " ")}</p>
        <p className="mt-2 text-sm text-zinc-500">{access.cancelAtPeriodEnd ? "Ends after the current period" : access.currentPeriodEndsAt ? `Current period ends ${new Date(access.currentPeriodEndsAt).toLocaleDateString()}` : "Managed under your workspace agreement"}</p>
      </SettingsCard>
    </div>
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-5"><div><p className="text-sm font-medium">Manage billing securely</p><p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">Request a short-lived portal session from the authenticated desktop service, then continue in Stripe’s hosted billing portal. Card data is never handled by Axiom Agent.</p></div><button type="button" disabled={opening} onClick={() => void openBillingPortal()} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-zinc-100 disabled:opacity-50">{opening ? "Opening…" : "Open billing"} <ChevronRight className="h-3.5 w-3.5" /></button></div>
      {portalError && <p role="alert" className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">{portalError}</p>}
      <p className="mt-4 border-t border-white/[0.06] pt-4 text-[11px] leading-5 text-zinc-600">A return from Checkout does not grant access by itself. Axiom waits for verified subscription state from the billing service before unlocking production controls.</p>
    </div>
  </div>;
}

function WorkflowSection({ prefs, onSave }: { prefs: Preferences | null; onSave: (prefs: Preferences) => Promise<void> }) {
  return <div>
    <SectionHeading eyebrow="Workstation" title="Workflow behavior" detail="Local preferences can make the app calmer without weakening deployment controls. Consequential actions always keep server-enforced authorization and confirmation." />
    <SettingsCard>
      <ToggleRow icon={<Bell className="h-4 w-4" />} title="Desktop notifications" detail="Notify when a deployment needs attention or an approval decision." enabled={prefs?.notifications_enabled ?? false} disabled={!prefs} onToggle={() => prefs && void onSave({ ...prefs, notifications_enabled: !prefs.notifications_enabled })} action={<button type="button" disabled={!prefs?.notifications_enabled} onClick={() => void notifyResult({ title: "Axiom Agent", body: "Desktop notifications are ready." })} className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white disabled:opacity-40">Test</button>} />
      <LockedRow icon={<ShieldCheck className="h-4 w-4" />} title="Confirm consequential actions" detail="Merge, release, workflow dispatch, environment approval, rollback, and change closure always require the applicable policy checks." />
      <LockedRow icon={<MonitorCheck className="h-4 w-4" />} title="Resume observation after restart" detail="Axiom reconciles durable operation IDs with external status; closing the window never reports externally running work as canceled." />
    </SettingsCard>
  </div>;
}

function RepositorySection() {
  return <div>
    <SectionHeading eyebrow="Source control" title="Repositories & deployment triggers" detail="Axiom keeps repository visibility, review, merge, release publication, workflow dispatch, tags, and environment approval as separate capabilities." />
    <SettingsCard>
      <PolicyRow title="Pull-request review" detail="Review permission does not grant merge permission." />
      <PolicyRow title="Merge & release" detail="Merge and release publication remain separately authorized production triggers." />
      <PolicyRow title="Workflow dispatch" detail="Repository visibility never implies permission to run a workflow." />
      <PolicyRow title="Environment approval" detail="Approval can release a gate without automatically starting deployment unless the playbook explicitly says so." />
    </SettingsCard>
    <ActionLink label="Review repository and trigger setup" href="/docs/releaseops/connectors" />
  </div>;
}

function IntegrationsSection() {
  return <div>
    <SectionHeading eyebrow="External systems" title="Integrations" detail="Connections are tenant-scoped and administrator configured. The app does not mark a provider connected until the service validates the required permissions." />
    <div className="space-y-3">
      <IntegrationRow icon={<GitBranch className="h-4 w-4" />} name="GitHub" capability="Repository discovery, reviews, merges, releases, and workflow dispatch remain separately permissioned." />
      <IntegrationRow icon={<MessageSquare className="h-4 w-4" />} name="Slack" capability="Outbound deployment notifications only when a tenant adapter is configured; this is not workflow synchronization." />
      <IntegrationRow icon={<Link2 className="h-4 w-4" />} name="Change systems" capability="Change creation and updates depend on the configured adapter and playbook policy; links alone are not synchronization." />
    </div>
    <ActionLink label="Open integration setup documentation" href="/docs/releaseops/connectors" />
  </div>;
}

function SettingsCard({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] ${className}`}>{children}</div>; }
function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-start justify-between gap-8 border-b border-white/[0.055] px-5 py-4 last:border-b-0"><span className="text-sm text-zinc-500">{label}</span><span className={`max-w-[65%] break-all text-right text-sm text-zinc-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</span></div>; }
function ToggleRow({ icon, title, detail, enabled, disabled, onToggle, action }: { icon: ReactNode; title: string; detail: string; enabled: boolean; disabled: boolean; onToggle: () => void; action?: ReactNode }) { return <div className="flex items-center gap-4 border-b border-white/[0.055] px-5 py-4"><span className="text-zinc-500">{icon}</span><div className="min-w-0 flex-1"><p className="text-sm text-zinc-200">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div>{action}<button type="button" role="switch" aria-checked={enabled} aria-label={title} disabled={disabled} onClick={onToggle} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-emerald-600" : "bg-zinc-700"}`}><span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} /></button></div>; }
function LockedRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <div className="flex items-center gap-4 border-b border-white/[0.055] px-5 py-4 last:border-b-0"><span className="text-zinc-500">{icon}</span><div className="min-w-0 flex-1"><p className="text-sm text-zinc-200">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div><span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300"><LockKeyhole className="h-3 w-3" />Always on</span></div>; }
function PolicyRow({ title, detail }: { title: string; detail: string }) { return <div className="flex items-start gap-3 border-b border-white/[0.055] px-5 py-4 last:border-b-0"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" /><div><p className="text-sm text-zinc-200">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div></div>; }
function IntegrationRow({ icon, name, capability }: { icon: ReactNode; name: string; capability: string }) { return <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-black/25 text-violet-300">{icon}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-200">{name}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{capability}</p></div><span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-200">Admin configured</span></div>; }
function ActionLink({ label, href }: { label: string; href: string }) { return <button type="button" onClick={() => void open(`${WEB_BASE}${href}`)} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200">{label}<ChevronRight className="h-4 w-4" /></button>; }

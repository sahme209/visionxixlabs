import Link from "next/link";
import { connectionReturnQuery, type ConnectionReturnParams } from "@/lib/integrations/connectionReturnParams";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";

export const dynamic = "force-dynamic";

const GITHUB_NOTICES: Record<string, { tone: "emerald" | "amber" | "rose"; title: string; detail: string }> = {
  installation_recorded: { tone: "emerald", title: "GitHub installation recorded", detail: "Axiom Agent will perform the first scoped, read-only validation before this installation contributes release evidence." },
  approval_requested: { tone: "amber", title: "GitHub approval requested", detail: "Your organization administrator must approve the requested installation before Axiom can record it." },
  missing_installation: { tone: "rose", title: "GitHub did not return an installation", detail: "No connection was recorded. You can restart the setup from Integrations when ready." },
  invalid_state: { tone: "rose", title: "GitHub setup link is no longer valid", detail: "No connection was recorded. Start a new setup from Integrations instead of reusing a previous link." },
  error: { tone: "rose", title: "GitHub setup could not be recorded", detail: "No connection was recorded. Try again from Integrations or contact the Axiom team." },
};

/** Fixed display-only outcomes; no callback URL/code or automatic recovery action. */
function callbackRecoveryNotices(name:string):Record<string,{tone:'amber';title:string;detail:string}>{return{
  authorization_required:{tone:'amber',title:`${name} setup needs workspace authorization`,detail:'Sign in to Axiom with the same account and workspace that started setup, then review connection status in the app. Do not reuse this callback link.'},
  exchange_outcome_unknown:{tone:'amber',title:`${name} provider exchange could not be confirmed`,detail:'The provider may have accepted the authorization code. Return to the app and reload connection status before starting another setup. Do not reload or reuse this callback link.'},
  record_outcome_unknown:{tone:'amber',title:`${name} connection save could not be confirmed`,detail:'Consent may already be saved. Return to the app and reload connection status before taking another action. Do not repeat this callback.'},
  connection_changed:{tone:'amber',title:`${name} connection changed during setup`,detail:'The saved connection no longer matches this setup. Return to the app and reload connection status. This result does not establish active provider access.'},
}}

const SLACK_NOTICES: Record<string, { tone: "emerald" | "amber" | "rose"; title: string; detail: string }> = {
  ...callbackRecoveryNotices("Slack"),
  consent_recorded: { tone: "emerald", title: "Slack consent recorded", detail: "Axiom will not show Slack as active until it completes a live server-side validation." },
  declined: { tone: "amber", title: "Slack setup was cancelled", detail: "No connection or provider access was recorded." },
  invalid_state: { tone: "rose", title: "Slack setup link is no longer valid", detail: "No connection was recorded. Start a new setup from Integrations instead of reusing a previous link." },
  unavailable: { tone: "rose", title: "Slack setup is unavailable", detail: "No connection was recorded because this workspace is not configured for Slack yet." },
  exchange_failed: { tone: "rose", title: "Slack setup could not be completed", detail: "No connection was recorded. You can try again from Integrations." },
  scope_insufficient: { tone: "rose", title: "Slack did not grant the requested access", detail: "No connection was recorded. Review the requested scopes and restart setup from Integrations." },
  record_failed: { tone: "rose", title: "Slack consent could not be recorded", detail: "The saved outcome could not be confirmed. Return to the app and reload connection status before starting another setup." },
};

const TEAMS_NOTICES: Record<string, { tone: "emerald" | "amber" | "rose"; title: string; detail: string }> = {
  ...callbackRecoveryNotices("Microsoft"),
  consent_recorded: { tone: "emerald", title: "Microsoft consent recorded", detail: "Axiom will not show Teams as active until it completes a live server-side validation." },
  declined: { tone: "amber", title: "Microsoft setup was cancelled", detail: "No connection or provider access was recorded." },
  invalid_state: { tone: "rose", title: "Microsoft setup link is no longer valid", detail: "No connection was recorded. Start a new setup from Integrations instead of reusing a previous link." },
  unavailable: { tone: "rose", title: "Teams setup is unavailable", detail: "No connection was recorded because this workspace is not configured for Teams yet." },
  exchange_failed: { tone: "rose", title: "Microsoft setup could not be completed", detail: "No connection was recorded. You can try again from Integrations." },
  scope_insufficient: { tone: "amber", title: "Microsoft access needs review", detail: "Axiom could not verify the required access from the provider response. No connection was recorded. Review the existing Microsoft permissions before starting a new setup from Integrations." },
  record_failed: { tone: "rose", title: "Teams consent could not be recorded", detail: "The saved outcome could not be confirmed. Return to the app and reload connection status before starting another setup." },
};

const LINEAR_NOTICES: Record<string, { tone: "emerald" | "amber" | "rose"; title: string; detail: string }> = {
  ...callbackRecoveryNotices("Linear"),
  consent_recorded: { tone: "emerald", title: "Linear consent recorded", detail: "Axiom will not show Linear as active until it completes a live server-side identity validation." },
  declined: { tone: "amber", title: "Linear setup was cancelled", detail: "No connection or provider access was recorded." },
  invalid_state: { tone: "rose", title: "Linear setup link is no longer valid", detail: "No connection was recorded. Start a new setup from Integrations." },
  unavailable: { tone: "rose", title: "Linear setup is unavailable", detail: "The approved Linear OAuth application is not configured for this workspace yet." },
  exchange_failed: { tone: "rose", title: "Linear setup could not be completed", detail: "No connection was recorded. Try again from Integrations." },
  scope_insufficient: { tone: "rose", title: "Linear did not grant the requested access", detail: "No connection was recorded because the required read and issue-creation scopes were not granted." },
  record_failed: { tone: "rose", title: "Linear consent could not be recorded", detail: "The saved outcome could not be confirmed. Return to the app and reload connection status before starting another setup." },
};

const JIRA_NOTICES: Record<string, { tone: "emerald" | "amber" | "rose"; title: string; detail: string }> = {
  consent_recorded: { tone: "emerald", title: "Jira consent recorded", detail: "Axiom will not show Jira as active until it completes a live server-side validation." },
  declined: { tone: "amber", title: "Jira setup was cancelled", detail: "No new connection was recorded." },
  exchange_failed: { tone: "rose", title: "Jira setup could not be completed", detail: "No new connection was recorded. Try again from Integrations." },
  record_failed: { tone: "rose", title: "Jira consent could not be recorded", detail: "Try again from Integrations or review your existing connection." },
  unavailable: { tone: "rose", title: "Jira setup is unavailable", detail: "Review your connection in Integrations or try again later." },
  invalid_state: { tone: "rose", title: "Jira setup link is no longer valid", detail: "Start a new setup from Integrations instead of reusing a previous link." },
  authorization_required: { tone: "amber", title: "Jira setup requires workspace authorization", detail: "Sign in with a workspace owner or administrator account, then restart setup from Integrations." },
  connection_exists: { tone: "amber", title: "A Jira connection already exists", detail: "Your existing connection was kept. Review it in Integrations." },
};

export default async function AuthSuccessPage({ searchParams }: { searchParams: Promise<ConnectionReturnParams> }) {
  const query = connectionReturnQuery(await searchParams);
  const params = { integration: query.get("integration"), status: query.get("status") };
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated) {
    const callback = query.size ? `/auth/success?${query}` : "/auth/success";
    redirect(`/auth/signin?${new URLSearchParams({ callbackUrl: callback })}`);
  }
  const integrationNotice = params.integration === "github"
    ? GITHUB_NOTICES[params.status ?? ""] ?? null
    : params.integration === "slack" ? SLACK_NOTICES[params.status ?? ""] ?? null
    : params.integration === "teams" ? TEAMS_NOTICES[params.status ?? ""] ?? null
    : params.integration === "linear" ? LINEAR_NOTICES[params.status ?? ""] ?? null
    : params.integration === "jira" ? JIRA_NOTICES[params.status ?? ""] ?? null : null;
  return (
    <div>
      <div className="mx-auto max-w-6xl">
        

        {integrationNotice && <div role="status" className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${integrationNotice.tone === "emerald" ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-100" : integrationNotice.tone === "amber" ? "border-zinc-300/20 bg-zinc-300/5 text-zinc-100" : "border-rose-300/20 bg-rose-300/5 text-rose-100"}`}><p className="font-medium">{integrationNotice.title}</p><p className="mt-1 text-zinc-400">{integrationNotice.detail}</p></div>}

        <section className="grid gap-5 py-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.72fr)] lg:py-14">
          <div className="rounded-3xl border border-white/9 bg-white/[0.035] p-6 shadow-[0_24px_100px_rgba(0,0,0,0.18)] sm:p-9">
            <p className="text-[10px] uppercase tracking-[0.22em] text-orange-300">Axiom Control</p>
            <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">A clear home for your release workspace.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400 sm:text-base">Review account context, connection posture, and guidance here. The installed Axiom Agent remains the focused environment for governed release records, approvals, and operations.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/control/desktop" className="inline-flex min-h-11 items-center rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white">Download Axiom Agent</Link>
              <Link href="/account/integrations" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/6">Review connections</Link>
            </div>
          </div>
          <aside className="rounded-3xl border border-emerald-400/15 bg-emerald-400/4.5 p-6 sm:p-7">
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200">Browser session</p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em] text-zinc-100">You’re signed in.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Your browser identity is authenticated. Workspace permissions and release approvals are checked separately for each protected action.</p>
            <dl className="mt-7 space-y-3 border-t border-emerald-200/10 pt-5 text-sm">
              <div><dt className="text-zinc-500">Plan and usage</dt><dd className="mt-2"><Link href="/control/usage-billing" className="inline-flex min-h-11 items-center text-orange-300 hover:text-orange-200">Review workspace billing →</Link></dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-zinc-500">Release actions</dt><dd className="text-zinc-200">Subject to workspace policy</dd></div>
            </dl>
          </aside>
        </section>

        <section className="grid gap-3 pb-10 md:grid-cols-3" aria-label="Workspace destinations">
          <Link href="/account/integrations" className="group rounded-2xl border border-white/8 bg-black/10 p-5 transition hover:border-orange-300/25 hover:bg-white/4.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">01 · Connections</p><h2 className="mt-3 text-lg font-medium text-zinc-100">Integration posture</h2><p className="mt-2 text-sm leading-6 text-zinc-500">See what is scoped, awaiting validation, or deliberately unavailable.</p><span className="mt-5 inline-block text-sm text-orange-300 transition group-hover:text-orange-200">Open integrations →</span>
          </Link>
          <Link href="/control/settings" className="group rounded-2xl border border-white/8 bg-black/10 p-5 transition hover:border-orange-300/25 hover:bg-white/4.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">02 · Account</p><h2 className="mt-3 text-lg font-medium text-zinc-100">Profile and access</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Keep your display name current and review protected account boundaries.</p><span className="mt-5 inline-block text-sm text-orange-300 transition group-hover:text-orange-200">Open settings →</span>
          </Link>
          <Link href="/account/help" className="group rounded-2xl border border-white/8 bg-black/10 p-5 transition hover:border-orange-300/25 hover:bg-white/4.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">03 · Guidance</p><h2 className="mt-3 text-lg font-medium text-zinc-100">Help and reference</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Find release, security, and desktop guidance without losing your session.</p><span className="mt-5 inline-block text-sm text-orange-300 transition group-hover:text-orange-200">Open help →</span>
          </Link>
        </section>
      </div>
    </div>
  );
}

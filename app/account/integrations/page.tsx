import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { AuthCompanionShell } from "@/components/auth/AuthCompanionShell";
import { IntegrationConnectionAction } from "@/components/auth/IntegrationConnectionAction";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { visibleTenantConnectionStatus } from "@/lib/integrations/tenantConnectionState";
import { trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";
import { getGithubConfig, isGithubAppInstallationReady } from "@/lib/connectors/github/githubConfig";
import { prisma } from "@/lib/db";

interface GitHubInstallationRow { id: string; status: string; lastSeenAt: Date | null }
interface CollaborationConnectionRow { provider: string; status: string; lastValidatedAt: Date | null }
interface IntegrationStatusRepo {
  gitHubInstallation: { findFirst(args: { where: { organizationId: string; status: { in: string[] } }; orderBy: { installedAt: "desc" }; select: { id: true; status: true; lastSeenAt: true } }): Promise<GitHubInstallationRow | null> };
  tenantIntegrationConnection: { findMany(args: { where: { organizationId: string; provider: { in: string[] } }; select: { provider: true; status: true; lastValidatedAt: true } }): Promise<CollaborationConnectionRow[]> };
}

const GITHUB_VALIDATION_FRESH_FOR_MS = 24 * 60 * 60 * 1000;

function readableState(state: string) {
  return state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function githubConnectionState(installation: GitHubInstallationRow): string {
  if (installation.status !== "active") return readableState(installation.status);
  if (!installation.lastSeenAt) return "Installation recorded";
  return Date.now() - installation.lastSeenAt.getTime() <= GITHUB_VALIDATION_FRESH_FOR_MS
    ? "Read-only validated"
    : "Validation overdue";
}

function validationNextStep(connection: { name: string; state: string; control?: string }) {
  if (connection.name === "GitHub" && (connection.state === "Installation recorded" || connection.state === "Validation overdue")) {
    return "Open Axiom Agent and run its read-only GitHub validation. A recorded installation cannot contribute release evidence until that harmless check succeeds.";
  }
  if ((connection.control === "slack" || connection.control === "teams" || connection.control === "linear") && (connection.state === "Awaiting validation" || connection.state === "Needs attention")) {
    return "Open Axiom Agent and run its server-side validation. Consent alone is not treated as an active connection.";
  }
  return null;
}

const PROVIDER_MARKS: Record<string, { text: string; tone: string }> = {
  GitHub: { text: "GH", tone: "bg-zinc-100 text-zinc-950" },
  Slack: { text: "SL", tone: "bg-fuchsia-400/15 text-fuchsia-200" },
  Microsoft: { text: "MS", tone: "bg-blue-400/15 text-blue-200" },
  Linear: { text: "LI", tone: "bg-indigo-400/15 text-indigo-200" },
  Jira: { text: "JI", tone: "bg-sky-400/15 text-sky-200" },
  Sentry: { text: "SE", tone: "bg-violet-400/15 text-violet-200" },
};

function IntegrationRow({ name, detail, state, action }: { name: string; detail: string; state?: string; action: ReactNode }) {
  const mark = PROVIDER_MARKS[name] ?? { text: name.slice(0, 2).toUpperCase(), tone: "bg-white/[0.08] text-zinc-300" };
  const healthy = state === "Active" || state === "Read-only validated";
  return (
    <div className="flex min-h-[74px] items-center gap-4 px-4 py-3 sm:px-5">
      <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[10px] font-bold tracking-[-0.02em] ${mark.tone}`}>{mark.text}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium text-zinc-100">{name}</h2>
          {state && state !== "Not connected" && (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] ${healthy ? "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200" : "border-amber-300/15 bg-amber-300/[0.05] text-amber-100"}`}>{state}</span>
          )}
        </div>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function PlannedAction() {
  return <span className="inline-flex min-h-9 items-center rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 text-[11px] font-medium text-zinc-600">Planned</span>;
}

export const dynamic = "force-dynamic";

export default async function AccountIntegrationsPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.email) redirect("/auth/signin?callbackUrl=/account/integrations");
  const canManageConnections = isAdminOrOwner({ email: context.email, roles: context.roles });
  const githubConfig = await getGithubConfig();
  const setupReady = {
    github: isGithubAppInstallationReady(githubConfig, githubConfig.appSlug) && Boolean(trustedIntegrationCallbackUrl("/api/integrations/github/install-callback")),
    slack: Boolean(process.env.SLACK_CLIENT_ID?.trim() && process.env.SLACK_CLIENT_SECRET?.trim() && trustedIntegrationCallbackUrl("/api/integrations/slack/callback")),
    teams: Boolean(process.env.MICROSOFT_CLIENT_ID?.trim() && process.env.MICROSOFT_CLIENT_SECRET?.trim() && process.env.MICROSOFT_TENANT_ID?.trim() && trustedIntegrationCallbackUrl("/api/integrations/teams/callback")),
    linear: Boolean(process.env.LINEAR_CLIENT_ID?.trim() && process.env.LINEAR_CLIENT_SECRET?.trim() && trustedIntegrationCallbackUrl("/api/integrations/linear/callback")),
  };
  let githubState = "Not connected";
  let githubInstallationRowId: string | null = null;
  let githubRawStatus: string | null = null;
  let slackState = "Not connected";
  let teamsState = "Not connected";
  let linearState = "Not connected";
  let slackRawStatus: string | null = null;
  let teamsRawStatus: string | null = null;
  let linearRawStatus: string | null = null;
  try {
    const repo = prisma as unknown as IntegrationStatusRepo;
    const [installation, collaboration] = await Promise.all([
      repo.gitHubInstallation.findFirst({ where: { organizationId: context.organizationId ?? "", status: { in: ["active", "suspended", "revoked"] } }, orderBy: { installedAt: "desc" }, select: { id: true, status: true, lastSeenAt: true } }),
      repo.tenantIntegrationConnection.findMany({ where: { organizationId: context.organizationId ?? "", provider: { in: ["slack", "teams", "linear"] } }, select: { provider: true, status: true, lastValidatedAt: true } }),
    ]);
    if (installation) {
      githubInstallationRowId = installation.id;
      githubRawStatus = installation.status;
      githubState = githubConnectionState(installation);
    }
    const stateFor = (provider: "slack" | "teams" | "linear") => {
      const connection = collaboration.find((item) => item.provider === provider);
      return connection ? readableState(visibleTenantConnectionStatus(connection)) : "Not connected";
    };
    slackState = stateFor("slack");
    teamsState = stateFor("teams");
    linearState = stateFor("linear");
    slackRawStatus = collaboration.find((item) => item.provider === "slack")?.status ?? null;
    teamsRawStatus = collaboration.find((item) => item.provider === "teams")?.status ?? null;
    linearRawStatus = collaboration.find((item) => item.provider === "linear")?.status ?? null;
  } catch {
    // An unavailable status store must never be interpreted as a live connection.
  }
  const githubConnected = githubRawStatus !== null && githubRawStatus !== "revoked";
  const slackConnected = slackRawStatus !== null && slackRawStatus !== "revoked";
  const teamsConnected = teamsRawStatus !== null && teamsRawStatus !== "revoked";
  const linearConnected = linearRawStatus !== null && linearRawStatus !== "revoked";
  return (
    <AuthCompanionShell>
      <div className="mx-auto max-w-[1280px]">
        <AuthCompanionHeader email={context.email ?? null} />
        <section className="mx-auto max-w-5xl pb-7 pt-12 sm:pt-16">
          <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300">Workspace connections</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Integrations</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Connect the systems Axiom may inspect or act through. Consent happens on the provider’s own secure page; credentials never enter the desktop app.</p>
        </section>
        <div className="mx-auto max-w-5xl space-y-8 pb-16">
          <section aria-labelledby="source-control-heading">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h2 id="source-control-heading" className="text-xs font-medium text-zinc-400">Source control</h2>
              <span className="text-[10px] text-zinc-600">Repository access stays scoped by the provider</span>
            </div>
            <div className="divide-y divide-white/[0.06] overflow-visible rounded-2xl border border-white/[0.07] bg-white/[0.022]">
              <IntegrationRow
                name="GitHub"
                state={githubState}
                detail="Repository-scoped context, pull requests, workflows, and governed file changes."
                action={canManageConnections ? <IntegrationConnectionAction provider="github" label="GitHub" connected={githubConnected} suspended={githubRawStatus === "suspended"} setupAvailable={setupReady.github} installationRowId={githubInstallationRowId} /> : <span className="text-[11px] text-zinc-600">Admin only</span>}
              />
            </div>
            {validationNextStep({ name: "GitHub", state: githubState }) && <p className="mt-2 px-2 text-[11px] leading-5 text-zinc-600">{validationNextStep({ name: "GitHub", state: githubState })}</p>}
          </section>

          <section aria-labelledby="integrations-heading">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h2 id="integrations-heading" className="text-xs font-medium text-zinc-400">Integrations</h2>
              <span className="text-[10px] text-zinc-600">Least privilege · explicit consent · auditable lifecycle</span>
            </div>
            <div className="divide-y divide-white/[0.06] overflow-visible rounded-2xl border border-white/[0.07] bg-white/[0.022]">
              <IntegrationRow name="Slack" state={slackState} detail="Authorize release notifications with channels:read and chat:write; live validation is required before activation." action={canManageConnections ? <IntegrationConnectionAction provider="slack" label="Slack" connected={slackConnected} suspended={slackRawStatus === "suspended"} setupAvailable={setupReady.slack} /> : <span className="text-[11px] text-zinc-600">Admin only</span>} />
              <IntegrationRow name="Microsoft" state={teamsState} detail="Verify a Microsoft tenant identity first. Teams message permissions remain separately gated." action={canManageConnections ? <IntegrationConnectionAction provider="teams" label="Microsoft" connected={teamsConnected} suspended={teamsRawStatus === "suspended"} setupAvailable={setupReady.teams} /> : <span className="text-[11px] text-zinc-600">Admin only</span>} />
              <IntegrationRow name="Linear" state={linearState} detail="Delegate governed issue creation and release follow-up with read + issues:create scope." action={canManageConnections ? <IntegrationConnectionAction provider="linear" label="Linear" connected={linearConnected} suspended={linearRawStatus === "suspended"} setupAvailable={setupReady.linear} /> : <span className="text-[11px] text-zinc-600">Admin only</span>} />
              <IntegrationRow name="Jira" detail="Link approved change tickets and deployment evidence." action={<PlannedAction />} />
              <IntegrationRow name="Sentry" detail="Use read-only release and issue signals for post-deploy validation." action={<PlannedAction />} />
            </div>
          </section>

          <div className="flex flex-col gap-3 rounded-2xl border border-violet-300/12 bg-violet-300/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-medium text-zinc-200">Validation finishes in Axiom Agent</p><p className="mt-1 text-xs leading-5 text-zinc-500">Browser consent records permission; the desktop performs a harmless server-side check before showing a connection as active.</p></div>
            <Link href="/download" className="inline-flex shrink-0 justify-center rounded-lg border border-white/[0.1] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.06]">Open Agent</Link>
          </div>
        </div>
      </div>
    </AuthCompanionShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { AuthCompanionShell } from "@/components/auth/AuthCompanionShell";
import { GitHubConsentButton } from "@/components/auth/GitHubConsentButton";
import { GitHubDisconnectButton } from "@/components/auth/GitHubDisconnectButton";
import { GitHubPauseButton } from "@/components/auth/GitHubPauseButton";
import { IntegrationDisconnectButton } from "@/components/auth/IntegrationDisconnectButton";
import { SlackConsentButton } from "@/components/auth/SlackConsentButton";
import { TeamsConsentButton } from "@/components/auth/TeamsConsentButton";
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
  if ((connection.control === "slack" || connection.control === "teams") && (connection.state === "Awaiting validation" || connection.state === "Needs attention")) {
    return "Open Axiom Agent and run its server-side validation. Consent alone is not treated as an active connection.";
  }
  return null;
}

export const dynamic = "force-dynamic";

export default async function AccountIntegrationsPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.email) redirect("/auth/signin?callbackUrl=/account/integrations");
  const canManageConnections = isAdminOrOwner({ email: context.email, roles: context.roles });
  const githubConfig = getGithubConfig();
  const setupReady = {
    github: isGithubAppInstallationReady(githubConfig, process.env.GITHUB_APP_SLUG) && Boolean(trustedIntegrationCallbackUrl("/api/integrations/github/install-callback")),
    slack: Boolean(process.env.SLACK_CLIENT_ID?.trim() && process.env.SLACK_CLIENT_SECRET?.trim() && trustedIntegrationCallbackUrl("/api/integrations/slack/callback")),
    teams: Boolean(process.env.MICROSOFT_CLIENT_ID?.trim() && process.env.MICROSOFT_CLIENT_SECRET?.trim() && process.env.MICROSOFT_TENANT_ID?.trim() && trustedIntegrationCallbackUrl("/api/integrations/teams/callback")),
  };
  let githubState = "Not connected";
  let githubInstallationRowId: string | null = null;
  let githubRawStatus: string | null = null;
  let slackState = "Not connected";
  let teamsState = "Not connected";
  try {
    const repo = prisma as unknown as IntegrationStatusRepo;
    const [installation, collaboration] = await Promise.all([
      repo.gitHubInstallation.findFirst({ where: { organizationId: context.organizationId ?? "", status: { in: ["active", "suspended", "revoked"] } }, orderBy: { installedAt: "desc" }, select: { id: true, status: true, lastSeenAt: true } }),
      repo.tenantIntegrationConnection.findMany({ where: { organizationId: context.organizationId ?? "", provider: { in: ["slack", "teams"] } }, select: { provider: true, status: true, lastValidatedAt: true } }),
    ]);
    if (installation) {
      githubInstallationRowId = installation.id;
      githubRawStatus = installation.status;
      githubState = githubConnectionState(installation);
    }
    const stateFor = (provider: "slack" | "teams") => {
      const connection = collaboration.find((item) => item.provider === provider);
      return connection ? readableState(visibleTenantConnectionStatus(connection)) : "Not connected";
    };
    slackState = stateFor("slack");
    teamsState = stateFor("teams");
  } catch {
    // An unavailable status store must never be interpreted as a live connection.
  }
  const connections = [
    { name: "GitHub", detail: "Release evidence uses repository-scoped, read-only access. A recorded install is not treated as live until Axiom Agent completes a harmless validation read.", state: githubState, setupAvailable: setupReady.github, setupHint: "GitHub App setup is not available yet. An Axiom administrator must configure the approved App before this workspace can start consent." },
    { name: "Cloud accounts", detail: "AWS, Azure, and Google Cloud stay tenant-scoped and are validated from the installed application.", state: "Managed in Agent", setupAvailable: undefined },
    { name: "Slack", detail: "Axiom requests only the collaboration scope required for release updates. Browser consent and live server-side validation are both required before it appears active.", state: slackState, control: "slack", setupAvailable: setupReady.slack, setupHint: "Slack consent is not available yet. An Axiom administrator must configure the approved Slack application before a workspace can connect." },
    { name: "Microsoft", detail: "Start with tenant identity validation. Teams messaging remains unavailable until a separate, explicitly approved permission is configured and validated.", state: teamsState, control: "teams", setupAvailable: setupReady.teams, setupHint: "Microsoft consent is not available yet. An Axiom administrator must configure the approved Microsoft application before a workspace can connect." },
    { name: "Observability", detail: "Production health is not shown as connected until a tenant-scoped observability connection is verified.", state: "Not connected", setupAvailable: undefined },
  ];
  return (
    <AuthCompanionShell>
      <div className="mx-auto max-w-[1400px]">
        <AuthCompanionHeader email={context.email ?? null} />
        <section className="py-14 sm:py-20">
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">Axiom web companion · integrations</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Your release stack, clearly scoped.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">This companion keeps your account context in place. Provider consent starts here when it is available; Axiom Agent performs the harmless validation and keeps consequential release operations, revocation, and audit evidence governed.</p>
        </section>
        <section className="grid gap-3 md:grid-cols-2" aria-label="Integration overview">
          {connections.map((connection) => (
            <article key={connection.name} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-medium text-zinc-100">{connection.name}</h2><span className="rounded-full border border-white/[0.1] bg-black/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">{connection.state}</span></div>
              <p className="mt-3 text-sm leading-6 text-zinc-500">{connection.detail}</p>
              {validationNextStep(connection) && <p className="mt-4 rounded-xl border border-violet-300/15 bg-violet-300/[0.04] px-3 py-2.5 text-xs leading-5 text-zinc-400">{validationNextStep(connection)}</p>}
              {canManageConnections && connection.name === "GitHub" && (githubState === "Not connected" || githubState === "Revoked") && connection.setupAvailable && <GitHubConsentButton />}
              {canManageConnections && connection.name === "GitHub" && githubInstallationRowId && githubRawStatus !== "revoked" && (
                <GitHubPauseButton installationRowId={githubInstallationRowId} suspended={githubRawStatus === "suspended"} />
              )}
              {canManageConnections && connection.name === "GitHub" && githubInstallationRowId && githubState !== "Revoked" && <GitHubDisconnectButton installationRowId={githubInstallationRowId} />}
              {canManageConnections && connection.control === "slack" && slackState !== "Active" && connection.setupAvailable && <SlackConsentButton />}
              {canManageConnections && connection.control === "teams" && teamsState !== "Active" && connection.setupAvailable && <TeamsConsentButton />}
              {canManageConnections && connection.control === "slack" && slackState !== "Not connected" && slackState !== "Revoked" && <IntegrationDisconnectButton provider="slack" label="Slack" />}
              {canManageConnections && connection.control === "teams" && teamsState !== "Not connected" && teamsState !== "Revoked" && <IntegrationDisconnectButton provider="teams" label="Microsoft" />}
              {canManageConnections && connection.setupAvailable === false && connection.state !== "Active" && <p className="mt-5 text-xs leading-5 text-zinc-500">{connection.setupHint ?? "Connection setup is not available for this pilot workspace yet. No provider consent link is shown."}</p>}
            </article>
          ))}
        </section>
        <div className="mt-8 rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-5 sm:p-6">
          <p className="text-sm font-medium text-zinc-100">Open Axiom Agent to configure a connection.</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">The browser companion does not collect provider credentials or claim a provider is connected before live validation.</p>
          <Link href="/download" className="mt-5 inline-flex rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white">Open or download Agent</Link>
        </div>
      </div>
    </AuthCompanionShell>
  );
}

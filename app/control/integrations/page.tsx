import {isCollaborationOAuthConfigured} from "@/lib/integrations/collaborationOAuthReadiness";
import Link from "next/link";
import { GitBranch, Mail, Ticket } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ProviderLogo } from "@/components/cockpit/ProviderLogo";
import { StatusDot } from "@/components/cockpit/StatusDot";
import { stateLabel, toneFor, TONE_DOT, type StatusTone } from "@/lib/cockpit/statusTone";

import { JiraSetupCard } from "@/components/auth/JiraSetupCard";
import { IntegrationConnectionAction } from "@/components/auth/IntegrationConnectionAction";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { visibleTenantConnectionStatus } from "@/lib/integrations/tenantConnectionState";

export const dynamic = "force-dynamic";

const GITHUB_VALIDATION_FRESH_FOR_MS = 24 * 60 * 60 * 1000;
const COLLABORATION_PROVIDERS = ["slack", "teams", "linear"] as const;
const CLOUD_PROVIDERS = ["aws", "azure", "gcp"] as const;

type CollaborationProvider = (typeof COLLABORATION_PROVIDERS)[number];

type ConnectionView = {
  provider: CollaborationProvider;
  storedStatus: string | null;
  visibleStatus: string;
  scopes: string[];
  lastValidatedAt: Date | null;
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scopesFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((scope): scope is string => typeof scope === "string") : [];
}

function formatTime(value: Date | null) {
  if (!value) return "Never validated";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

const ICONS: Record<string, ReactNode> = Object.fromEntries(
  (["github","slack","teams","linear","airflow","aws","azure","gcp"] as const).map(provider => [provider,<ProviderLogo key={provider} provider={provider} />])
);

/** Connection state in plain words, with the shared cockpit colour. */
function connectionState(value: string): { tone: StatusTone; label: string } {
  switch (value) {
    case "active": case "connected": case "validated_read_only": return { tone: "success", label: "Connected" };
    case "public_service": return { tone: "success", label: "Public service" };
    case "not_connected": return { tone: "idle", label: "Not connected" };
    case "validation_overdue": return { tone: "attention", label: "Check overdue" };
    case "installation_recorded": return { tone: "attention", label: "Installed, not yet checked" };
    default: { const tone = toneFor(value); return { tone, label: stateLabel(value) }; }
  }
}

function IntegrationRow({ icon, name, description, status, details, action }: {
  icon: ReactNode;
  name: string;
  description: string;
  status?: string;
  details?: string;
  action?: ReactNode;
}) {
  const state = status ? connectionState(status) : null;
  return (
    <article className="relative grid min-w-0 grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3 rounded-xl px-2 py-3 hover:bg-white/[0.025]">
      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-zinc-300">{icon}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><h2 className="text-[13px] font-medium text-zinc-100">{name}</h2>{state && <StatusDot tone={state.tone} label={state.label} />}</div>
        <p className="mt-1 text-xs leading-5 text-zinc-400">{description}</p>
        {action && <div className="mt-2.5 flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      <div className="flex items-center">
        {details && <details className="relative text-[11px] leading-5 text-zinc-400"><summary aria-label={`Details & scopes for ${name}`} className="grid h-8 w-7 cursor-pointer list-none place-items-center rounded-full text-base text-zinc-500 hover:bg-white/5 hover:text-white [&::-webkit-details-marker]:hidden">⋯</summary><p className="absolute right-0 top-9 z-20 w-64 max-w-[70vw] rounded-xl border border-white/10 bg-[#202020] p-3 shadow-xl">{details}</p></details>}
      </div>
    </article>
  );
}

export default async function ControlIntegrationsPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId || !context.email) redirect("/auth/signin?callbackUrl=/control/integrations");
  if (!context.roles.length) return <p role="alert" className="text-sm text-zinc-300">A current workspace membership is required. Refresh to verify access.</p>;
  const organizationId = String(context.organizationId);
  const canManage = isAdminOrOwner({ email: context.email, roles: context.roles });

  const jiraScopeKey = JSON.stringify([organizationId, context.userId ?? null]);

  let unavailable = false;
  let github: { id: string; status: string; repositorySelection: string; lastSeenAt: Date | null } | null = null;
  let connections: Array<{ provider: string; status: string; scopesJson: unknown; lastValidatedAt: Date | null }> = [];
  let cloud: Array<{ provider: string; status: string; lastTransitionAt: Date }> = [];
  try {
    [github, connections, cloud] = await Promise.all([
      prisma.gitHubInstallation.findFirst({ where: { organizationId, status: { in: ["active", "suspended", "revoked"] } }, orderBy: { installedAt: "desc" }, select: { id: true, status: true, repositorySelection: true, lastSeenAt: true } }),
      prisma.tenantIntegrationConnection.findMany({ where: { organizationId, provider: { in: [...COLLABORATION_PROVIDERS, "airflow"] } }, select: { provider: true, status: true, scopesJson: true, lastValidatedAt: true } }),
      prisma.connectorSetupSession.findMany({ where: { organizationId, provider: { in: [...CLOUD_PROVIDERS] } }, select: { provider: true, status: true, lastTransitionAt: true } }),
    ]);
  } catch {
    unavailable = true;
  }

  const collaboration: ConnectionView[] = COLLABORATION_PROVIDERS.map((provider) => {
    const row = connections.find((connection) => connection.provider === provider);
    return {
      provider,
      storedStatus: row?.status ?? null,
      visibleStatus: visibleTenantConnectionStatus({ status: row?.status, lastValidatedAt: row?.lastValidatedAt }),
      scopes: scopesFrom(row?.scopesJson),
      lastValidatedAt: row?.lastValidatedAt ?? null,
    };
  });
  const airflow = connections.find((connection) => connection.provider === "airflow");
  const airflowMetadata = airflow?.scopesJson && typeof airflow.scopesJson === "object" && !Array.isArray(airflow.scopesJson)
    ? airflow.scopesJson as Record<string, unknown>
    : {};
  const githubStatus = !github
    ? "not_connected"
    : github.status !== "active"
      ? github.status
      : !github.lastSeenAt
        ? "installation_recorded"
        : new Date().getTime() - github.lastSeenAt.getTime() <= GITHUB_VALIDATION_FRESH_FOR_MS ? "validated_read_only" : "validation_overdue";

  const tracked = [githubStatus, ...collaboration.map((c) => c.visibleStatus), airflow?.status ?? "not_connected", ...CLOUD_PROVIDERS.map((p) => cloud.find((c) => c.provider === p)?.status ?? "not_connected")].map((v) => connectionState(v).tone);
  const tally = { success: tracked.filter((t) => t === "success").length, attention: tracked.filter((t) => t === "attention" || t === "running").length, failed: tracked.filter((t) => t === "failed").length, idle: tracked.filter((t) => t === "idle").length };

  return (
    <div className="w-full min-w-0">

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-3xl font-semibold tracking-[-0.045em]">Integrations</h1><p className="mt-1 max-w-2xl text-[13px] leading-5 text-zinc-400">Connect source control, collaboration tools, and cloud services to your workspace.</p></div>
        <span className="text-xs text-zinc-600">{canManage ? "Administrator controls" : "Read-only access"}</span>
      </div>

      {!unavailable && (
        <dl aria-label="Connection summary" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-400">
          {([["success", "Connected", tally.success], ["attention", "Need attention", tally.attention], ["failed", "Revoked or failed", tally.failed], ["idle", "Not connected", tally.idle]] as const).map(([tone, label, count]) => (
            <div key={tone} className="flex items-center gap-2"><span aria-hidden className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} /><dt>{label}</dt><dd className="font-medium tabular-nums text-zinc-100">{count}</dd></div>
          ))}
        </dl>
      )}
      {unavailable && <div role="alert" className="mt-8 border-y border-white/8 py-5 text-sm text-zinc-400">Connection records are temporarily unavailable. No cached state is being shown.</div>}

      <section className="mt-7" aria-labelledby="source-control-heading">
        <h2 id="source-control-heading" className="mb-3 text-[13px] font-medium text-zinc-100">Source control</h2>
        <div className="grid gap-x-6 gap-y-1 md:grid-cols-2 2xl:grid-cols-3">
          <IntegrationRow icon={ICONS.github} name="GitHub" status={githubStatus} description="Repository context, reviewed code changes, and release workflows." details={github ? `${titleCase(github.repositorySelection)} repository access · Last read-only validation: ${formatTime(github.lastSeenAt)}` : "No GitHub App installation recorded."} action={canManage ? <IntegrationConnectionAction provider="github" label="GitHub" connected={Boolean(github && github.status !== "revoked")} suspended={github?.status === "suspended"} installationRowId={github?.id} /> : undefined} />
          {process.env.GITLAB_WORKSPACE_SETUP_ENABLED === "true" && context.sessionUserId &&
            context.roles.some(role => role === "owner" || role === "admin") && (
              <IntegrationRow icon={<GitBranch className="h-5 w-5" />} name="GitLab"
                description="Read-only merge request, release and pipeline evidence for a tracked project."
                action={<Link href="/control/integrations/gitlab" className="text-xs text-zinc-200 underline underline-offset-4">Manage GitLab</Link>} />
            )}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="collaboration-heading">
        <h2 id="collaboration-heading" className="mb-3 text-[13px] font-medium text-zinc-100">Collaboration and work management</h2>
        <div className="grid gap-x-6 gap-y-1 md:grid-cols-2 2xl:grid-cols-3">
          {collaboration.map((connection) => {
            const names = { slack: "Slack", teams: "Microsoft Teams", linear: "Linear" } as const;
            const descriptions = { slack: "Governed release notifications for your workspace.", teams: "Connect your Microsoft tenant for governed collaboration.", linear: "Issue context and approval-governed follow-up." } as const;
            return <IntegrationRow key={connection.provider} icon={ICONS[connection.provider]} name={names[connection.provider]} status={connection.visibleStatus} description={descriptions[connection.provider]} details={`${connection.scopes.length ? `Granted scopes: ${connection.scopes.join(", ")}` : "No granted scopes recorded"} · ${formatTime(connection.lastValidatedAt)}`} action={canManage ? <IntegrationConnectionAction provider={connection.provider} configured={isCollaborationOAuthConfigured(connection.provider)} label={names[connection.provider]} connected={Boolean(connection.storedStatus && connection.storedStatus !== "revoked")} suspended={connection.storedStatus === "suspended"} /> : undefined} />;
          })}
          <JiraSetupCard key={jiraScopeKey} scopeKey={jiraScopeKey} canManage={!unavailable && canManage && Boolean(context.userId)} />
          <IntegrationRow icon={<Mail className="h-5 w-5" />} name="Outlook" description="Mailbox and calendar context for the consenting user." details="Manage sign-in in settings; current connection status is not shown here. Email actions need their own exact review." action={canManage ? <Link prefetch={false} href="/account/integrations/outlook" className="inline-flex min-h-8 items-center rounded-full bg-white/5 px-3.5 text-xs text-zinc-200 hover:bg-white/10">Open Outlook settings</Link> : undefined} />
          <IntegrationRow icon={<Ticket className="h-5 w-5" />} name="ServiceNow" description="Change-ticket setup and read access." details="Connection status is checked in settings; ticket changes keep their own native lifecycle and independent approvals." action={canManage ? <Link prefetch={false} href="/account/integrations/servicenow" className="inline-flex min-h-8 items-center rounded-full bg-white/5 px-3.5 text-xs text-zinc-200 hover:bg-white/10">Open ServiceNow settings</Link> : undefined} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="documentation-heading">
        <h2 id="documentation-heading" className="mb-3 text-[13px] font-medium text-zinc-100">Documentation & developer tools</h2>
        <div className="grid gap-x-6 gap-y-1 md:grid-cols-2 2xl:grid-cols-3"><IntegrationRow icon={ICONS.azure} name="Microsoft Learn MCP" status="public_service" description="Search official Azure and Microsoft documentation. No cloud credentials or write access." details="Reviewed public endpoint: learn.microsoft.com/api/mcp. Enable in the workspace MCP catalog; Agent permissions remain separate." action={<Link href="/control/mcp" className="inline-flex min-h-8 items-center rounded-full bg-white/5 px-3.5 text-xs text-zinc-200 hover:bg-white/10">Open tools →</Link>}/></div>
      </section>

      <section className="mt-8" aria-labelledby="automation-heading">
        <h2 id="automation-heading" className="mb-3 text-[13px] font-medium text-zinc-100">Orchestration</h2>
        <div className="grid gap-x-6 gap-y-1 md:grid-cols-2 2xl:grid-cols-3">
          <IntegrationRow icon={ICONS.airflow} name="Apache Airflow" status={airflow?.status ?? "not_connected"} description="DAG monitoring, dependency checks, and approved automation." details={airflow ? `${typeof airflowMetadata.version === "string" ? `Version ${airflowMetadata.version}` : "Version unavailable"} · ${typeof airflowMetadata.dagCount === "number" ? `${airflowMetadata.dagCount} DAGs` : "DAG count unavailable"} · ${formatTime(airflow.lastValidatedAt)}` : "No validated Airflow connection recorded."} action={<Link href="/control/airflow" className="inline-flex min-h-8 items-center rounded-full bg-white/5 px-3.5 text-xs text-zinc-200 hover:bg-white/10">Open Airflow →</Link>} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="cloud-heading">
        <h2 id="cloud-heading" className="mb-3 text-[13px] font-medium text-zinc-100">Cloud authorization</h2>
        <div className="grid gap-x-6 gap-y-1 md:grid-cols-2 2xl:grid-cols-3">
          {CLOUD_PROVIDERS.map((provider) => {
            const row = cloud.find((item) => item.provider === provider);
            return <IntegrationRow key={provider} icon={ICONS[provider]} name={provider === "gcp" ? "Google Cloud" : provider === "azure" ? "Azure" : "AWS"} status={row?.status ?? "not_connected"} description={provider === "aws" ? "OIDC-backed deployment authorization; no long-lived AWS access key is stored." : "Provider authorization is shown only after backend validation."} details={row ? `Last lifecycle transition: ${formatTime(row.lastTransitionAt)}` : "Setup required. Configure and validate a scoped cloud connection in V19 Agent."} action={canManage ? <Link href="/control/desktop" className="inline-flex min-h-8 items-center rounded-full bg-white/5 px-3.5 text-xs text-zinc-200 hover:bg-white/10">Connect in Agent →</Link> : undefined} />;
          })}
        </div>
      </section>

      <div className="mt-8 border-y border-white/8 py-5 text-xs leading-5 text-zinc-500">Consent is not health. A connection becomes active only after server-side validation. Airflow configuration remains in the desktop until its credential-entry migration passes parity and revocation tests.</div>
    </div>
  );
}

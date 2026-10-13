import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ChatBubbleLeftRightIcon,
  CloudIcon,
  CodeBracketSquareIcon,
  CubeIcon,
  RectangleGroupIcon,
} from "@heroicons/react/24/outline";

import { IntegrationConnectionAction } from "@/components/auth/IntegrationConnectionAction";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { getGithubConfig, isGithubAppInstallationReady } from "@/lib/connectors/github/githubConfig";
import { prisma } from "@/lib/db";
import { visibleTenantConnectionStatus } from "@/lib/integrations/tenantConnectionState";
import { trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";

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

const ICONS: Record<string, ReactNode> = {
  github: <CodeBracketSquareIcon className="h-4 w-4" />,
  slack: <ChatBubbleLeftRightIcon className="h-4 w-4" />,
  teams: <RectangleGroupIcon className="h-4 w-4" />,
  linear: <CubeIcon className="h-4 w-4" />,
  airflow: <CubeIcon className="h-4 w-4" />,
  cloud: <CloudIcon className="h-4 w-4" />,
};

function StatusBadge({ value }: { value: string }) {
  const healthy = value === "active" || value === "validated_read_only" || value === "connected";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${healthy ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200" : "border-white/[0.1] bg-white/[0.035] text-zinc-400"}`}>
      {titleCase(value)}
    </span>
  );
}

function IntegrationRow({ icon, name, description, status, details, action }: {
  icon: ReactNode;
  name: string;
  description: string;
  status: string;
  details?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-zinc-300">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium text-zinc-100">{name}</h2><StatusBadge value={status} /></div>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
        {details && <p className="mt-1 text-[11px] leading-5 text-zinc-600">{details}</p>}
      </div>
      {action && <div className="shrink-0 self-start sm:self-center">{action}</div>}
    </div>
  );
}

export default async function ControlIntegrationsPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.email) redirect("/auth/signin?callbackUrl=/control/integrations");
  const organizationId = String(context.organizationId);
  const canManage = isAdminOrOwner({ email: context.email, roles: context.roles });
  const githubConfig = await getGithubConfig();
  const setup = {
    github: isGithubAppInstallationReady(githubConfig, githubConfig.appSlug) && Boolean(trustedIntegrationCallbackUrl("/api/integrations/github/install-callback")),
    slack: Boolean(process.env.SLACK_CLIENT_ID?.trim() && process.env.SLACK_CLIENT_SECRET?.trim() && trustedIntegrationCallbackUrl("/api/integrations/slack/callback")),
    teams: Boolean(process.env.MICROSOFT_CLIENT_ID?.trim() && process.env.MICROSOFT_CLIENT_SECRET?.trim() && process.env.MICROSOFT_TENANT_ID?.trim() && trustedIntegrationCallbackUrl("/api/integrations/teams/callback")),
    linear: Boolean(process.env.LINEAR_CLIENT_ID?.trim() && process.env.LINEAR_CLIENT_SECRET?.trim() && trustedIntegrationCallbackUrl("/api/integrations/linear/callback")),
  };

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
        : Date.now() - github.lastSeenAt.getTime() <= GITHUB_VALIDATION_FRESH_FOR_MS ? "validated_read_only" : "validation_overdue";

  return (
    <div className="max-w-5xl">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff783d]">Organization authority</p>
      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Integrations</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Grant and revoke organization access here. Provider credentials stay encrypted on the backend; desktop users only receive verified status and permitted operations.</p></div>
        <span className="text-xs text-zinc-600">{canManage ? "Administrator controls" : "Read-only access"}</span>
      </div>

      {unavailable && <div role="alert" className="mt-8 border-y border-white/[0.08] py-5 text-sm text-zinc-400">Connection records are temporarily unavailable. No cached state is being shown.</div>}

      <section className="mt-10" aria-labelledby="source-control-heading">
        <h2 id="source-control-heading" className="mb-3 text-xs font-medium text-zinc-400">Source control</h2>
        <div className="divide-y divide-white/[0.06] overflow-visible rounded-xl border border-white/[0.08] bg-[#171717]">
          <IntegrationRow icon={ICONS.github} name="GitHub" status={githubStatus} description="Repository-scoped reading, branches, commits, pull requests, and workflow dispatch." details={github ? `${titleCase(github.repositorySelection)} repository access · Last read-only validation: ${formatTime(github.lastSeenAt)}` : "No GitHub App installation recorded."} action={canManage ? <IntegrationConnectionAction provider="github" label="GitHub" connected={Boolean(github && github.status !== "revoked")} suspended={github?.status === "suspended"} setupAvailable={setup.github} installationRowId={github?.id} /> : undefined} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="collaboration-heading">
        <h2 id="collaboration-heading" className="mb-3 text-xs font-medium text-zinc-400">Collaboration and work management</h2>
        <div className="divide-y divide-white/[0.06] overflow-visible rounded-xl border border-white/[0.08] bg-[#171717]">
          {collaboration.map((connection) => {
            const names = { slack: "Slack", teams: "Microsoft Teams", linear: "Linear" } as const;
            const descriptions = { slack: "Governed release notifications with channels:read and chat:write.", teams: "Verified Microsoft tenant identity; message authority remains separately gated.", linear: "Issue context and governed follow-up with read and issues:create scopes." } as const;
            return <IntegrationRow key={connection.provider} icon={ICONS[connection.provider]} name={names[connection.provider]} status={connection.visibleStatus} description={descriptions[connection.provider]} details={`${connection.scopes.length ? `Granted scopes: ${connection.scopes.join(", ")}` : "No granted scopes recorded"} · ${formatTime(connection.lastValidatedAt)}`} action={canManage ? <IntegrationConnectionAction provider={connection.provider} label={names[connection.provider]} connected={Boolean(connection.storedStatus && connection.storedStatus !== "revoked")} suspended={connection.storedStatus === "suspended"} setupAvailable={setup[connection.provider]} /> : undefined} />;
          })}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="automation-heading">
        <h2 id="automation-heading" className="mb-3 text-xs font-medium text-zinc-400">Orchestration</h2>
        <div className="rounded-xl border border-white/[0.08] bg-[#171717]">
          <IntegrationRow icon={ICONS.airflow} name="Apache Airflow" status={airflow?.status ?? "not_connected"} description="DAG discovery, dependency monitoring, governed automation, retries, and approval-gated actions." details={airflow ? `${typeof airflowMetadata.version === "string" ? `Version ${airflowMetadata.version}` : "Version unavailable"} · ${typeof airflowMetadata.dagCount === "number" ? `${airflowMetadata.dagCount} DAGs` : "DAG count unavailable"} · ${formatTime(airflow.lastValidatedAt)}` : "No validated Airflow connection recorded."} action={<Link href="/download" className="inline-flex min-h-9 items-center rounded-lg border border-white/[0.1] px-3 text-xs font-medium text-zinc-300 hover:bg-white/[0.05]">Open operational setup →</Link>} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="cloud-heading">
        <h2 id="cloud-heading" className="mb-3 text-xs font-medium text-zinc-400">Cloud authorization</h2>
        <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#171717]">
          {CLOUD_PROVIDERS.map((provider) => {
            const row = cloud.find((item) => item.provider === provider);
            return <IntegrationRow key={provider} icon={ICONS.cloud} name={provider === "gcp" ? "Google Cloud" : provider.toUpperCase()} status={row?.status ?? "not_connected"} description={provider === "aws" ? "OIDC-backed deployment authorization; no long-lived AWS access key is stored." : "Provider authorization is shown only after backend validation."} details={row ? `Last lifecycle transition: ${formatTime(row.lastTransitionAt)}` : "No connector lifecycle recorded."} />;
          })}
        </div>
      </section>

      <div className="mt-8 border-y border-white/[0.08] py-5 text-xs leading-5 text-zinc-500">Consent is not health. A connection becomes active only after server-side validation. Airflow configuration remains in the desktop until its credential-entry migration passes parity and revocation tests.</div>
    </div>
  );
}

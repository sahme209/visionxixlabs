import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { visibleTenantConnectionStatus } from "@/lib/integrations/tenantConnectionState";
import { getGithubConfig, isGithubAppInstallationReady } from "@/lib/connectors/github/githubConfig";
import { trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";

export const dynamic = "force-dynamic";

const CLOUD_PROVIDERS = ["aws", "azure", "gcp"] as const;
const COLLABORATION_PROVIDERS = ["slack", "teams", "linear"] as const;
const GITHUB_VALIDATION_FRESH_FOR_MS = 24 * 60 * 60 * 1000;

interface ConnectorSessionRow {
    provider: string;
    status: string;
    lastTransitionAt: Date;
}

interface ConnectorSessionRepo {
    connectorSetupSession: {
        findMany(args: {
            where: { organizationId: string; provider: { in: string[] } };
            select: { provider: true; status: true; lastTransitionAt: true };
        }): Promise<ConnectorSessionRow[]>;
    };
}

interface GitHubInstallationRow {
    status: string;
    repositorySelection: string;
    lastSeenAt: Date | null;
}

interface GitHubInstallationRepo {
    gitHubInstallation: {
        findFirst(args: {
            where: { organizationId: string; status: { in: string[] } };
            orderBy: { installedAt: "desc" };
            select: { status: true; repositorySelection: true; lastSeenAt: true };
        }): Promise<GitHubInstallationRow | null>;
    };
}

interface TenantIntegrationConnectionRow {
    provider: string;
    status: string;
    lastValidatedAt: Date | null;
}

interface TenantIntegrationConnectionRepo {
    tenantIntegrationConnection: {
        findMany(args: {
            where: { organizationId: string; provider: { in: string[] } };
            select: { provider: true; status: true; lastValidatedAt: true };
        }): Promise<TenantIntegrationConnectionRow[]>;
    };
}

/**
 * Tenant-scoped, read-only connection state for the native application.
 * This intentionally returns no credentials, provider account identifiers,
 * permissions, error details, or setup URLs. The browser remains the sole
 * place to consent to and manage a connection.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:read",
            route: "GET /api/desktop/integrations",
        });
        if (!session) {
            return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
        }

        const rows = await (prisma as unknown as ConnectorSessionRepo).connectorSetupSession.findMany({
            where: {
                organizationId: String(session.organizationId),
                provider: { in: [...CLOUD_PROVIDERS] },
            },
            select: { provider: true, status: true, lastTransitionAt: true },
        });
        const byProvider = new Map(rows.map((row) => [row.provider, row]));
        let collaboration: Array<{ provider: "slack" | "teams" | "linear"; status: string; lastValidatedAt: string | null }> =
            COLLABORATION_PROVIDERS.map((provider) => ({ provider, status: "not_connected", lastValidatedAt: null }));
        try {
            const connections = await (prisma as unknown as TenantIntegrationConnectionRepo).tenantIntegrationConnection.findMany({
                where: {
                    organizationId: String(session.organizationId),
                    provider: { in: [...COLLABORATION_PROVIDERS] },
                },
                select: { provider: true, status: true, lastValidatedAt: true },
            });
            const byCollaborationProvider = new Map(connections.map((connection) => [connection.provider, connection]));
            collaboration = COLLABORATION_PROVIDERS.map((provider) => {
                const connection = byCollaborationProvider.get(provider);
                return {
                    provider,
                    // A credential or callback is not enough: only a live
                    // server-side validation may appear as an active connection.
                    status: visibleTenantConnectionStatus({
                        status: connection?.status,
                        lastValidatedAt: connection?.lastValidatedAt,
                    }),
                    lastValidatedAt: connection?.lastValidatedAt?.toISOString() ?? null,
                };
            });
        } catch {
            // The migration may not yet be deployed. Do not infer a connection
            // from webhook configuration or browser UI presence.
        }
        let github: { status: string; repositorySelection: string } = {
            status: "not_connected",
            repositorySelection: "unknown",
        };
        try {
            const installation = await (prisma as unknown as GitHubInstallationRepo).gitHubInstallation.findFirst({
                where: {
                    organizationId: String(session.organizationId),
                    status: { in: ["active", "suspended", "revoked"] },
                },
                orderBy: { installedAt: "desc" },
                select: { status: true, repositorySelection: true, lastSeenAt: true },
            });
            if (installation) {
                // A callback proves that GitHub accepted the installation, but
                // not yet that Axiom can mint an installation token and perform
                // a scoped read. Keep that distinction explicit until the live
                // read-only validation lifecycle exists.
                github = {
                    status: installation.status === "active"
                        ? (!installation.lastSeenAt
                            ? "installation_recorded"
                            : Date.now() - installation.lastSeenAt.getTime() <= GITHUB_VALIDATION_FRESH_FOR_MS
                                ? "validated_read_only"
                                : "validation_overdue")
                        : installation.status,
                    repositorySelection: installation.repositorySelection,
                };
            }
        } catch {
            // GitHub App installation is optional and may not be migrated yet.
            // Cloud connection state remains available when it is absent.
        }

        const githubConfig = await getGithubConfig();
        const githubSlug = githubConfig.appSlug ?? "";
        const callbackConfigured = {
            github: Boolean(trustedIntegrationCallbackUrl("/api/integrations/github/install-callback")),
            slack: Boolean(trustedIntegrationCallbackUrl("/api/integrations/slack/callback")),
            teams: Boolean(trustedIntegrationCallbackUrl("/api/integrations/teams/callback")),
            linear: Boolean(trustedIntegrationCallbackUrl("/api/integrations/linear/callback")),
        };
        return NextResponse.json({
            ok: true,
            data: {
                configuration: {
                    github: callbackConfigured.github && isGithubAppInstallationReady(githubConfig, githubSlug),
                    slack: callbackConfigured.slack && Boolean(process.env.SLACK_CLIENT_ID?.trim() && process.env.SLACK_CLIENT_SECRET?.trim()),
                    teams: callbackConfigured.teams && Boolean(process.env.MICROSOFT_CLIENT_ID?.trim() && process.env.MICROSOFT_TENANT_ID?.trim() && process.env.MICROSOFT_CLIENT_SECRET?.trim()),
                    linear: callbackConfigured.linear && Boolean(process.env.LINEAR_CLIENT_ID?.trim() && process.env.LINEAR_CLIENT_SECRET?.trim()),
                },
                cloud: CLOUD_PROVIDERS.map((provider) => {
                    const row = byProvider.get(provider);
                    return {
                        provider,
                        status: row?.status ?? "not_connected",
                        lastTransitionAt: row?.lastTransitionAt.toISOString() ?? null,
                    };
                }),
                github,
                collaboration,
            },
        });
    } catch {
        return NextResponse.json({ ok: false, error: "integration_status_list_failed" }, { status: 500 });
    }
}

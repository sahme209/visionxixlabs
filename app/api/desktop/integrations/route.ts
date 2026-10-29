import { createHash } from "node:crypto";
import {isCollaborationOAuthConfigured} from "@/lib/integrations/collaborationOAuthReadiness";
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
    id?: string; consentedAt?: Date; consentedByUserId?: string | null; revokedAt?: Date | null;
}

interface TenantIntegrationConnectionRepo {
    tenantIntegrationConnection: {
        findMany(args: {
            where: { organizationId: string; provider: { in: string[] } };
            select: { provider: true; status: true; lastValidatedAt: true; id: true; consentedAt: true; consentedByUserId: true; revokedAt: true };
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
        // Enrollment is the Azure source of truth. A legacy setup session
        // neither proves a scoped credential nor enables scans or deployment.
        let awsSummary = {provider: "aws", status: "unavailable", lastTransitionAt: null as string | null};
        if (session.credentialKind === "desktop_session" && session.id) {
            try {
                const {awsEnrollment} = await import("@/lib/cloud/aws/enrollment/runtime");
                const {accounts} = await awsEnrollment.list(String(session.organizationId));
                const connected = accounts.filter(account => account.connected);
                awsSummary = {provider: "aws", status: connected.length ? "read_only_connected" : "not_connected", lastTransitionAt: connected.map(account => account.lastValidatedAt).sort().at(-1) ?? null};
            } catch { /* Canonical storage failure never falls back to a legacy connected claim. */ }
        }
        let azureSummary = {provider: "azure", status: "unavailable", lastTransitionAt: null as string | null};
        if (session.credentialKind === "desktop_session" && session.id) {
            try {
                const {azureEnrollment} = await import("@/lib/cloud/azure/enrollment/runtime");
                const {accounts} = await azureEnrollment.list({organizationId: String(session.organizationId), userId: String(session.userId), sessionId: session.id});
                const {readAzureGuidedCanonical} = await import('@/lib/cloud/azure/guided/runtime');
                const checked = await Promise.all(accounts.map(async account => ({account,current:account.connected ? await readAzureGuidedCanonical(prisma as never,{organizationId:String(session.organizationId),userId:String(session.userId),sessionId:session.id!},account.id,undefined,'read') : null})));
                const connected = checked.filter(x=>x.current).map(x=>x.account);
                const latest = connected.map(account => account.lastValidatedAt).sort().at(-1) ?? null;
                azureSummary = {provider: "azure", status: connected.length ? "read_only_connected" : "not_connected", lastTransitionAt: latest};
            } catch {
                // No legacy fallback: unavailable canonical storage/authority
                // cannot truthfully report an enrolled Azure connection.
            }
        }
        let gcpSummary: {provider: "gcp"; status: string; lastTransitionAt: string | null} = {provider: "gcp", status: "unavailable", lastTransitionAt: null};
        if (session.credentialKind === "desktop_session" && session.id) {
            try {
                const {readGcpGuidedSummary} = await import("@/lib/cloud/gcp/guided/summary");
                gcpSummary = await readGcpGuidedSummary(prisma, String(session.organizationId));
            } catch { /* No legacy success fallback. */ }
        }
        let collaboration: Array<{ provider: "slack" | "teams" | "linear"; status: string; lastValidatedAt: string | null; recoveryReceipt?: string }> =
            COLLABORATION_PROVIDERS.map((provider) => ({ provider, status: "not_connected", lastValidatedAt: null }));
        try {
            const connections = await (prisma as unknown as TenantIntegrationConnectionRepo).tenantIntegrationConnection.findMany({
                where: {
                    organizationId: String(session.organizationId),
                    provider: { in: [...COLLABORATION_PROVIDERS] },
                },
                select: { provider: true, status: true, lastValidatedAt: true, id: true, consentedAt: true, consentedByUserId: true, revokedAt: true },
            });
            const byCollaborationProvider = new Map(connections.map((connection) => [connection.provider, connection]));
            collaboration = COLLABORATION_PROVIDERS.map((provider) => {
                const connection = byCollaborationProvider.get(provider);
                return {
                    provider,
                    // A credential or callback is not enough: only a live
                    // server-side validation may appear as an active connection.
                    status: visibleTenantConnectionStatus({
                        status: connection?.revokedAt ? "revoked" : connection?.status,
                        lastValidatedAt: connection?.lastValidatedAt,
                    }),
                    lastValidatedAt: connection?.lastValidatedAt?.toISOString() ?? null,
                    // An authenticated comparison receipt, never an authorization token.
                    // Only consent replacement changes it; validation/status changes do not.
                    ...((provider === "slack" || provider === "teams") && session.credentialKind === "desktop_session" && session.id && connection?.id && connection.consentedByUserId === session.userId && connection.consentedAt instanceof Date && Number.isFinite(connection.consentedAt.getTime()) && !connection.revokedAt ? {recoveryReceipt:createHash("sha256").update(JSON.stringify(["consent-recovery-v1",session.id,session.organizationId,session.userId,provider,connection.id,connection.consentedAt.toISOString()])).digest("hex")} : {}),
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
        };
        const current = await resolveRequestDesktopSession(request, {requiredScope:"pipeline:read",route:"GET /api/desktop/integrations"});
        if (!current || current.id !== session.id || current.organizationId !== session.organizationId || current.userId !== session.userId || current.credentialKind !== session.credentialKind) return NextResponse.json({ok:false,error:"desktop_session_required"},{status:401,headers:{"Cache-Control":"private, no-store"}});
        return NextResponse.json({
            ok: true,
            data: {
                configuration: {
                    github: callbackConfigured.github && isGithubAppInstallationReady(githubConfig, githubSlug),
                    slack: isCollaborationOAuthConfigured("slack"),
                    teams: isCollaborationOAuthConfigured("teams"),
                    linear: isCollaborationOAuthConfigured("linear"),
                },
                cloud: CLOUD_PROVIDERS.map((provider) => {
                    if (provider === "aws") return awsSummary;
                    if (provider === "azure") return azureSummary;
                    if (provider === "gcp") return gcpSummary;
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
        }, {headers:{"Cache-Control":"private, no-store"}});
    } catch {
        return NextResponse.json({ ok: false, error: "integration_status_list_failed" }, { status: 500 });
    }
}

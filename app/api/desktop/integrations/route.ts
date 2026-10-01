import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";

export const dynamic = "force-dynamic";

const CLOUD_PROVIDERS = ["aws", "azure", "gcp"] as const;

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
                        ? (installation.lastSeenAt ? "validated_read_only" : "installation_recorded")
                        : installation.status,
                    repositorySelection: installation.repositorySelection,
                };
            }
        } catch {
            // GitHub App installation is optional and may not be migrated yet.
            // Cloud connection state remains available when it is absent.
        }

        return NextResponse.json({
            ok: true,
            data: {
                cloud: CLOUD_PROVIDERS.map((provider) => {
                    const row = byProvider.get(provider);
                    return {
                        provider,
                        status: row?.status ?? "not_connected",
                        lastTransitionAt: row?.lastTransitionAt.toISOString() ?? null,
                    };
                }),
                github,
            },
        });
    } catch {
        return NextResponse.json({ ok: false, error: "integration_status_list_failed" }, { status: 500 });
    }
}

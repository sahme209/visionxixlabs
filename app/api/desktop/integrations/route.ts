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

        return NextResponse.json({
            ok: true,
            data: CLOUD_PROVIDERS.map((provider) => {
                const row = byProvider.get(provider);
                return {
                    provider,
                    status: row?.status ?? "not_connected",
                    lastTransitionAt: row?.lastTransitionAt.toISOString() ?? null,
                };
            }),
        });
    } catch {
        return NextResponse.json({ ok: false, error: "integration_status_list_failed" }, { status: 500 });
    }
}

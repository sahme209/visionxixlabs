import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";

export const dynamic = "force-dynamic";

interface OperationRow {
    kind: string;
    status: string;
    attemptCount: number;
    createdAt: Date;
    lastAttemptAt: Date | null;
    lastReconciledAt: Date | null;
    externalReference: string | null;
}

interface OperationRepo {
    tauriDeploymentOperation: {
        findMany(args: {
            where: { organizationId: string; deploymentRequestId: string };
            orderBy: { createdAt: "desc" };
            select: {
                kind: true;
                status: true;
                attemptCount: true;
                createdAt: true;
                lastAttemptAt: true;
                lastReconciledAt: true;
                externalReference: true;
            };
        }): Promise<OperationRow[]>;
    };
}

/**
 * Read-only operation ledger visibility. Provider URLs, error payloads,
 * idempotency keys, and internal identifiers never leave the service.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:read",
            route: "GET /api/desktop/deployments/:id/operations",
        });
        if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
        const { id } = await params;
        const rows = await (prisma as unknown as OperationRepo).tauriDeploymentOperation.findMany({
            where: { organizationId: String(session.organizationId), deploymentRequestId: id },
            orderBy: { createdAt: "desc" },
            select: {
                kind: true,
                status: true,
                attemptCount: true,
                createdAt: true,
                lastAttemptAt: true,
                lastReconciledAt: true,
                externalReference: true,
            },
        });
        return NextResponse.json({
            ok: true,
            data: rows.map((row) => ({
                kind: row.kind,
                status: row.status,
                attemptCount: row.attemptCount,
                createdAt: row.createdAt.toISOString(),
                lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
                lastReconciledAt: row.lastReconciledAt?.toISOString() ?? null,
                externallyReferenced: Boolean(row.externalReference),
            })),
        });
    } catch {
        return NextResponse.json({ ok: false, error: "operation_ledger_load_failed" }, { status: 500 });
    }
}

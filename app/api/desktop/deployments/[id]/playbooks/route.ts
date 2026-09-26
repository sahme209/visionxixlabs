import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/api/correlation";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import {
    persistNextPlaybook,
    type PlaybookRepo,
} from "@/lib/tauri/deploymentPlaybookRepo";

export const dynamic = "force-dynamic";

function isUniqueConflict(cause: unknown): boolean {
    return Boolean(
        cause
        && typeof cause === "object"
        && "code" in cause
        && cause.code === "P2002",
    );
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const session = await resolveRequestDesktopSession(request);
    if (!session) {
        return NextResponse.json(
            { ok: false, error: "desktop_session_required" },
            { status: 401 },
        );
    }

    const { id } = await context.params;
    const correlationId = resolveCorrelationId(request.headers);
    try {
        const result = await persistNextPlaybook(
            prisma as unknown as PlaybookRepo,
            {
                organizationId: String(session.organizationId),
                deploymentRequestId: id,
                actorUserId: String(session.userId),
                actorRole: "requester",
                correlationId,
                generatedAtUtc: new Date().toISOString(),
            },
        );

        if (!result.ok) {
            return NextResponse.json({
                ok: false,
                error: result.reason,
                issues: result.issues,
            }, {
                status: result.reason === "request_not_found" ? 404 : 422,
                headers: { "x-correlation-id": correlationId },
            });
        }

        return NextResponse.json({
            ok: true,
            data: {
                id: result.row.id,
                requestId: result.row.deploymentRequestId,
                version: result.row.version,
                status: result.row.status,
                contentHash: result.row.contentHash,
                generatedAtUtc: result.playbook.generatedAtUtc,
                scope: result.playbook.scope,
                stepCount: result.playbook.steps.length,
                steps: result.playbook.steps,
            },
        }, {
            status: 201,
            headers: { "x-correlation-id": correlationId },
        });
    } catch (cause) {
        if (isUniqueConflict(cause)) {
            return NextResponse.json({
                ok: false,
                error: "playbook_version_conflict_refresh_required",
            }, {
                status: 409,
                headers: { "x-correlation-id": correlationId },
            });
        }
        return NextResponse.json(
            { ok: false, error: "deployment_playbook_generation_failed" },
            {
                status: 500,
                headers: { "x-correlation-id": correlationId },
            },
        );
    }
}

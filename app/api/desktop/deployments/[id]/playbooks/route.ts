import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/api/correlation";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import {
    persistNextPlaybook,
    readLatestPlaybook,
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

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const session = await resolveRequestDesktopSession(request, {
        requiredScope: "pipeline:read",
        route: "GET /api/desktop/deployments/:id/playbooks",
    });
    if (!session) {
        return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
    }

    try {
        const { id } = await context.params;
        const result = await readLatestPlaybook(
            prisma as unknown as Pick<PlaybookRepo, "tauriPlaybook">,
            { organizationId: String(session.organizationId), deploymentRequestId: id },
        );
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.reason }, {
                status: result.reason === "playbook_not_found" ? 404 : 422,
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
        });
    } catch {
        return NextResponse.json({ ok: false, error: "deployment_playbook_load_failed" }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const session = await resolveRequestDesktopSession(request, {
        requiredScope: "pipeline:trigger",
        route: "POST /api/desktop/deployments/:id/playbooks",
    });
    if (!session) {
        return NextResponse.json(
            { ok: false, error: "desktop_session_required" },
            { status: 401 },
        );
    }

    const versions = request.nextUrl.searchParams.getAll("expectedVersion");
    if (versions.length > 1 || (versions.length === 1 && !/^[1-9]\d{0,8}$/.test(versions[0]))) {
        return NextResponse.json({ ok: false, error: "invalid_release_version" }, { status: 400 });
    }
    const attemptId = request.headers.get("x-playbook-attempt-id");
    if (attemptId !== null && (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(attemptId) || versions.length !== 1)) {
        return NextResponse.json({ ok: false, error: "invalid_playbook_attempt" }, { status: 400 });
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
                expectedVersion: versions.length === 1 ? Number(versions[0]) : undefined,
                attemptId: attemptId ?? undefined,
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
                status: result.reason === "request_not_found" ? 404
                    : result.reason === "version_conflict" || result.reason === "release_not_submitted" || result.reason === "playbook_attempt_conflict" ? 409 : 422,
                headers: { "x-correlation-id": correlationId },
            });
        }

        return NextResponse.json({
            ok: true,
            data: {
                id: result.row.id,
                requestId: result.row.deploymentRequestId,
                requestVersion: result.requestVersion,
                ...(attemptId ? {attemptId} : {}),
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

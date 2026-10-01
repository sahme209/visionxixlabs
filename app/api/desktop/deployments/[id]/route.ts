import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/api/correlation";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { parseDeploymentIntake } from "@/lib/tauri/deploymentIntakeSchema";
import {
    reviseDeploymentRequest,
    type DeploymentRequestRepo,
} from "@/lib/tauri/deploymentRequestRepo";

export const dynamic = "force-dynamic";

/**
 * PUT /api/desktop/deployments/:id
 *
 * Revisions are full, validated snapshots. The version check is required so
 * two desktop operators cannot silently overwrite one another. This route
 * creates an audit record and immutable version; it never dispatches a job.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:trigger",
            route: "PUT /api/desktop/deployments/:id",
        });
        if (!session) {
            return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
        }

        const raw = await request.json().catch(() => null);
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }
        const { expectedVersion, ...intakePayload } = raw as Record<string, unknown>;
        if (!Number.isInteger(expectedVersion) || (expectedVersion as number) < 1) {
            return NextResponse.json({ ok: false, error: "expected_version_required" }, { status: 400 });
        }

        const { id } = await params;
        if (!id.trim()) return NextResponse.json({ ok: false, error: "invalid_request_id" }, { status: 400 });
        const parsed = parseDeploymentIntake({
            ...intakePayload,
            id,
            tenantId: String(session.organizationId),
        });
        if (!parsed.ok) {
            return NextResponse.json({ ok: false, error: "invalid_payload", issues: parsed.issues }, { status: 400 });
        }

        const correlationId = resolveCorrelationId(request.headers);
        const result = await reviseDeploymentRequest(
            prisma as unknown as DeploymentRequestRepo,
            {
                organizationId: String(session.organizationId),
                requesterUserId: String(session.userId),
                actorRole: "requester",
                correlationId,
                requestId: id,
                expectedVersion: expectedVersion as number,
                intake: parsed.intake,
            },
        );
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.reason, issues: result.issues }, {
                status: result.reason === "not_found" ? 404 : result.reason === "version_conflict" ? 409 : result.reason === "closed" ? 422 : 400,
            });
        }
        return NextResponse.json({
            ok: true,
            data: {
                id: result.request.id,
                title: result.request.title,
                status: result.request.status,
                version: result.request.version,
                changed: result.changed,
            },
        }, { headers: { "x-correlation-id": correlationId } });
    } catch {
        return NextResponse.json({ ok: false, error: "deployment_request_revision_failed" }, { status: 500 });
    }
}

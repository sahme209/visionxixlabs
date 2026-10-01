import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/api/correlation";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { parseDeploymentIntake } from "@/lib/tauri/deploymentIntakeSchema";
import {
    createDeploymentRequest,
    listDeploymentRequests,
    type DeploymentRequestRepo,
} from "@/lib/tauri/deploymentRequestRepo";

export const dynamic = "force-dynamic";

interface PlaybookSummaryRow {
    id: string;
    deploymentRequestId: string;
    version: number;
    status: string;
    contentHash: string;
    createdAt: Date;
}

interface PlaybookSummaryRepo {
    tauriPlaybook: {
        findMany(args: {
            where: {
                organizationId: string;
                deploymentRequestId: { in: string[] };
            };
            orderBy: { version: "desc" };
            distinct: ["deploymentRequestId"];
            select: {
                id: true;
                deploymentRequestId: true;
                version: true;
                status: true;
                contentHash: true;
                createdAt: true;
            };
        }): Promise<PlaybookSummaryRow[]>;
    };
}

interface ReleaseContextSummary {
    window: {
        startUtc: string;
        endUtc: string;
        displayTimeZone: string;
    } | null;
    scope: {
        applicationCount: number;
        repositoryCount: number;
        targetEnvironment: string | null;
    };
    approval: {
        prStatus: string;
        noPrRequired: boolean;
    };
    readiness: {
        developmentReady: boolean;
        productionReady: boolean;
        validationStepCount: number;
        deferredValidation: boolean;
        approvalDecision: "ready_for_human_approval" | "needs_attention";
        blockers: string[];
    };
    recovery: {
        rollbackAvailability: string;
        backupRequired: boolean;
        evidenceCount: number;
    };
    observation: {
        status: "not_connected";
        recordedMonitoringPlan: boolean;
    };
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

function count(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
}

/**
 * Redacts the full intake into the small set of operational signals the
 * desktop needs to orient a release. Raw URLs, contacts, workflow inputs,
 * and evidence identifiers remain inside the governed request record.
 */
function summarizeReleaseContext(intakeJson: unknown): ReleaseContextSummary {
    const intake = record(intakeJson);
    const noPrRequired = intake.noPrRequired === true;
    const developmentReady = intake.developmentReady === true;
    const productionReady = intake.productionReady === true;
    const validationStepCount = count(intake.validationSteps);
    const rollbackAvailability = text(intake.rollbackAvailability) ?? "unknown";
    const deferredValidation = record(intake.deferredValidation);
    const blockers = [
        !developmentReady ? "Development readiness has not been recorded." : null,
        !productionReady ? "Production readiness has not been recorded." : null,
        !noPrRequired && text(intake.prApprovalStatus) !== "approved"
            ? "Production pull-request approval has not been recorded."
            : null,
        validationStepCount === 0 ? "No production validation step has been recorded." : null,
        rollbackAvailability !== "yes" ? "A verified rollback path has not been recorded." : null,
    ].filter((value): value is string => Boolean(value));
    return {
        window: text(intake.windowStartUtc) && text(intake.windowEndUtc) ? {
            startUtc: text(intake.windowStartUtc)!,
            endUtc: text(intake.windowEndUtc)!,
            displayTimeZone: text(intake.displayTimeZone) ?? "UTC",
        } : null,
        scope: {
            applicationCount: count(intake.applications),
            repositoryCount: count(intake.repositoryUrls),
            targetEnvironment: text(intake.targetEnvironment),
        },
        approval: {
            prStatus: text(intake.prApprovalStatus) ?? "unknown",
            noPrRequired,
        },
        readiness: {
            developmentReady,
            productionReady,
            validationStepCount,
            deferredValidation: Boolean(intake.deferredValidation),
            approvalDecision: blockers.length === 0 ? "ready_for_human_approval" : "needs_attention",
            blockers,
        },
        recovery: {
            rollbackAvailability,
            backupRequired: intake.backupRequired === true,
            evidenceCount: count(intake.facts) + count(intake.backupEvidenceIds),
        },
        // A deployment intake can describe how someone intends to observe a
        // deferred validation, but that is not evidence that Axiom is
        // receiving production telemetry. Keep the absence explicit until a
        // tenant-scoped observability connector proves otherwise.
        observation: {
            status: "not_connected",
            recordedMonitoringPlan: Boolean(text(deferredValidation.monitoringPlan)),
        },
    };
}

function isUniqueConflict(cause: unknown): boolean {
    return Boolean(
        cause
        && typeof cause === "object"
        && "code" in cause
        && cause.code === "P2002",
    );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:read",
            route: "GET /api/desktop/deployments",
        });
        if (!session) {
            return NextResponse.json(
                { ok: false, error: "desktop_session_required" },
                { status: 401 },
            );
        }

        const rows = await listDeploymentRequests(
            prisma as unknown as DeploymentRequestRepo,
            String(session.organizationId),
        );
        const playbooks = rows.length > 0
            ? await (prisma as unknown as PlaybookSummaryRepo).tauriPlaybook.findMany({
                where: {
                    organizationId: String(session.organizationId),
                    deploymentRequestId: { in: rows.map((row) => row.id) },
                },
                orderBy: { version: "desc" },
                distinct: ["deploymentRequestId"],
                select: {
                    id: true,
                    deploymentRequestId: true,
                    version: true,
                    status: true,
                    contentHash: true,
                    createdAt: true,
                },
            })
            : [];
        const latestByRequest = new Map<string, PlaybookSummaryRow>();
        for (const playbook of playbooks) {
            if (!latestByRequest.has(playbook.deploymentRequestId)) {
                latestByRequest.set(playbook.deploymentRequestId, playbook);
            }
        }

        return NextResponse.json({
            ok: true,
            data: rows.map((row) => {
                const latest = latestByRequest.get(row.id);
                return {
                    id: row.id,
                    title: row.title,
                    status: row.status,
                    version: row.version,
                    correlationId: row.correlationId,
                    submittedAt: row.submittedAt?.toISOString() ?? null,
                    closedAt: row.closedAt?.toISOString() ?? null,
                    updatedAt: row.updatedAt.toISOString(),
                    releaseContext: summarizeReleaseContext(row.intakeJson),
                    latestPlaybook: latest ? {
                        id: latest.id,
                        version: latest.version,
                        status: latest.status,
                        contentHash: latest.contentHash,
                        createdAt: latest.createdAt.toISOString(),
                    } : null,
                };
            }),
        });
    } catch {
        return NextResponse.json(
            { ok: false, error: "deployment_request_list_failed" },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:trigger",
            route: "POST /api/desktop/deployments",
        });
        if (!session) {
            return NextResponse.json(
                { ok: false, error: "desktop_session_required" },
                { status: 401 },
            );
        }

        let raw: unknown;
        try {
            raw = await request.json();
        } catch {
            return NextResponse.json(
                { ok: false, error: "invalid_json" },
                { status: 400 },
            );
        }
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            return NextResponse.json(
                { ok: false, error: "invalid_payload" },
                { status: 400 },
            );
        }

        const requestId = `tdr_${crypto.randomUUID().replaceAll("-", "")}`;
        const parsed = parseDeploymentIntake({
            ...raw,
            id: requestId,
            tenantId: String(session.organizationId),
        });
        if (!parsed.ok) {
            return NextResponse.json({
                ok: false,
                error: "invalid_payload",
                issues: parsed.issues,
            }, { status: 400 });
        }

        const correlationId = resolveCorrelationId(request.headers);
        const result = await createDeploymentRequest(
            prisma as unknown as DeploymentRequestRepo,
            {
                organizationId: String(session.organizationId),
                requesterUserId: String(session.userId),
                actorRole: "requester",
                correlationId,
                requestId,
                receivedAtUtc: new Date().toISOString(),
                intake: parsed.intake,
            },
        );
        if (!result.ok) {
            return NextResponse.json({
                ok: false,
                error: result.reason,
                issues: result.issues,
            }, {
                status: result.reason === "tenant_mismatch"
                    ? 403
                    : result.reason === "correlation_conflict"
                    ? 409
                    : 422,
            });
        }

        return NextResponse.json({
            ok: true,
            data: {
                id: result.request.id,
                title: result.request.title,
                status: result.request.status,
                version: result.request.version,
                correlationId: result.request.correlationId,
                submittedAt: result.request.submittedAt?.toISOString() ?? null,
                replayed: result.replayed,
            },
        }, {
            status: result.replayed ? 200 : 201,
            headers: { "x-correlation-id": correlationId },
        });
    } catch (cause) {
        if (isUniqueConflict(cause)) {
            return NextResponse.json(
                { ok: false, error: "request_idempotency_conflict_retry" },
                { status: 409 },
            );
        }
        return NextResponse.json(
            { ok: false, error: "deployment_request_create_failed" },
            { status: 500 },
        );
    }
}

import { verifyIntakeWorkflowSource } from "@/lib/tauri/intakeWorkflowSource";
import { batchHistoryCursorSchema, batchHistoryExcludedIdsSchema, batchHistoryPageSize, type BatchHistoryCursor } from "@/lib/desktop/batchHistoryContract";
import { releaseAirflowDependencySchema } from "@/lib/integrations/airflow/releaseDependencySchema";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/api/correlation";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { parseDeploymentIntake } from "@/lib/tauri/deploymentIntakeSchema";
import { savedReleaseLocatorSchema, type ReleaseContextSummary } from "@/lib/tauri/deploymentRequestSummary";
import { uniqueGithubRepositories } from "@/lib/connectors/github/releaseEvidence";
import {
    createDeploymentRequest,
    getDeploymentRequest,
    listDeploymentRequests,
    type DeploymentRequestRepo,
    type DeploymentRequestRow,
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
function summarizeReleaseContext(intakeJson: unknown, canReadGithub: boolean): ReleaseContextSummary {
    const intake = record(intakeJson);
    const batches = releaseAirflowDependencySchema.safeParse(intake.airflowDependency);
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
        batches: { selectedRunCount: batches.success ? batches.data.runs.length : 0 },
        window: text(intake.windowStartUtc) && text(intake.windowEndUtc) ? {
            startUtc: text(intake.windowStartUtc)!,
            endUtc: text(intake.windowEndUtc)!,
            displayTimeZone: text(intake.displayTimeZone) ?? "UTC",
        } : null,
        scope: {
            applicationCount: count(intake.applications),
            repositoryCount: count(intake.repositoryUrls),
            targetEnvironment: text(intake.targetEnvironment),
            ...(intake.changeCreationMethod === "not_applicable" && { changeNotApplicable: true as const }),
            ...(canReadGithub && Array.isArray(intake.repositoryUrls) && {
                githubRepositories: uniqueGithubRepositories(intake.repositoryUrls.filter(
                    (value): value is string => typeof value === "string",
                )).map(({ owner, repository }) => `${owner}/${repository}`),
            }),
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

async function readRequesterNames(organizationId: string, rows: DeploymentRequestRow[]) {
    const requesterIds = [...new Set(rows.filter(row => row.organizationId === organizationId).map(row => row.requesterUserId))];
    if (requesterIds.length === 0) return new Map<string, string | null>();

    const members = await prisma.orgMembership.findMany({
        where: { organizationId, userId: { in: requesterIds }, acceptedAt: { not: null } },
        select: { userId: true },
    });
    if (members.length === 0) return new Map<string, string | null>();
    const users = await prisma.user.findMany({
        where: { id: { in: members.map(member => member.userId) }, name: { not: null } },
        select: { id: true, name: true },
    });
    return new Map(users.map(user => [user.id, user.name?.trim().slice(0, 160) || null]));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const query = request.nextUrl.searchParams;
        const history = query.getAll("batchHistory");
        const beforeIds = query.getAll("beforeReleaseId");
        const beforeTimes = query.getAll("beforeClosedAt");
        const excluded = query.getAll("excludeReleaseId");
        const archive = history.length > 0;
        const authority = { requiredScope: "pipeline:read", route: "GET /api/desktop/deployments",
            ...(archive && { allowApiKey: false, requiredCapability: "workspace:read" as const }) } as const;
        const unauthorized = () => NextResponse.json({ok:false,error:"desktop_session_required"}, {status:401});
        const session = await resolveRequestDesktopSession(request, authority);
        if (!session) return unauthorized();

        let before: BatchHistoryCursor | undefined;
        if (archive || beforeIds.length || beforeTimes.length || excluded.length) {
            const invalid = () => NextResponse.json({ok:false,error:"invalid_batch_history_selection"},{status:400});
            if (history.length !== 1 || history[0] !== "1" || !batchHistoryExcludedIdsSchema.safeParse(excluded).success ||
                ["savedReleaseId", "savedReleaseVersion", "linkedReleaseId", "includeRequester"].some(key => query.has(key))) return invalid();
            if (beforeIds.length || beforeTimes.length) {
                const cursor = batchHistoryCursorSchema.safeParse({id:beforeIds[0],closedAt:beforeTimes[0]});
                if (beforeIds.length !== 1 || beforeTimes.length !== 1 || !cursor.success) return invalid();
                before = cursor.data;
            }
        }

        const canReadGithub = session.credentialKind === "desktop_session" && session.capabilities.includes("github:read");
        const ids = query.getAll("savedReleaseId");
        const versions = query.getAll("savedReleaseVersion");
        const organizationId = String(session.organizationId);
        const repository = prisma as unknown as DeploymentRequestRepo;
        const linkedIds = query.getAll("linkedReleaseId");
        if (linkedIds.length) {
            const linked = savedReleaseLocatorSchema.shape.id.safeParse(linkedIds[0]);
            if (linkedIds.length !== 1 || ids.length || versions.length || !linked.success) {
                return NextResponse.json({ ok: false, error: "invalid_linked_release" }, { status: 400 });
            }
            const row = await getDeploymentRequest(repository, organizationId, linked.data);
            const locator = savedReleaseLocatorSchema.safeParse(row && { id: row.id, version: row.version });
            const data = row?.organizationId === organizationId && locator.success && locator.data.id === linked.data ? locator.data : null;
            return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "private, no-store" } });
        }
        let rows: DeploymentRequestRow[];
        let nextCursor: BatchHistoryCursor | null = null;
        if (archive) {
            const closedAt = before ? new Date(before.closedAt) : undefined;
            const candidates = await prisma.tauriDeploymentRequest.findMany({
                where: {
                    organizationId, status:"closed", closedAt:{not:null},
                    intakeJson:{path:["airflowDependency","runs"],array_contains:[]},
                    ...(excluded.length > 0 && {id:{notIn:excluded}}),
                    ...(before && {OR:[{closedAt:{lt:closedAt}},{closedAt,id:{lt:before.id}}]}),
                },
                orderBy:[{closedAt:"desc"},{id:"desc"}],
                take:batchHistoryPageSize + 1,
            });
            const scanned = candidates.slice(0,batchHistoryPageSize);
            const tail = scanned.at(-1);
            if (candidates.length > batchHistoryPageSize && tail?.closedAt) {
                nextCursor = batchHistoryCursorSchema.parse({id:tail.id,closedAt:tail.closedAt.toISOString()});
            }
            // A matching JSON array is a candidate. Legacy or malformed declarations stay out of the archive.
            rows = scanned.filter(row => row.organizationId === organizationId && row.status === "closed" && row.closedAt &&
                releaseAirflowDependencySchema.safeParse(record(row.intakeJson).airflowDependency).success);
        } else if (ids.length || versions.length) {
            const exact = savedReleaseLocatorSchema.safeParse({ id: ids[0], version: Number(versions[0]) });
            if (ids.length !== 1 || versions.length !== 1 || !/^[1-9][0-9]*$/.test(versions[0]) || !exact.success) {
                return NextResponse.json({ ok: false, error: "invalid_saved_release" }, { status: 400 });
            }
            const row = await getDeploymentRequest(repository, organizationId, exact.data.id);
            rows = row?.id === exact.data.id && row.organizationId === organizationId && row.version === exact.data.version ? [row] : [];
        } else {
            rows = await listDeploymentRequests(repository, organizationId);
        }
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
        // Legacy desktop clients validate exact summaries with a strict schema.
        const requesterNames = query.get("includeRequester") === "1" &&
            session.credentialKind === "desktop_session" && session.capabilities.includes("workspace:read")
            ? await readRequesterNames(organizationId, rows).catch(() => undefined)
            : undefined;
        const latestByRequest = new Map<string, PlaybookSummaryRow>();
        for (const playbook of playbooks) {
            if (!latestByRequest.has(playbook.deploymentRequestId)) {
                latestByRequest.set(playbook.deploymentRequestId, playbook);
            }
        }

        const data = rows.map((row) => {
            const latest = latestByRequest.get(row.id);
            const requesterName = row.organizationId === organizationId ? requesterNames?.get(row.requesterUserId) : undefined;
            return {
                id: row.id,
                title: row.title,
                status: row.status,
                version: row.version,
                correlationId: row.correlationId,
                submittedAt: row.submittedAt?.toISOString() ?? null,
                closedAt: row.closedAt?.toISOString() ?? null,
                updatedAt: row.updatedAt.toISOString(),
                ...(requesterName ? { requesterName } : {}),
                releaseContext: summarizeReleaseContext(row.intakeJson, canReadGithub),
                latestPlaybook: latest ? {
                    id: latest.id,
                    version: latest.version,
                    status: latest.status,
                    contentHash: latest.contentHash,
                    createdAt: latest.createdAt.toISOString(),
                } : null,
            };
        });
        if (archive) {
            const current = await resolveRequestDesktopSession(request, {...authority, recordHeartbeat:false});
            if (!current || current.id !== session.id || current.userId !== session.userId ||
                current.organizationId !== session.organizationId || request.signal.aborted ||
                (canReadGithub && !current.capabilities.includes("github:read"))) return unauthorized();
        }
        return NextResponse.json({ok:true,data:archive ? {releases:data,nextCursor} : data},
            {headers:{"Cache-Control":"private, no-store"}});
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

        if (!await verifyIntakeWorkflowSource(String(session.organizationId), parsed.intake, request.signal)) {
            return NextResponse.json({ ok: false, error: "workflow_source_unverified" }, { status: 409 });
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

import { isDeepStrictEqual } from "node:util";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";

export const dynamic = "force-dynamic";

interface VersionRow {
    version: number;
    intakeJson: unknown;
    createdByUserId: string;
    createdAt: Date;
}

interface VersionRepo {
    tauriDeploymentRequestVersion: {
        findMany(args: {
            where: { organizationId: string; deploymentRequestId: string; version?: { lte: number } };
            orderBy: { version: "asc" };
            select: { version: true; intakeJson: true; createdByUserId: true; createdAt: true };
        }): Promise<VersionRow[]>;
    };
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function text(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function list(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

type RevisionSnapshot = {
    title: string;
    applications: unknown[];
    repositories: unknown[];
    environment: string;
    prApproval: string;
    developmentReady: boolean;
    productionReady: boolean;
    validationPlan: { steps: unknown[]; owner: string; expectedResult: string; deferral: Record<string, unknown> };
    rollbackPlan: { availability: string; steps: unknown[]; owner: string };
    recoveryBackup: { required: boolean; evidence: unknown[] };
};

function snapshot(value: unknown): RevisionSnapshot {
    const intake = record(value);
    return {
        title: text(intake.title),
        applications: list(intake.applications),
        repositories: list(intake.repositoryUrls),
        environment: text(intake.targetEnvironment),
        prApproval: intake.noPrRequired === true ? "not_required" : text(intake.prApprovalStatus),
        developmentReady: intake.developmentReady === true,
        productionReady: intake.productionReady === true,
        validationPlan: {
            steps: list(intake.validationSteps),
            owner: text(intake.validationOwner),
            expectedResult: text(intake.expectedProductionResult),
            deferral: record(intake.deferredValidation),
        },
        rollbackPlan: {
            availability: text(intake.rollbackAvailability),
            steps: list(intake.rollbackSteps),
            owner: text(intake.rollbackOwner),
        },
        recoveryBackup: {
            required: intake.backupRequired === true,
            evidence: list(intake.backupEvidenceIds),
        },
    };
}

function changes(previous: RevisionSnapshot | undefined, current: RevisionSnapshot, version: number): string[] {
    if (!previous) return [version === 1
        ? "Initial governed request recorded."
        : "Previous revision unavailable. Changes cannot be compared."];
    const labels: Array<[keyof RevisionSnapshot, string]> = [
        ["title", "Request title"], ["applications", "Application scope"], ["repositories", "Repository scope"],
        ["environment", "Target environment"], ["prApproval", "Pull-request approval"],
        ["developmentReady", "Development readiness"], ["productionReady", "Production readiness"],
        ["validationPlan", "Validation plan"], ["rollbackPlan", "Rollback posture"],
        ["recoveryBackup", "Recovery backup"],
    ];
    const changed = labels.filter(([key]) => !isDeepStrictEqual(previous[key], current[key])).map(([, label]) => label);
    return changed.length > 0 ? changed : ["No changes in the fields summarized here."];
}

/**
 * Returns an audit-safe revision timeline. It intentionally excludes raw
 * contacts, repository URLs, workflow inputs, evidence references, and full
 * author identifiers from the desktop response.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await resolveRequestDesktopSession(request, {
            requiredScope: "pipeline:read",
            route: "GET /api/desktop/deployments/:id/history",
        });
        if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
        const { id } = await params;
        const versions = request.nextUrl.searchParams.getAll("throughVersion");
        if (versions.length > 1 || (versions.length === 1 && !/^[1-9]\d{0,8}$/.test(versions[0]))) {
            return NextResponse.json({ ok: false, error: "invalid_release_version" }, { status: 400 });
        }
        const throughVersion = versions.length ? Number(versions[0]) : undefined;
        const rows = await (prisma as unknown as VersionRepo).tauriDeploymentRequestVersion.findMany({
            where: { organizationId: String(session.organizationId), deploymentRequestId: id,
                ...(throughVersion !== undefined ? {version: {lte: throughVersion}} : {}) },
            orderBy: { version: "asc" },
            select: { version: true, intakeJson: true, createdByUserId: true, createdAt: true },
        });
        if (rows.length === 0 || (throughVersion !== undefined && rows.at(-1)?.version !== throughVersion)) return NextResponse.json({ ok: false, error: "revision_history_not_found" }, { status: 404 });

        let previous: { version: number; snapshot: RevisionSnapshot } | undefined;
        const history = rows.map((row) => {
            const current = snapshot(row.intakeJson);
            const baseline = previous?.version === row.version - 1 ? previous.snapshot : undefined;
            const item = {
                version: row.version,
                createdAt: row.createdAt.toISOString(),
                author: row.createdByUserId === String(session.userId) ? "You" : "Workspace member",
                changes: changes(baseline, current, row.version),
            };
            previous = { version: row.version, snapshot: current };
            return item;
        }).reverse();
        return NextResponse.json({ ok: true, data: history }, {headers: {"Cache-Control": "private, no-store"}});
    } catch {
        return NextResponse.json({ ok: false, error: "revision_history_load_failed" }, { status: 500 });
    }
}

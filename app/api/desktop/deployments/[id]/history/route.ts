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
            where: { organizationId: string; deploymentRequestId: string };
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

function count(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
}

type SafeSnapshot = {
    title: string;
    applicationCount: number;
    repositoryCount: number;
    environment: string;
    prApproval: string;
    developmentReady: boolean;
    productionReady: boolean;
    validationCount: number;
    rollbackAvailability: string;
};

function snapshot(value: unknown): SafeSnapshot {
    const intake = record(value);
    return {
        title: text(intake.title),
        applicationCount: count(intake.applications),
        repositoryCount: count(intake.repositoryUrls),
        environment: text(intake.targetEnvironment),
        prApproval: intake.noPrRequired === true ? "not_required" : text(intake.prApprovalStatus),
        developmentReady: intake.developmentReady === true,
        productionReady: intake.productionReady === true,
        validationCount: count(intake.validationSteps),
        rollbackAvailability: text(intake.rollbackAvailability),
    };
}

function changes(previous: SafeSnapshot | undefined, current: SafeSnapshot): string[] {
    if (!previous) return ["Initial governed request recorded."];
    const labels: Array<[keyof SafeSnapshot, string]> = [
        ["title", "Request title"], ["applicationCount", "Application scope"], ["repositoryCount", "Repository scope"],
        ["environment", "Target environment"], ["prApproval", "Pull-request approval"],
        ["developmentReady", "Development readiness"], ["productionReady", "Production readiness"],
        ["validationCount", "Validation plan"], ["rollbackAvailability", "Rollback posture"],
    ];
    const changed = labels.filter(([key]) => previous[key] !== current[key]).map(([, label]) => label);
    return changed.length > 0 ? changed : ["No governed fields changed."];
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
        const rows = await (prisma as unknown as VersionRepo).tauriDeploymentRequestVersion.findMany({
            where: { organizationId: String(session.organizationId), deploymentRequestId: id },
            orderBy: { version: "asc" },
            select: { version: true, intakeJson: true, createdByUserId: true, createdAt: true },
        });
        if (rows.length === 0) return NextResponse.json({ ok: false, error: "revision_history_not_found" }, { status: 404 });

        let previous: SafeSnapshot | undefined;
        const history = rows.map((row) => {
            const current = snapshot(row.intakeJson);
            const item = {
                version: row.version,
                createdAt: row.createdAt.toISOString(),
                author: row.createdByUserId === String(session.userId) ? "You" : "Workspace member",
                changes: changes(previous, current),
            };
            previous = current;
            return item;
        }).reverse();
        return NextResponse.json({ ok: true, data: history });
    } catch {
        return NextResponse.json({ ok: false, error: "revision_history_load_failed" }, { status: 500 });
    }
}

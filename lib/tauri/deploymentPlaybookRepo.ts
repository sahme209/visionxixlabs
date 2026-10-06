import { parseDeploymentIntake } from "./deploymentIntakeSchema";
import { generatePlaybook, validateIntake, type DeploymentPlaybook } from "./deploymentOperations";
import { sha256ContentHash } from "./contentHash";

interface RequestRow {
    id: string;
    organizationId: string;
    version: number;
    intakeJson: unknown;
}

export interface PlaybookRow {
    id: string;
    organizationId: string;
    deploymentRequestId: string;
    version: number;
    status: string;
    playbookJson: unknown;
    contentHash: string;
    createdByUserId: string;
    createdAt: Date;
}

interface RequestDelegate {
    findFirst(args: {
        where: { id: string; organizationId: string };
    }): Promise<RequestRow | null>;
}

interface PlaybookDelegate {
    findFirst(args: {
        where: { deploymentRequestId: string; organizationId: string };
        orderBy: { version: "desc" };
    }): Promise<PlaybookRow | null>;
    create(args: {
        data: {
            organizationId: string;
            deploymentRequestId: string;
            version: number;
            status: string;
            playbookJson: unknown;
            contentHash: string;
            createdByUserId: string;
            createdAt: Date;
        };
    }): Promise<PlaybookRow>;
}

interface AuditDelegate {
    create(args: {
        data: {
            organizationId: string;
            deploymentRequestId: string;
            actorUserId: string;
            actorRole: string;
            action: string;
            newValueJson: unknown;
            source: string;
            correlationId: string;
            timeZone: string;
        };
    }): Promise<unknown>;
}

export interface PlaybookRepo {
    tauriDeploymentRequest: RequestDelegate;
    tauriPlaybook: PlaybookDelegate;
    tauriAuditEvent: AuditDelegate;
    $transaction<T>(fn: (tx: PlaybookRepo) => Promise<T>): Promise<T>;
}

export type PersistPlaybookResult =
    | { ok: true; row: PlaybookRow; playbook: DeploymentPlaybook }
    | {
        ok: false;
        reason: "request_not_found" | "stored_intake_invalid";
        issues?: Array<{ field: string; message: string }>;
    };

export interface PersistPlaybookInput {
    organizationId: string;
    deploymentRequestId: string;
    actorUserId: string;
    actorRole: string;
    correlationId: string;
    generatedAtUtc: string;
}

export type ReadLatestPlaybookResult =
    | { ok: true; row: PlaybookRow; playbook: DeploymentPlaybook }
    | { ok: false; reason: "playbook_not_found" | "stored_playbook_invalid" };

/**
 * Retrieves the latest persisted playbook for the authenticated tenant.
 * Reading never changes a request, generates a new playbook, or dispatches
 * an operation.
 */
export async function readLatestPlaybook(
    repo: Pick<PlaybookRepo, "tauriPlaybook">,
    input: { organizationId: string; deploymentRequestId: string },
): Promise<ReadLatestPlaybookResult> {
    const row = await repo.tauriPlaybook.findFirst({
        where: {
            organizationId: input.organizationId,
            deploymentRequestId: input.deploymentRequestId,
        },
        orderBy: { version: "desc" },
    });
    if (!row) return { ok: false, reason: "playbook_not_found" };

    const value = row.playbookJson;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, reason: "stored_playbook_invalid" };
    }
    const playbook = value as DeploymentPlaybook;
    if (!Array.isArray(playbook.steps) || typeof playbook.scope !== "string") {
        return { ok: false, reason: "stored_playbook_invalid" };
    }
    return { ok: true, row, playbook };
}

export async function persistNextPlaybook(
    repo: PlaybookRepo,
    input: PersistPlaybookInput,
): Promise<PersistPlaybookResult> {
    return repo.$transaction(async (tx) => {
        const request = await tx.tauriDeploymentRequest.findFirst({
            where: {
                id: input.deploymentRequestId,
                organizationId: input.organizationId,
            },
        });
        if (!request) return { ok: false, reason: "request_not_found" };

        const parsed = parseDeploymentIntake(request.intakeJson);
        if (!parsed.ok) {
            return {
                ok: false,
                reason: "stored_intake_invalid",
                issues: parsed.issues,
            };
        }
        const domainIssues = validateIntake(parsed.intake);
        if (domainIssues.length > 0) {
            return {
                ok: false,
                reason: "stored_intake_invalid",
                issues: domainIssues.map(({ field, message }) => ({ field, message })),
            };
        }

        const latest = await tx.tauriPlaybook.findFirst({
            where: {
                deploymentRequestId: request.id,
                organizationId: input.organizationId,
            },
            orderBy: { version: "desc" },
        });
        const version = (latest?.version ?? 0) + 1;
        const playbook = generatePlaybook(
            parsed.intake,
            input.generatedAtUtc,
            version,
        );
        const contentHash = sha256ContentHash({
            requestVersion: request.version,
            intake: parsed.intake,
            playbook,
        });

        const row = await tx.tauriPlaybook.create({
            data: {
                organizationId: input.organizationId,
                deploymentRequestId: request.id,
                version,
                status: playbook.status,
                playbookJson: playbook,
                contentHash,
                createdByUserId: input.actorUserId,
                createdAt: new Date(input.generatedAtUtc),
            },
        });

        await tx.tauriAuditEvent.create({
            data: {
                organizationId: input.organizationId,
                deploymentRequestId: request.id,
                actorUserId: input.actorUserId,
                actorRole: input.actorRole,
                action: "deployment_playbook.generated",
                newValueJson: {
                    version,
                    contentHash,
                    status: playbook.status,
                    stepCount: playbook.steps.length,
                },
                source: "desktop",
                correlationId: input.correlationId,
                timeZone: parsed.intake.displayTimeZone,
            },
        });

        return { ok: true, row, playbook };
    });
}

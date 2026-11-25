import { parseDeploymentIntake } from "./deploymentIntakeSchema";
import { generatePlaybook, validateIntake, type DeploymentPlaybook } from "./deploymentOperations";
import { z } from "zod";
import { sha256ContentHash } from "./contentHash";

interface RequestRow {
    id: string;
    organizationId: string;
    version: number;
    status: string;
    closedAt: Date | null;
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

interface PlaybookDelegate {
    findFirst(args: {
        where: { deploymentRequestId: string; organizationId: string; id?: string };
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

const generationAction = "deployment_playbook.generated";
const attemptReceipt = z.object({
    attemptId: z.string().uuid(),
    requestVersion: z.number().int().positive(),
    playbookId: z.string().min(1),
    version: z.number().int().positive(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});

interface AuditDelegate {
    findMany(args: {
        where: { organizationId: string; deploymentRequestId: string; action: string; correlationId: string };
        select: { actorUserId: true; newValueJson: true };
        take: number;
    }): Promise<{actorUserId: string; newValueJson: unknown}[]>;
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
    $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
    tauriPlaybook: PlaybookDelegate;
    tauriAuditEvent: AuditDelegate;
    $transaction<T>(fn: (tx: PlaybookRepo) => Promise<T>): Promise<T>;
}

export type PersistPlaybookResult =
    | { ok: true; row: PlaybookRow; playbook: DeploymentPlaybook; requestVersion: number }
    | {
        ok: false;
        reason: "request_not_found" | "stored_intake_invalid" | "version_conflict" | "release_not_submitted" | "playbook_attempt_conflict";
        issues?: Array<{ field: string; message: string }>;
    };

export interface PersistPlaybookInput {
    organizationId: string;
    deploymentRequestId: string;
    expectedVersion?: number;
    attemptId?: string;
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
    input: { organizationId: string; deploymentRequestId: string; playbookId?: string },
): Promise<ReadLatestPlaybookResult> {
    const row = await repo.tauriPlaybook.findFirst({
        where: {
            organizationId: input.organizationId,
            deploymentRequestId: input.deploymentRequestId,
            ...(input.playbookId ? {id: input.playbookId} : {}),
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
        // Revision and closure update this row. Hold it through the playbook and audit writes.
        const [request] = await tx.$queryRaw<RequestRow[]>`
            SELECT "id", "organizationId", "version", "status", "closedAt", "intakeJson"
            FROM "TauriDeploymentRequest"
            WHERE "id" = ${input.deploymentRequestId} AND "organizationId" = ${input.organizationId}
            FOR UPDATE
        `;
        if (!request) return { ok: false, reason: "request_not_found" };
        if (input.attemptId) {
            const receipts = await tx.tauriAuditEvent.findMany({
                where: {organizationId: input.organizationId, deploymentRequestId: request.id,
                    action: generationAction, correlationId: input.attemptId},
                select: {actorUserId: true, newValueJson: true},
                take: 2,
            });
            if (receipts.length) {
                const receipt = attemptReceipt.safeParse(receipts[0].newValueJson);
                if (receipts.length !== 1 || receipts[0].actorUserId !== input.actorUserId ||
                    !receipt.success || receipt.data.attemptId !== input.attemptId ||
                    receipt.data.requestVersion !== input.expectedVersion) {
                    return {ok: false, reason: "playbook_attempt_conflict"};
                }
                const stored = await readLatestPlaybook(tx, {...input, playbookId: receipt.data.playbookId});
                if (!stored.ok || stored.row.version !== receipt.data.version || stored.row.contentHash !== receipt.data.contentHash) {
                    return {ok: false, reason: "playbook_attempt_conflict"};
                }
                return {...stored, requestVersion: receipt.data.requestVersion};
            }
        }
        if (input.expectedVersion !== undefined && request.version !== input.expectedVersion) {
            return { ok: false, reason: "version_conflict" };
        }

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

        if (request.status !== "submitted" || request.closedAt) {
            return { ok: false, reason: "release_not_submitted" };
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
                action: generationAction,
                newValueJson: {
                    ...(input.attemptId ? {attemptId: input.attemptId, playbookId: row.id} : {}),
                    requestVersion: request.version,
                    version,
                    contentHash,
                    status: playbook.status,
                    stepCount: playbook.steps.length,
                },
                source: "desktop",
                correlationId: input.attemptId ?? input.correlationId,
                timeZone: parsed.intake.displayTimeZone,
            },
        });

        return { ok: true, row, playbook, requestVersion: request.version };
    });
}

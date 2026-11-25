import { describe, expect, it } from "vitest";
import {
    persistNextPlaybook,
    readLatestPlaybook,
    type PlaybookRepo,
    type PlaybookRow,
} from "../deploymentPlaybookRepo";
import type { DeploymentIntake } from "../deploymentOperations";

function validIntake(): DeploymentIntake {
    return {
        id: "request-01",
        tenantId: "tenant-a",
        title: "Production configuration release",
        serviceImpactingNow: false,
        requestClass: "planned_release",
        windowStartUtc: "2026-10-10T18:00:00.000Z",
        windowEndUtc: "2026-10-10T20:00:00.000Z",
        displayTimeZone: "ET",
        changeTypes: ["configuration_change"],
        applications: ["Checkout"],
        clients: ["Client A"],
        deploymentContact: "operator@example.test",
        repositoryUrls: ["https://git.example.test/checkout"],
        productionPrUrls: ["https://git.example.test/checkout/pull/42"],
        noPrRequired: false,
        prApprovalStatus: "approved",
        sourceBranch: "release/42",
        targetBranch: "main",
        deploymentMethod: "GitHub Actions",
        workflowName: "Deploy Config",
        targetEnvironment: "Production",
        workflowInputs: { branch: "main", client: "Client A" },
        manualSteps: [],
        lowerEnvironmentTested: ["Stage"],
        lowerEnvironmentValidation: "yes",
        developmentReady: true,
        productionReady: true,
        validationSteps: [{
            id: "validate",
            instruction: "Confirm the approved configuration.",
            owner: "application_team",
            evidenceRequired: true,
            completed: false,
        }],
        expectedProductionResult: "Approved configuration is active.",
        validationOwner: "shared",
        rollbackAvailability: "yes",
        rollbackSteps: [{
            id: "rollback",
            instruction: "Redeploy the prior known-good version.",
            owner: "devops",
            evidenceRequired: true,
            completed: false,
        }],
        rollbackOwner: "operator@example.test",
        backupRequired: false,
        backupEvidenceIds: [],
        changeCreationMethod: "manual_servicenow",
        applicationContact: "owner@example.test",
        escalationContact: "incident@example.test",
        facts: [{
            id: "fact-01",
            classification: "confirmed",
            value: "Workflow dispatch is the production trigger.",
            sourceEvidenceId: "evidence-01",
            confirmedBy: "owner@example.test",
        }],
    };
}

class FakeRepo implements PlaybookRepo {
    readonly requests = [{
        id: "request-01",
        organizationId: "tenant-a",
        version: 1,
        status: "submitted",
        closedAt: null as Date | null,
        intakeJson: validIntake(),
    }];
    readonly playbooks: PlaybookRow[] = [];
    readonly audits: Parameters<PlaybookRepo["tauriAuditEvent"]["create"]>[0]["data"][] = [];

    tauriPlaybook: PlaybookRepo["tauriPlaybook"];
    tauriAuditEvent: PlaybookRepo["tauriAuditEvent"];

    constructor() {
        this.tauriPlaybook = {
            findFirst: async ({ where }) =>
                [...this.playbooks]
                    .filter((row) =>
                        row.deploymentRequestId === where.deploymentRequestId
                        && row.organizationId === where.organizationId
                        && (!where.id || row.id === where.id),
                    )
                    .sort((a, b) => b.version - a.version)[0] ?? null,
            create: async ({ data }) => {
                const row: PlaybookRow = {
                    id: `playbook-${this.playbooks.length + 1}`,
                    ...data,
                };
                this.playbooks.push(row);
                return row;
            },
        };
        this.tauriAuditEvent = {
            findMany: async ({where, take}) => this.audits.filter(event =>
                event.organizationId === where.organizationId && event.deploymentRequestId === where.deploymentRequestId
                && event.action === where.action && event.correlationId === where.correlationId).slice(0, take),
            create: async ({ data }) => {
                this.audits.push(data);
                return data;
            },
        };
    }

    async $queryRaw<T>(query: TemplateStringsArray, ...[id, organizationId]: unknown[]): Promise<T> {
        expect(query.join("?")).toMatch(/FROM "TauriDeploymentRequest"[\s\S]*FOR UPDATE/);
        return this.requests.filter(row => row.id === id && row.organizationId === organizationId) as T;
    }

    async $transaction<T>(fn: (tx: PlaybookRepo) => Promise<T>): Promise<T> {
        return fn(this);
    }
}

function input(organizationId = "tenant-a") {
    return {
        organizationId,
        deploymentRequestId: "request-01",
        actorUserId: "user-01",
        actorRole: "requester",
        correlationId: "correlation-01",
        generatedAtUtc: "2026-09-25T15:00:00.000Z",
    };
}

describe("deployment playbook persistence", () => {
    it("does not disclose a request from another tenant", async () => {
        const repo = new FakeRepo();
        const result = await persistNextPlaybook(repo, input("tenant-b"));

        expect(result).toEqual({ ok: false, reason: "request_not_found" });
        expect(repo.playbooks).toHaveLength(0);
        expect(repo.audits).toHaveLength(0);
    });

    it("refuses malformed stored intake without creating a playbook", async () => {
        const repo = new FakeRepo();
        repo.requests[0].intakeJson = { title: "Incomplete" } as DeploymentIntake;

        const result = await persistNextPlaybook(repo, input());

        expect(result).toMatchObject({ ok: false, reason: "stored_intake_invalid" });
        expect(repo.playbooks).toHaveLength(0);
        expect(repo.audits).toHaveLength(0);
    });

    it("refuses a changed version and a closed release without writing either record", async () => {
        const repo = new FakeRepo();
        repo.requests[0].version = 2;
        await expect(persistNextPlaybook(repo, {...input(), expectedVersion: 1}))
            .resolves.toEqual({ok: false, reason: "version_conflict"});
        repo.requests[0].closedAt = new Date("2026-09-25T15:00:00.000Z");
        await expect(persistNextPlaybook(repo, {...input(), expectedVersion: 2}))
            .resolves.toEqual({ok: false, reason: "release_not_submitted"});
        expect(repo.playbooks).toHaveLength(0);
        expect(repo.audits).toHaveLength(0);
    });

    it("atomically generates a versioned playbook and audit evidence", async () => {
        const repo = new FakeRepo();
        const result = await persistNextPlaybook(repo, input());

        expect(result).toMatchObject({
            ok: true,
            row: {
                organizationId: "tenant-a",
                deploymentRequestId: "request-01",
                version: 1,
                contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            },
            playbook: { version: 1, tenantId: "tenant-a" },
        });
        if (result.ok) {
            const rollback = result.playbook.steps.find((step) => step.type === "rollback");
            const close = result.playbook.steps.find((step) => step.type === "close_change");
            expect(rollback).toMatchObject({ activation: "on_failure" });
            expect(close).toMatchObject({ activation: "on_success" });
        }
        expect(repo.audits).toEqual([
            expect.objectContaining({
                organizationId: "tenant-a",
                deploymentRequestId: "request-01",
                action: "deployment_playbook.generated",
                newValueJson: expect.objectContaining({requestVersion: 1}),
                source: "desktop",
            }),
        ]);
    });

    it("replays the original playbook after later generations and refuses another actor or version", async () => {
        const repo = new FakeRepo();
        const exact = {...input(), expectedVersion: 1, attemptId: "b04419d2-017b-450c-8084-f7461afc5680"};
        const first = await persistNextPlaybook(repo, exact);
        expect(first).toMatchObject({ok:true, row:{version:1},requestVersion:1});
        await persistNextPlaybook(repo, input());
        repo.requests[0].version = 2;
        await expect(persistNextPlaybook(repo, exact)).resolves.toEqual(first);
        for (const changed of [{actorUserId:"another-user"}, {expectedVersion:2}]) {
            await expect(persistNextPlaybook(repo, {...exact, ...changed}))
                .resolves.toEqual({ok:false, reason:"playbook_attempt_conflict"});
        }
        expect(repo.playbooks).toHaveLength(2);
        expect(repo.audits).toHaveLength(2);
    });

    it("increments the immutable playbook version", async () => {
        const repo = new FakeRepo();

        const first = await persistNextPlaybook(repo, input());
        const second = await persistNextPlaybook(repo, {
            ...input(),
            correlationId: "correlation-02",
            generatedAtUtc: "2026-09-25T15:01:00.000Z",
        });

        expect(first).toMatchObject({ ok: true, row: { version: 1 } });
        expect(second).toMatchObject({ ok: true, row: { version: 2 } });
        expect(repo.playbooks.map((row) => row.version)).toEqual([1, 2]);
        expect(repo.audits).toHaveLength(2);
    });

    it("reopens the latest persisted playbook without generating another version", async () => {
        const repo = new FakeRepo();
        await persistNextPlaybook(repo, input());
        await persistNextPlaybook(repo, {
            ...input(),
            correlationId: "correlation-02",
            generatedAtUtc: "2026-09-25T15:01:00.000Z",
        });

        const result = await readLatestPlaybook(repo, {
            organizationId: "tenant-a",
            deploymentRequestId: "request-01",
        });

        expect(result).toMatchObject({ ok: true, row: { version: 2 }, playbook: { version: 2 } });
        expect(repo.playbooks).toHaveLength(2);
        expect(repo.audits).toHaveLength(2);
    });
});

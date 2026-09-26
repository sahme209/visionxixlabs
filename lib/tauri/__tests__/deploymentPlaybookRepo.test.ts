import { describe, expect, it } from "vitest";
import {
    persistNextPlaybook,
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
        intakeJson: validIntake(),
    }];
    readonly playbooks: PlaybookRow[] = [];
    readonly audits: unknown[] = [];

    tauriDeploymentRequest: PlaybookRepo["tauriDeploymentRequest"];
    tauriPlaybook: PlaybookRepo["tauriPlaybook"];
    tauriAuditEvent: PlaybookRepo["tauriAuditEvent"];

    constructor() {
        this.tauriDeploymentRequest = {
            findFirst: async ({ where }) =>
                this.requests.find((row) =>
                    row.id === where.id && row.organizationId === where.organizationId,
                ) ?? null,
        };
        this.tauriPlaybook = {
            findFirst: async ({ where }) =>
                [...this.playbooks]
                    .filter((row) =>
                        row.deploymentRequestId === where.deploymentRequestId
                        && row.organizationId === where.organizationId,
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
            create: async ({ data }) => {
                this.audits.push(data);
                return data;
            },
        };
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
                source: "desktop",
            }),
        ]);
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
});

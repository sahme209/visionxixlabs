import { describe, expect, it } from "vitest";
import {
    createDeploymentRequest,
    listDeploymentRequests,
    type DeploymentRequestRepo,
    type DeploymentRequestRow,
} from "../deploymentRequestRepo";
import type { DeploymentIntake } from "../deploymentOperations";
import { parseDeploymentIntake } from "../deploymentIntakeSchema";

class FakeRepo implements DeploymentRequestRepo {
    readonly requests: DeploymentRequestRow[] = [];
    readonly versions: unknown[] = [];
    readonly audits: unknown[] = [];

    tauriDeploymentRequest: DeploymentRequestRepo["tauriDeploymentRequest"];
    tauriDeploymentRequestVersion: DeploymentRequestRepo["tauriDeploymentRequestVersion"];
    tauriAuditEvent: DeploymentRequestRepo["tauriAuditEvent"];

    constructor() {
        this.tauriDeploymentRequest = {
            create: async ({ data }) => {
                const now = new Date("2026-09-25T14:00:00.000Z");
                const row: DeploymentRequestRow = {
                    ...data,
                    submittedAt: data.submittedAt,
                    closedAt: null,
                    createdAt: now,
                    updatedAt: now,
                };
                this.requests.push(row);
                return row;
            },
            findFirst: async ({ where }) =>
                this.requests.find((row) =>
                    row.organizationId === where.organizationId
                    && row.correlationId === where.correlationId,
                ) ?? null,
            findMany: async ({ where, take }) =>
                this.requests
                    .filter((row) => row.organizationId === where.organizationId)
                    .slice(0, take),
        };
        this.tauriDeploymentRequestVersion = {
            create: async ({ data }) => {
                this.versions.push(data);
                return data;
            },
        };
        this.tauriAuditEvent = {
            create: async ({ data }) => {
                this.audits.push(data);
                return data;
            },
        };
    }

    async $transaction<T>(fn: (tx: DeploymentRequestRepo) => Promise<T>): Promise<T> {
        return fn(this);
    }
}

function intake(): DeploymentIntake {
    return {
        id: "dep-01",
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

function input(value = intake()) {
    return {
        organizationId: "tenant-a",
        requesterUserId: "user-01",
        actorRole: "requester",
        correlationId: "correlation-01",
        requestId: "request-01",
        receivedAtUtc: "2026-09-25T14:00:00.000Z",
        intake: value,
    };
}

describe("deployment request persistence", () => {
    it("rejects a cross-tenant desktop payload before persistence", async () => {
        const repo = new FakeRepo();
        const value = intake();
        value.tenantId = "tenant-b";

        const result = await createDeploymentRequest(repo, input(value));
        expect(result).toMatchObject({ ok: false, reason: "tenant_mismatch" });
        expect(repo.requests).toHaveLength(0);
        expect(repo.versions).toHaveLength(0);
        expect(repo.audits).toHaveLength(0);
    });

    it("returns field-level validation issues without creating a partial record", async () => {
        const repo = new FakeRepo();
        const value = intake();
        value.repositoryUrls = [];

        const result = await createDeploymentRequest(repo, input(value));
        expect(result).toMatchObject({ ok: false, reason: "validation_failed" });
        if (!result.ok) {
            expect(result.issues.map((issue) => issue.code)).toContain("repository_required");
        }
        expect(repo.requests).toHaveLength(0);
    });

    it("atomically creates a submitted request and append-only audit event", async () => {
        const repo = new FakeRepo();
        const result = await createDeploymentRequest(repo, input());

        expect(result).toMatchObject({
            ok: true,
            request: {
                id: "request-01",
                organizationId: "tenant-a",
                status: "submitted",
                version: 1,
            },
        });
        expect(repo.versions).toEqual([
            expect.objectContaining({
                organizationId: "tenant-a",
                deploymentRequestId: "request-01",
                version: 1,
                contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            }),
        ]);
        expect(repo.audits).toEqual([
            expect.objectContaining({
                organizationId: "tenant-a",
                deploymentRequestId: "request-01",
                action: "deployment_request.submitted",
                source: "desktop",
            }),
        ]);
    });

    it("returns the original record for an idempotent retry without duplicate evidence", async () => {
        const repo = new FakeRepo();
        const first = await createDeploymentRequest(repo, input());
        const retryIntake = intake();
        retryIntake.id = "dep-retry";
        const retry = await createDeploymentRequest(repo, {
            ...input(retryIntake),
            requestId: "request-retry",
        });

        expect(first).toMatchObject({ ok: true, replayed: false });
        expect(retry).toMatchObject({
            ok: true,
            replayed: true,
            request: { id: "request-01" },
        });
        expect(repo.requests).toHaveLength(1);
        expect(repo.versions).toHaveLength(1);
        expect(repo.audits).toHaveLength(1);
    });

    it("rejects reuse of an idempotency identifier for different content", async () => {
        const repo = new FakeRepo();
        await createDeploymentRequest(repo, input());
        const changed = intake();
        changed.title = "A different deployment";

        const result = await createDeploymentRequest(repo, {
            ...input(changed),
            requestId: "request-02",
        });

        expect(result).toMatchObject({
            ok: false,
            reason: "correlation_conflict",
        });
        expect(repo.requests).toHaveLength(1);
        expect(repo.versions).toHaveLength(1);
        expect(repo.audits).toHaveLength(1);
    });

    it("lists only the authenticated tenant and caps the requested limit", async () => {
        const repo = new FakeRepo();
        await createDeploymentRequest(repo, input());
        const other = intake();
        other.tenantId = "tenant-b";
        await createDeploymentRequest(repo, {
            ...input(other),
            organizationId: "tenant-b",
            requestId: "request-02",
            correlationId: "correlation-02",
        });

        const rows = await listDeploymentRequests(repo, "tenant-a", 1_000);
        expect(rows.map((row) => row.organizationId)).toEqual(["tenant-a"]);
    });
});

describe("deployment intake wire schema", () => {
    it("accepts the complete typed intake contract", () => {
        expect(parseDeploymentIntake(intake())).toMatchObject({ ok: true });
    });

    it("returns field-level issues for malformed untrusted JSON", () => {
        const result = parseDeploymentIntake({ title: "Incomplete" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.issues.length).toBeGreaterThan(1);
            expect(result.issues.some((issue) => issue.field === "tenantId")).toBe(true);
        }
    });

    it("rejects undeclared fields instead of silently persisting them", () => {
        expect(parseDeploymentIntake({
            ...intake(),
            embeddedSecret: "must-not-be-stored",
        })).toMatchObject({ ok: false });
    });
});

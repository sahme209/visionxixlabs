import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const mocks = vi.hoisted(() => ({ resolveSession: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { tauriAuditEvent: { findMany: mocks.findMany } } }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveSession }));

const context = { params: Promise.resolve({ id: "release-12" }) };
const receipt = {
    evidenceLink: "change-42",
    newValueJson: { version: 7, status: "closed", closureSummary: "External validation was reported." },
};

function read(query = "expectedVersion=7") {
    return GET(new NextRequest(`https://example.test/api/desktop/deployments/release-12/close?${query}`), context);
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolveSession.mockResolvedValue({ organizationId: "workspace-1" });
    mocks.findMany.mockResolvedValue([receipt]);
});

describe("recorded closure evidence", () => {
    it("returns only the requested closed release's scoped receipt with no caching", async () => {
        const response = await read("expectedVersion=7&organizationId=foreign");
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(await response.json()).toEqual({ ok: true, data: {
            id: "release-12", version: 7, reference: "change-42", summary: "External validation was reported.",
        } });
        expect(mocks.resolveSession).toHaveBeenCalledWith(expect.any(NextRequest), {
            requiredScope: "pipeline:trigger", route: "GET /api/desktop/deployments/:id/close",
            allowApiKey: false, recordHeartbeat: false,
        });
        expect(mocks.findMany).toHaveBeenCalledWith({
            where: {
                organizationId: "workspace-1", deploymentRequestId: "release-12",
                source: "desktop", actorRole: "requester", action: "deployment_request.closed",
                deploymentRequest: { organizationId: "workspace-1", id: "release-12", version: 7,
                    status: "closed", closedAt: { not: null } },
            },
            select: { evidenceLink: true, newValueJson: true },
            take: 2,
        });
    });

    it("requires a paired trigger-scoped session before reading storage", async () => {
        mocks.resolveSession.mockResolvedValue(null);
        expect((await read()).status).toBe(401);
        expect(mocks.findMany).not.toHaveBeenCalled();
    });

    it.each(["", "expectedVersion=0", "expectedVersion=7&expectedVersion=8", "expectedVersion=7.2"])(
        "rejects an invalid exact version selector %s", async query => {
            expect((await read(query)).status).toBe(400);
            expect(mocks.findMany).not.toHaveBeenCalled();
        },
    );

    it.each([
        ["missing", []],
        ["ambiguous", [receipt, receipt]],
        ["different version", [{ ...receipt, newValueJson: { ...receipt.newValueJson, version: 8 } }]],
        ["wrong status", [{ ...receipt, newValueJson: { ...receipt.newValueJson, status: "submitted" } }]],
        ["empty reference", [{ ...receipt, evidenceLink: "  " }]],
        ["invalid summary", [{ ...receipt, newValueJson: { ...receipt.newValueJson, closureSummary: "x".repeat(2001) } }]],
    ])("withholds a %s receipt", async (_label, rows) => {
        mocks.findMany.mockResolvedValue(rows);
        const response = await read();
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ ok: false, error: "closure_evidence_unavailable" });
    });

    it("keeps storage failure details out of the response", async () => {
        mocks.findMany.mockRejectedValue(new Error("private transport details"));
        const response = await read();
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ ok: false, error: "closure_evidence_load_failed" });
    });
});

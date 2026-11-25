import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as ask } from "@/app/api/workforce/[id]/ask/route";
import { POST as runCompliance } from "@/app/api/workforce/compliance_engineer/run-domain/route";
import { runComplianceEngineer } from "../domains/complianceEngineer";
import { AGENT_WORKFORCE_REGISTRY } from "../agentWorkforceRegistry";

const m = vi.hoisted(() => ({
  context: vi.fn(),
  fetcher: vi.fn(),
  findings: vi.fn(),
  persist: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/auth/currentContext", () => ({ requireContext: m.context }));
vi.mock("@/lib/releaseops/instrumentedAiFetcher", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/releaseops/instrumentedAiFetcher")>(),
  makeInstrumentedFetcher: m.fetcher,
}));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    axiomFinding: { findMany: m.findings },
    aiRationaleEnrichment: { upsert: m.persist },
  },
}));

const organizationId = "verified-workspace";
const userId = "verified-member";

function request(path: string) {
  return new Request(`https://example.test/api/workforce/${path}`, {
    method: "POST",
    body: new URLSearchParams({ question: "What signals should I review?", organizationId: "other-workspace", actorUserId: "other-user" }),
  });
}

describe("Workforce funding actor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.context.mockResolvedValue({ organizationId, userId });
    m.findings.mockResolvedValue([]);
    m.fetcher.mockReturnValue(async () => { throw new Error("ai_workspace_budget_exceeded"); });
  });

  it("uses the server-authenticated actor for Q&A and records a budget refusal", async () => {
    const engineer = AGENT_WORKFORCE_REGISTRY.find(entry => entry.productLayer === "client")!;
    const response = await ask(request(`${engineer.id}/ask`), { params: Promise.resolve({ id: engineer.id }) });
    expect(response.status).toBe(303);
    expect(m.fetcher).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ organizationId, actorUserId: userId }));
    expect(m.persist).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ organizationId, outcome: "error", errorMessage: "ai_workspace_budget_exceeded" }),
    }));
  });

  it("carries the verified actor into a manual domain run and leaves scheduled actor state empty", async () => {
    expect((await runCompliance(request("compliance_engineer/run-domain"))).status).toBe(303);
    const scheduled = await runComplianceEngineer(organizationId);
    expect(m.fetcher).toHaveBeenNthCalledWith(1, expect.objectContaining({ organizationId, actorUserId: userId }));
    expect(m.fetcher).toHaveBeenNthCalledWith(2, expect.objectContaining({ organizationId, actorUserId: undefined }));
    expect(scheduled).toMatchObject({ outcome: "error", errorMessage: "ai_workspace_budget_exceeded" });
  });

  it("does not start a domain run when the request has no authenticated context", async () => {
    m.context.mockRejectedValue(new Error("Authentication required."));
    await expect(runCompliance(request("compliance_engineer/run-domain"))).rejects.toThrow("Authentication required.");
    expect(m.findings).not.toHaveBeenCalled();
    expect(m.fetcher).not.toHaveBeenCalled();
  });
});

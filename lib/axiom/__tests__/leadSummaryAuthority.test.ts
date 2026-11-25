import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lead: vi.fn(), update: vi.fn(), logs: vi.fn(), snapshots: vi.fn(),
  generate: vi.fn(), generateBrief: vi.fn(), verifyToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {
  lead: { findUnique: mocks.lead, update: mocks.update },
  executionLog: { findMany: mocks.logs },
  axiomScoreSnapshot: { findMany: mocks.snapshots },
} }));
vi.mock("@/lib/starterToken", () => ({ verifyStarterToken: mocks.verifyToken }));
vi.mock("@/lib/ai/orchestrator", () => ({ generate: mocks.generate, orchestrateGenerate: mocks.generateBrief }));

import { GET as strategicBrief } from "@/app/api/cloud-operator/strategic-brief/route";
import { GET as cloudOperatorStatus } from "@/app/api/cloud-operator/status/route";
import { updateEnvironmentAfterDiscovery, updateEnvironmentAfterIamScan } from "@/lib/cloudOperator/updateEnvironmentAfterDiscovery";

describe("Cloud Operator lead summaries under public prepaid billing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
    mocks.lead.mockResolvedValue({ id: "lead-a", source: "cloud-operator", userId: "shared-owner", fullPayload: { tier: "enterprise", retained: true } });
    mocks.verifyToken.mockReturnValue({ leadId: "lead-a" });
    mocks.snapshots.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("saves discovery evidence even when no same-project IAM result exists", async () => {
    mocks.logs.mockImplementation(async ({ where }) => where.leadId
      ? [] : [{ result: { findings: [{ type: "foreign-finding" }] } }]);
    await updateEnvironmentAfterDiscovery("lead-a", { ec2Count: 2, vpcCount: 1, region: "us-east-1" });
    expect(mocks.logs).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      where: { leadId: "lead-a", pluginId: "aws:iam-exposure-scan", status: "success" },
    }));
    const args = mocks.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: "lead-a" });
    expect(args.data.fullPayload).toMatchObject({ retained: true, environmentEvidenceLeadId: "lead-a", architectureGraph: { region: "us-east-1" } });
    expect(args.data.fullPayload.environmentSummary).toContain("2 EC2 instances");
    expect(args.data.fullPayload.environmentSummary).toContain("S3 buckets count unavailable");
    expect(args.data.fullPayload.environmentSummary).toContain("No IAM scan results are available.");
    expect(args.data.fullPayload.environmentSummary).not.toContain("foreign-finding");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("uses only the selected lead's last discovery and IAM scan", async () => {
    mocks.logs.mockImplementation(async ({ where }) => where.pluginId === "aws:infra-discovery"
      ? [{ result: { ec2Count: 1, region: "eu-west-1" } }]
      : [{ result: { findings: [{ type: "local-finding", severity: "high" }, null] } }]);
    await updateEnvironmentAfterIamScan({ leadId: "lead-a", userId: "shared-owner" });
    expect(mocks.logs.mock.calls.map(([args]) => args.where.leadId)).toEqual(["lead-a", "lead-a"]);
    expect(mocks.update.mock.calls[0][0].data.fullPayload.environmentSummary).toContain("local-finding (high)");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("serves an enterprise brief with truthful missing-data wording and preserves its cache", async () => {
    const req = new NextRequest("http://localhost/api/cloud-operator/strategic-brief?token=fixture");
    const result = await strategicBrief(req);
    expect(result.status).toBe(200);
    const brief = await result.json();
    expect(brief.executiveSummary).toBe("Infrastructure readiness has yet to be measured. No risk level was recorded.");
    expect(brief.financialRiskNarrative).toBe("No annual savings estimate was recorded.");
    expect(brief.boardSlideOutline).toHaveLength(3);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: "lead-a" },
      data: { fullPayload: { tier: "enterprise", retained: true, axiomResult: { strategicBrief: brief } } },
    });
    expect(mocks.generateBrief).not.toHaveBeenCalled();

    mocks.lead.mockResolvedValueOnce({ id: "lead-a", source: "cloud-operator", fullPayload: { axiomResult: { strategicBrief: brief } } });
    expect(await (await strategicBrief(req)).json()).toEqual(brief);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("withholds old unbound environment reports and returns reports tied to the selected lead", async () => {
    const request = new NextRequest("http://localhost/api/cloud-operator/status?token=fixture");
    const legacy = { environmentSummary: "Previously cached unscoped summary", architectureGraph: { nodes: [], edges: [] } };
    const lead = { id: "lead-a", source: "cloud-operator", userId: "shared-owner", status: "ready", updatedAt: new Date() };
    mocks.lead.mockResolvedValueOnce({ ...lead, fullPayload: legacy });
    const hidden = await cloudOperatorStatus(request);
    expect(hidden.status).toBe(200);
    expect(await hidden.json()).not.toHaveProperty("environmentSummary");
    mocks.lead.mockResolvedValueOnce({ ...lead, fullPayload: { ...legacy, environmentEvidenceLeadId: "lead-a" } });
    expect(await (await cloudOperatorStatus(request)).json()).toMatchObject(legacy);
  });

  it("preserves the existing legacy provider route when public prepaid billing is off", async () => {
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "");
    mocks.logs.mockResolvedValue([]);
    mocks.generate.mockResolvedValue({ text: "Legacy provider summary" });
    await updateEnvironmentAfterDiscovery("lead-a", { ec2Count: 3 });
    expect(mocks.generate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ userId: "shared-owner" }));
    expect(mocks.update.mock.calls[0][0].data.fullPayload.environmentSummary).toBe("Legacy provider summary");
  });
});

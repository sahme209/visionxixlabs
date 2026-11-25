import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as operator } from "@/app/api/cloud-operator/trigger/route";
import { POST as studio } from "@/app/api/cloud-studio/trigger/route";

const io = vi.hoisted(() => ({
  lead: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  snapshots: { findFirst: vi.fn(), create: vi.fn() },
  audit: { create: vi.fn() },
  generateOperator: vi.fn(),
  generateStudio: vi.fn(),
  events: { eventEngineTriggered: vi.fn(), eventEngineCompleted: vi.fn(), eventEngineFailed: vi.fn(), eventDriftDetected: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: { lead: io.lead, axiomScoreSnapshot: io.snapshots, auditLog: io.audit } }));
vi.mock("@/lib/cloudOperator/generate", () => ({ generateOperatorEngineOutput: io.generateOperator }));
vi.mock("@/lib/cloudStudio/generate", () => ({ generateCloudStudioOutput: io.generateStudio }));
vi.mock("@/lib/starterToken", () => ({ verifyStarterToken: () => ({ leadId: "lead-fixture" }) }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: () => true }));
vi.mock("@/lib/rateLimitTiered", () => ({ checkTieredRateLimit: () => true }));
vi.mock("@/lib/observability/events", () => io.events);

beforeEach(() => vi.resetAllMocks());

function leadFixture(source: string, fullPayload: Record<string, unknown>, status = "created") {
  let row = { id: "lead-fixture", source, status, fullPayload, updatedAt: new Date(0) };
  io.lead.findUnique.mockImplementation(async () => row);
  io.lead.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.status !== row.status ||
        (where.updatedAt && where.updatedAt !== row.updatedAt) ||
        JSON.stringify(where.fullPayload.equals) !== JSON.stringify(row.fullPayload)) return { count: 0 };
    row = { ...row, ...data, updatedAt: new Date(row.updatedAt.getTime() + 1) };
    return { count: 1 };
  });
  io.lead.update.mockImplementation(async ({ where, data }) => {
    expect(where.fullPayload.equals).toEqual(row.fullPayload);
    row = { ...row, ...data, updatedAt: new Date(row.updatedAt.getTime() + 1) };
    return row;
  });
  return () => row;
}

function request(source: string) {
  return new NextRequest(`https://example.test/api/${source}/trigger?token=signed-fixture`, { method: "POST" });
}

describe("lead report replay", () => {
  it("returns the stored Operator report with no enrichment or additional writes", async () => {
    const stored = {
      outputStatus: "ready",
      operatorOutput: { scores: { existing: 91 } },
      axiomResult: { scores: { infrastructureScore: 82 }, policyPack: { version: "stored" } },
    };
    const current = leadFixture("cloud-operator", stored, "package_ready");

    const response = await operator(request("cloud-operator"));

    expect(await response.json()).toMatchObject({ status: "ready", axiomResult: stored.axiomResult, axiomScores: stored.axiomResult.scores });
    expect(current().fullPayload).toBe(stored);
    expect(io.lead.updateMany).not.toHaveBeenCalled();
    expect(io.lead.update).not.toHaveBeenCalled();
    expect(io.generateOperator).not.toHaveBeenCalled();
    expect(io.snapshots.findFirst).not.toHaveBeenCalled();
    expect(io.snapshots.create).not.toHaveBeenCalled();
    expect(io.audit.create).not.toHaveBeenCalled();
    expect(io.events.eventEngineCompleted).not.toHaveBeenCalled();
  });

  it("publishes the full Operator report before caching and records history once", async () => {
    const current = leadFixture("cloud-operator", {
      operatorProfile: { hostingProvider: "AWS", monthlySpend: "1000" },
      tags: ["existing-tag"],
      axiomResult: { policyPack: { obsolete: true } },
    });
    io.generateOperator.mockResolvedValue({ scores: {}, launch: {}, secure: {} });
    io.snapshots.findFirst.mockResolvedValue({ raw: { operatorProfile: { hostingProvider: "Azure", monthlySpend: "1000" } } });

    const first = await operator(request("cloud-operator"));
    expect(first.status).toBe(200);
    const report = await first.json();
    expect(report.axiomResult).toMatchObject({
      driftSignals: { hasDrift: true },
      quality: { pass: expect.any(Boolean) },
      scores: { enterpriseReadinessIndex: expect.any(Number) },
    });
    expect(report.axiomResult).not.toHaveProperty("policyPack");
    expect(current().fullPayload.tags).toContain("existing-tag");
    expect(await (await operator(request("cloud-operator"))).json()).toEqual(report);
    expect(io.generateOperator).toHaveBeenCalledOnce();
    expect(io.lead.update).toHaveBeenCalledOnce();
    expect(io.snapshots.findFirst).toHaveBeenCalledOnce();
    expect(io.snapshots.create).toHaveBeenCalledOnce();
    expect(io.audit.create.mock.calls.map(([{ data }]) => data.action)).toEqual(["roadmap_generated", "drift_detected"]);
    expect(io.events.eventEngineTriggered).toHaveBeenCalledOnce();
    expect(io.events.eventEngineCompleted).toHaveBeenCalledOnce();
  });

  it("generates and snapshots a Studio report once across repeat requests", async () => {
    leadFixture("cloud-studio", { serviceType: "architecture", form: { cloudProvider: "AWS" } });
    io.generateStudio.mockResolvedValue({ summary: "recorded report" });

    const first = await studio(request("cloud-studio"));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ success: true, status: "ready", output: { summary: "recorded report" } });

    const second = await studio(request("cloud-studio"));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ success: true, status: "ready", output: { summary: "recorded report" } });
    expect(io.lead.update).toHaveBeenCalledOnce();
    expect(io.generateStudio).toHaveBeenCalledOnce();
    expect(io.snapshots.create).toHaveBeenCalledOnce();
    expect(io.events.eventEngineTriggered).toHaveBeenCalledOnce();
    expect(io.events.eventEngineCompleted).toHaveBeenCalledOnce();
  });
});

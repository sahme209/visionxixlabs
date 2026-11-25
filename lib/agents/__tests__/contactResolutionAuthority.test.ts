import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(), generate: vi.fn(), tools: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: mocks.read } } }));
vi.mock("@/lib/ai/orchestrator", () => ({ generate: mocks.generate }));
vi.mock("@/lib/security/auditLog", () => ({ logAudit: mocks.audit }));
vi.mock("../contactResolutionTools", () => ({
  createLeadTicket: mocks.tools, askFollowupQuestions: mocks.tools, runAxiomScan: mocks.tools,
  runExecutionPlugin: mocks.tools, generateReportAndSend: mocks.tools, scheduleOrEscalate: mocks.tools,
  sendResolutionEmail: mocks.tools, findCloudOperatorLeadByEmail: mocks.tools,
}));

import { runContactResolutionAgent } from "../contactResolutionAgent";

const input = {
  leadId: "fixture-contact", name: "Fixture", email: "fixture@example.invalid", topic: "press", message: "Private contact message",
};

describe("contact job funding authority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
    mocks.read.mockResolvedValue({ source: "contact", fullPayload: { topic: "security" } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("classifies for human review from the stored topic without model or tool calls", async () => {
    expect(await runContactResolutionAgent(input)).toEqual({
      status: "ESCALATED", actionsTaken: ["Flagged for human review: Security."],
    });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.tools).not.toHaveBeenCalled();
  });

  it("does not copy arbitrary contact text into the review action", async () => {
    mocks.read.mockResolvedValueOnce({ source: "contact", fullPayload: { topic: input.message } });
    expect(await runContactResolutionAgent(input)).toEqual({
      status: "ESCALATED", actionsTaken: ["Flagged for human review: General inquiry."],
    });
  });

  it("leaves the legacy path available for an actual contact when public billing is off", async () => {
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "");
    mocks.generate.mockResolvedValueOnce({ text: '{"status":"ESCALATED","actionsTaken":[]}' });
    expect(await runContactResolutionAgent(input)).toMatchObject({ status: "ESCALATED" });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.tools).not.toHaveBeenCalled();
  });
});

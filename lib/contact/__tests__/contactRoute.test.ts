import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  createJob: vi.fn(),
  transaction: vi.fn(),
  rateLimit: vi.fn(() => true),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock("@/lib/security/secretRedaction", () => ({ redactSecrets: (value: string) => value.replace("secret", "[REDACTED]") }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5" },
    body: JSON.stringify(body),
  });
}

describe("contact route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    mocks.rateLimit.mockReturnValue(true);
    mocks.createLead.mockResolvedValue({ id: "lead_verified_123" });
    mocks.createJob.mockResolvedValue({ id: "job_123" });
    mocks.transaction.mockImplementation(async (record) => record({
      lead: { create: mocks.createLead },
      agentJob: { create: mocks.createJob },
    }));
  });

  it("rejects an invalid email before persistence", async () => {
    const { POST } = await import("../../../app/api/contact/route");
    const response = await POST(request({ name: "Operator", email: "invalid", message: "Help" }));
    expect(response.status).toBe(400);
    expect(mocks.createLead).not.toHaveBeenCalled();
  });

  it("reports durable acceptance separately from unconfigured email delivery", async () => {
    const { POST } = await import("../../../app/api/contact/route");
    const response = await POST(request({ name: "Operator", email: "operator@example.test", message: "A secret appeared" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, accepted: true, referenceId: "lead_verified_123", delivery: "not_configured" });
    expect(mocks.createLead).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.createJob).toHaveBeenCalledWith({ data: {
      leadId: "lead_verified_123", type: "CONTACT_RESOLUTION", status: "pending", runAt: expect.any(Date),
    } });
  });

  it("does not issue a receipt or notify anyone when the follow-up write fails", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const notify = vi.fn();
    vi.stubGlobal("fetch", notify);
    mocks.createJob.mockRejectedValueOnce(new Error("Synthetic write failure"));
    const { POST } = await import("../../../app/api/contact/route");
    const response = await POST(request({ name: "Operator", email: "operator@example.test", message: "Installer help" }));
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty("referenceId");
    expect(mocks.createLead).toHaveBeenCalledOnce();
    expect(mocks.createJob).toHaveBeenCalledOnce();
    expect(notify).not.toHaveBeenCalled();
  });

  it("does not claim email delivery when the provider rejects the request", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rejected", { status: 422 })));
    const { POST } = await import("../../../app/api/contact/route");
    const response = await POST(request({ name: "Operator", email: "operator@example.test", message: "Installer help" }));
    expect((await response.json()).delivery).toBe("failed");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("neutralizes honeypot submissions without writing a lead", async () => {
    const { POST } = await import("../../../app/api/contact/route");
    const response = await POST(request({ name: "Bot", email: "bot@example.test", message: "spam", website: "https://spam.test" }));
    expect(await response.json()).toEqual({ success: true, accepted: false });
    expect(mocks.createLead).not.toHaveBeenCalled();
  });
});

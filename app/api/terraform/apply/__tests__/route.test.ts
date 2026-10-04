/**
 * P0 containment, route layer: when the legacy terraform-apply kill-switch
 * is off (the default), this route must fail closed in a way nothing can
 * mistake for a successful apply —
 *   - HTTP 403, not 200;
 *   - a machine-readable `code: "legacy_apply_disabled"`;
 *   - terraformApply() itself is never invoked (verified by asserting the
 *     mocked import was never called, not just that its side effects
 *     didn't happen);
 *   - no job-state mutation (prisma.terraformExecutionJob.update is never
 *     called — the plan/approval the lead already has stays untouched);
 *   - the refusal is audited with a correlation ID;
 *   - the same correlation ID appears in the HTTP response body, so a
 *     support request can be tied back to the exact audit row.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyStarterToken: vi.fn(),
  checkRateLimit: vi.fn(() => true),
  findJob: vi.fn(),
  updateJob: vi.fn(),
  terraformApply: vi.fn(),
  legacyApplyEnabled: vi.fn(() => false),
  logAudit: vi.fn(async () => {}),
}));

vi.mock("@/lib/starterToken", () => ({ verifyStarterToken: mocks.verifyStarterToken }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/db", () => ({
  prisma: { terraformExecutionJob: { findUnique: mocks.findJob, update: mocks.updateJob } },
}));
vi.mock("@/lib/terraform/runner", () => ({
  terraformApply: mocks.terraformApply,
  legacyApplyEnabled: mocks.legacyApplyEnabled,
}));
vi.mock("@/lib/security/auditLog", () => ({ logAudit: mocks.logAudit }));

function request(jobId: string, token = "valid-token") {
  return new NextRequest(`https://visionxixlabs.com/api/terraform/apply?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

const approvedJob = {
  id: "job-1",
  leadId: "lead-1",
  workingDirectory: "/tmp/job-1",
  approvedAt: new Date(),
  approvedBy: "lead-1",
  status: "awaiting_approval",
};

describe("POST /api/terraform/apply — kill-switch containment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyStarterToken.mockReturnValue({ leadId: "lead-1" });
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.legacyApplyEnabled.mockReturnValue(false);
    mocks.findJob.mockResolvedValue({ ...approvedJob });
  });

  it("returns 403 with a machine-readable code, never 200, when the flag is off", async () => {
    const { POST } = await import("../route");
    const res = await POST(request("job-1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(200);
    expect(body.success).toBe(false);
    expect(body.code).toBe("legacy_apply_disabled");
    expect(body.correlationId).toBeTruthy();
  });

  it("never invokes terraformApply() when blocked", async () => {
    const { POST } = await import("../route");
    await POST(request("job-1"));

    expect(mocks.terraformApply).not.toHaveBeenCalled();
  });

  it("never mutates job state when blocked — no status transition, nothing to roll back", async () => {
    const { POST } = await import("../route");
    await POST(request("job-1"));

    expect(mocks.updateJob).not.toHaveBeenCalled();
  });

  it("audits the refusal with a correlation ID matching the response body", async () => {
    const { POST } = await import("../route");
    const res = await POST(request("job-1"));
    const body = await res.json();

    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        action: "terraform.apply_blocked_kill_switch",
        metadata: expect.objectContaining({
          jobId: "job-1",
          reasonCode: "legacy_apply_disabled",
          correlationId: body.correlationId,
        }),
      }),
    );
  });

  it("falls through to a real apply attempt once the flag is explicitly enabled", async () => {
    mocks.legacyApplyEnabled.mockReturnValue(true);
    mocks.terraformApply.mockResolvedValue({ success: true, output: "Apply complete." });

    const { POST } = await import("../route");
    const res = await POST(request("job-1"));
    const body = await res.json();

    expect(mocks.terraformApply).toHaveBeenCalledWith("job-1");
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

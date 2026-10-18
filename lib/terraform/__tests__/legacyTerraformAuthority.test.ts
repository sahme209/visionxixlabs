import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// A subprocess call is recorded and refused before any executable/provider IO.
const m = vi.hoisted(() => ({
  verify: vi.fn(), rate: vi.fn(), findJob: vi.fn(), updateJob: vi.fn(), audit: vi.fn(),
  exec: vi.fn((_command: string, _options: unknown, callback: (error: Error) => void) => callback(new Error("owned_no_send_sentinel"))),
}));
vi.mock("@/lib/db", () => ({ prisma: { terraformExecutionJob: { findUnique: m.findJob, update: m.updateJob } } }));
vi.mock("@/lib/starterToken", () => ({ verifyStarterToken: m.verify }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: m.rate }));
vi.mock("@/lib/security/auditLog", () => ({ logAudit: m.audit }));
vi.mock("child_process", () => ({ exec: m.exec }));

import { POST as approve } from "@/app/api/terraform/approve/route";
import { POST as plan } from "@/app/api/terraform/plan/route";
import { GET as readJob } from "@/app/api/terraform/jobs/[id]/route";
import { terraformInit, terraformValidate, terraformPlan } from "../runner";

const job = {
  id: "legacy-job", leadId: "owned-lead", workingDirectory: "/not-an-executable-fixture",
  status: "planned", approvedAt: null, approvedBy: null, mode: "active_passive",
  primaryCloud: "aws", secondaryCloud: "azure", planOutput: "Plan: 1 to add, 0 to change, 0 to destroy.",
  planSummary: { add: 1, change: 0, destroy: 0 }, applyOutput: null, errorMessage: null,
  createdAt: new Date("2026-10-18T00:00:00Z"), updatedAt: new Date("2026-10-18T00:00:00Z"),
};
function request(path: string, body: unknown, token: string | null = "owned-token") {
  return new NextRequest(`https://axiom.example.test/api/terraform/${path}${token === null ? "" : `?token=${token}`}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks(); m.verify.mockReturnValue({ leadId: job.leadId }); m.rate.mockReturnValue(true);
  m.findJob.mockResolvedValue({ ...job }); m.updateJob.mockResolvedValue({ ...job }); m.audit.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("actual legacy Terraform route authority", () => {
  it("refuses a correct confirmation without recording a false apply approval", async () => {
    const response = await approve(request("approve", { jobId: job.id, confirmation: "CONFIRM APPLY" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ success: false, status: "blocked", code: "legacy_terraform_authority_unavailable", approval: "unavailable", executionEnabled: false });
    expect(m.updateJob).not.toHaveBeenCalled();
    expect(m.audit.mock.calls.some(([event]) => event.action === "terraform.apply_approved")).toBe(false);
    expect(m.exec).not.toHaveBeenCalled();
  });
  it("keeps refusal bounded if its best-effort audit fails", async () => {
    m.audit.mockRejectedValue(new Error("synthetic audit outage"));
    const response = await approve(request("approve", { jobId: job.id, confirmation: "CONFIRM APPLY" }));
    expect(response.status).toBe(403); expect(m.updateJob).not.toHaveBeenCalled();
  });
  it("refuses planning before CLI detection and job state changes", async () => {
    const response = await plan(request("plan", { jobId: job.id }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ success: false, code: "legacy_terraform_authority_unavailable", executionEnabled: false });
    expect(m.exec).not.toHaveBeenCalled(); expect(m.updateJob).not.toHaveBeenCalled();
  });
  it.each([plan, approve])("retains missing-token and invalid-token isolation", async handler => {
    const body = { jobId: job.id, confirmation: "CONFIRM APPLY" };
    expect((await handler(request("unused", body, null))).status).toBe(400);
    m.verify.mockReturnValue({ error: "invalid" });
    expect((await handler(request("unused", body))).status).toBe(401);
    expect(m.findJob).not.toHaveBeenCalled(); expect(m.exec).not.toHaveBeenCalled(); expect(m.updateJob).not.toHaveBeenCalled();
  });
  it.each([plan, approve])("retains foreign-job refusal before any side effect", async handler => {
    m.findJob.mockResolvedValue({ ...job, leadId: "different-lead" });
    expect((await handler(request("unused", { jobId: job.id, confirmation: "CONFIRM APPLY" }))).status).toBe(404);
    expect(m.updateJob).not.toHaveBeenCalled(); expect(m.exec).not.toHaveBeenCalled();
  });
  it("retains plan rate limits and malformed-input refusal", async () => {
    m.rate.mockReturnValue(false); expect((await plan(request("plan", { jobId: job.id }))).status).toBe(429);
    m.rate.mockReturnValue(true); expect((await plan(request("plan", {}))).status).toBe(400);
    expect((await approve(request("approve", { jobId: job.id, confirmation: "wrong" }))).status).toBe(400);
    expect(m.findJob).not.toHaveBeenCalled(); expect(m.exec).not.toHaveBeenCalled(); expect(m.updateJob).not.toHaveBeenCalled();
  });
  it("labels an actual historical job read without turning its old approval into capability", async () => {
    const approvedAt = new Date("2026-10-17T00:00:00Z");
    m.findJob.mockResolvedValue({ ...job, status: "awaiting_approval", approvedAt, approvedBy: job.leadId });
    const response = await readJob(new NextRequest("https://axiom.example.test/api/terraform/jobs/legacy-job?token=owned-token"), { params: Promise.resolve({ id: job.id }) });
    expect(response.status).toBe(200);
    expect((await response.json()).job).toMatchObject({ status: "awaiting_approval", approvedAt: approvedAt.toISOString(), evidenceKind: "legacy_text_only", approval: "unavailable", executionEnabled: false });
    expect(m.updateJob).not.toHaveBeenCalled(); expect(m.exec).not.toHaveBeenCalled();
  });
});

describe.each(["false", "true"])("actual runner no-send fence with apply flag %s", flag => {
  it.each([{ name: "init", run: terraformInit }, { name: "validate", run: terraformValidate }, { name: "plan", run: terraformPlan }])("refuses $name before CLI detection or database writes", async ({ run }) => {
    vi.stubEnv("TERRAFORM_LEGACY_APPLY_ENABLED", flag);
    expect(await run(job.id)).toMatchObject({ success: false, blockedByAuthority: true });
    expect(m.exec).not.toHaveBeenCalled(); expect(m.findJob).not.toHaveBeenCalled(); expect(m.updateJob).not.toHaveBeenCalled();
  });
});

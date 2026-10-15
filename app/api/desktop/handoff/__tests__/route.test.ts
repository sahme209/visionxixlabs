import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AxiomError } from "@/lib/errors/axiomErrors";

const mocks = vi.hoisted(() => ({ context: vi.fn(), env: vi.fn(), mode: vi.fn(), sign: vi.fn(), findItem: vi.fn(), pipeline: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ requireContext: mocks.context, currentContext: mocks.context }));
vi.mock("@/lib/config/env", () => ({ loadAppEnv: mocks.env }));
vi.mock("@/lib/config/providerModes", () => ({ getDesktopAvailability: mocks.mode }));
vi.mock("@/lib/desktop/handoffSigner", () => ({ signHandoff: mocks.sign, newHandoffNonce: () => "fixture-nonce-12345678", ACTIVE_SIGNING_KEY_ID: "fixture" }));
vi.mock("@/lib/db", () => ({ prisma: { axiomApprovalItem: { findUnique: mocks.findItem } } }));
vi.mock("@/lib/remediation/remediationPipeline", () => ({ runRemediationPipeline: mocks.pipeline }));
import { GET as downloadPlan } from "@/app/api/approvals/[id]/plan/route";
import { POST as previewHandoff } from "@/app/api/remediation/desktop-handoff/route";
import { GET, POST } from "../route";

const request = (body: unknown) => new NextRequest("https://fixture.invalid/api/desktop/handoff", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({ isAuthenticated: true, organizationId: "org-fixture", userId: "user-fixture" });
  mocks.env.mockReturnValue({ desktopHandoffSigningKeySet: true });
  mocks.mode.mockReturnValue("live");
  mocks.sign.mockReturnValue({ signature: "not-real" });
});

describe("signed desktop handoff issuance containment", () => {
  it.each(["review_only", "preview_local", "verify_only", "execute_local"])("cannot turn caller claims into signed %s authority", async (allowedOperation) => {
    const response = await POST(request({ allowedOperation, executionPlanId: "forged-plan", approvalId: "forged-approval", policyDecisionId: "forged-policy", planChecksum: "a".repeat(64), artifacts: [{ id: "forged-artifact", path: "plan.tf", bytes: 10, sha256: "b".repeat(64) }], requiredCapabilities: ["apply"] }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "handoff.authoritative_artifact_unavailable" } });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("does not substitute an identifier hash when artifact evidence is absent", async () => {
    const response = await POST(request({ executionPlanId: "plan", policyDecisionId: "policy", allowedOperation: "review_only" }));
    expect(response.status).toBe(422);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("retains authentication refusal before processing issuance", async () => {
    mocks.context.mockRejectedValue(new AxiomError({ code: "auth.required", category: "authentication", userMessage: "Sign in required." }));
    expect((await POST(request({}))).status).toBe(401);
    expect(mocks.mode).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("retains the disabled desktop policy", async () => {
    mocks.mode.mockReturnValue("disabled");
    const response = await POST(request({}));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "desktop.disabled" } });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("retains missing signing configuration refusal", async () => {
    mocks.env.mockReturnValue({});
    expect((await POST(request({}))).status).toBe(500);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("keeps GET unavailable", async () => { expect((await GET()).status).toBe(405); });
});


describe("existing read-only handoff alternatives", () => {
  it("preserves approved tenant HCL downloads without signing caller content", async () => {
    mocks.findItem.mockResolvedValue({ id: "item-1", organizationId: "org-fixture", status: "approved", title: "Restrict bucket", actionType: "apply_storage_policy", provider: "aws", region: "us-east-1", resourceIds: ["fixture-bucket"], currentState: "public", recommendedState: "private", riskLevel: "low", dispositionReason: "Reduce public exposure" });
    const response = await downloadPlan(new NextRequest("https://fixture.invalid/api/approvals/item-1/plan"), { params: Promise.resolve({ id: "item-1" }) });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('resource "aws_s3_bucket_public_access_block"');
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("keeps approved downloads tenant scoped", async () => {
    mocks.findItem.mockResolvedValue({ organizationId: "other-org", status: "approved" });
    expect((await downloadPlan(new NextRequest("https://fixture.invalid"), { params: Promise.resolve({ id: "other-item" }) })).status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("preserves explicitly unsigned remediation previews", async () => {
    mocks.pipeline.mockResolvedValue({ bundles: [{ candidate: { id: "candidate", title: "Fixture", desktopReviewEligibility: "eligible", resourceIds: [], provider: "aws", riskLevel: "low" }, terraform: { fileName: "preview.tf", hcl: "# generated preview" }, cli: { command: "echo preview" } }] });
    const response = await previewHandoff(request({ candidateId: "candidate" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, data: { preview: { allowedOperation: "review_only" } } });
    expect(body.data.preview.notes).toContain("Preview only — Axiom does not sign or transmit this handoff from this endpoint.");
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});

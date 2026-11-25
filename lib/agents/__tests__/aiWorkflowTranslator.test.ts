import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  admit: vi.fn(),
  generate: vi.fn(),
  context: vi.fn(),
  status: vi.fn(),
  policy: vi.fn(),
}));

vi.mock("@/lib/ai/AIProviderManager", () => ({
  getAIProviderManager: () => ({ status: mocks.status, generateTextWithAdmission: mocks.generate }),
}));
vi.mock("@/lib/billing/governedExtractAdmission", () => ({ admitAIText: mocks.admit }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.context }));
vi.mock("@/lib/ai/workspaceProviderPolicy", () => ({
  loadWorkspaceAIProviderPolicyWithState: async () => ({ policy: null, storageState: "ready" }),
  resolveWorkspaceAIProviderPolicy: mocks.policy,
}));

import { POST } from "@/app/api/workflows/translate/route";
import { translateWorkflowIntent } from "../aiWorkflowTranslator";

const workspace = { organizationId: "org-1", userId: "user-1" };
const model = "anthropic/claude-sonnet-4.6";
const actor = { ...workspace, correlationId: "fixture", idempotencyKey: "fixture-request-key" };
const intent = "Stage a runbook after a manual review.";
const draft = {
  name: "Stage a runbook",
  description: "Prepare a runbook for review.",
  trigger: { kind: "manual", selector: "manual" },
  actions: [{ kind: "stage_runbook", label: "Review runbook" }],
};

function request(origin = "https://fixture.invalid", key = "fixture-request-key") {
  return new NextRequest("https://fixture.invalid/api/workflows/translate", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({ intent, organizationId: "wrong-org", userId: "wrong-actor" }),
  });
}

describe("funded Workflow translator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.status.mockReturnValue([{ provider: "vercel_gateway", configured: true, defaultModel: model }]);
    mocks.policy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: {} });
    mocks.context.mockResolvedValue({ isAuthenticated: true, ...workspace });
    mocks.admit.mockResolvedValue({ ok: true, admission: { fixture: true } });
    mocks.generate.mockResolvedValue({ text: JSON.stringify(draft), provider: "vercel_gateway", model, latencyMs: 15 });
  });

  it.each(["", "   "])("rejects an empty intent without reservation", async input => {
    expect(await translateWorkflowIntent(input, actor)).toMatchObject({ draft: null, rejectionReason: "empty_intent" });
    expect(mocks.admit).not.toHaveBeenCalled();
  });

  it("declines a workspace without an allowed provider", async () => {
    mocks.policy.mockReturnValue({ enabled: true, allowedProviders: [], modelSelections: {} });
    expect(await translateWorkflowIntent(intent, actor)).toMatchObject({ draft: null, aiUsed: false });
    expect(mocks.admit).not.toHaveBeenCalled();
  });

  it("funds one draft under the signed-in workspace and actor", async () => {
    const response = await POST(request());
    const result = await response.json();
    expect(result.data).toMatchObject({ draft, aiUsed: true });
    expect(result.meta.safetyContract).toBe("approval_only_no_execution");
    expect(mocks.admit).toHaveBeenCalledWith(
      expect.objectContaining({ ...workspace, source: "workflow_translator", idempotencyKey: expect.stringMatching(/^workflow_translator_[a-f0-9]{64}$/), textPolicy: { provider: "vercel_gateway", model, defaultModel: model } }),
      expect.objectContaining({ prompt: intent }),
    );
    expect(mocks.generate).toHaveBeenCalledExactlyOnceWith(intent, expect.objectContaining({ organizationId: workspace.organizationId, only: "vercel_gateway", model }), { fixture: true });
  });

  it.each(["ai_workspace_budget_exceeded", "ai_credit_pool_exhausted", "request_already_reserved"])(
    "makes no provider call on %s", async error => {
      mocks.admit.mockResolvedValue({ ok: false, error });
      const { data } = await (await POST(request())).json();
      expect(data).toMatchObject({ draft: null, rejectionReason: error });
      expect(mocks.generate).not.toHaveBeenCalled();
    },
  );

  it("rejects cross-origin calls, missing keys and missing actors", async () => {
    expect((await POST(request("https://foreign.invalid"))).status).toBe(403);
    expect((await POST(request(undefined, ""))).status).toBeGreaterThanOrEqual(400);
    mocks.context.mockResolvedValue({ isAuthenticated: true, organizationId: workspace.organizationId });
    expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
    expect(mocks.admit).not.toHaveBeenCalled();
  });

  it("withholds invalid JSON and actions outside the draft allowlist", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "not JSON" }).mockResolvedValueOnce({
      text: JSON.stringify({ ...draft, actions: [{ kind: "apply_change", label: "Apply" }] }),
    });
    expect(await translateWorkflowIntent(intent, actor)).toMatchObject({ draft: null, rejectionReason: "model_returned_invalid_json" });
    expect(await translateWorkflowIntent(intent, actor)).toMatchObject({ draft: null, rejectionReason: "model_returned_invalid_action_kind" });
  });
});

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const m = vi.hoisted(() => ({ context: vi.fn(), transaction: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.context }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("@/lib/billing/workspaceAIUsageBudgetSettings", () => ({
  readWorkspaceBudgetSettings: m.read, saveWorkspaceBudgetSettings: m.save,
}));

const origin = "https://workspace.example.test";
const body = { organizationId: "workspace_1", expectedRevision: null, budget: { monthlyLimitCents: 500, warningThresholdCents: 350 } };
const result = { organizationId: "workspace_1", revision: "2026-11-24T01:00:00.000Z", budget: body.budget };
function put(payload: unknown, requestOrigin = origin) {
  return PUT(new NextRequest(`${origin}/api/billing/workspace-ai-budget`, {
    method: "PUT", headers: { origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify(payload),
  }));
}

describe("workspace AI budget settings API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("AXIOM_WORKSPACE_AI_USAGE_BUDGETS", "true");
    m.context.mockResolvedValue({ isAuthenticated: true, organizationId: "workspace_1", userId: "manager_1" });
    m.transaction.mockImplementation(async operation => operation({ fixture: true }));
    m.read.mockResolvedValue({ kind: "ok", data: result });
    m.save.mockResolvedValue({ kind: "ok", data: result });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("keeps settings unavailable while budget enforcement is disabled", async () => {
    vi.stubEnv("AXIOM_WORKSPACE_AI_USAGE_BUDGETS", "");
    expect((await put(body)).status).toBe(503);
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("reads the authenticated scope with a no-store response", async () => {
    const response = await GET(new NextRequest(`${origin}/api/billing/workspace-ai-budget`));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, data: result });
    expect(m.read).toHaveBeenCalledWith({ fixture: true }, { organizationId: "workspace_1", userId: "manager_1" });
  });

  it("rejects cross-origin changes and mismatched workspaces before invoking a write", async () => {
    expect((await put(body, "https://other.example.test")).status).toBe(403);
    expect((await put({ ...body, organizationId: "other" })).status).toBe(409);
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { monthlyLimitCents: 50, warningThresholdCents: 51 },
    { monthlyLimitCents: -1, warningThresholdCents: null },
    { monthlyLimitCents: 50.5, warningThresholdCents: null },
    { monthlyLimitCents: 50, warningThresholdCents: 0 },
  ])("rejects invalid budget values before a write", async budget => {
    expect((await put({ ...body, budget })).status).toBe(400);
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("saves a zero cap for the session actor and leaves role checks inside the transaction", async () => {
    await put({ ...body, budget: { monthlyLimitCents: 0, warningThresholdCents: null } });
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(m.save).toHaveBeenCalledWith({ fixture: true }, { organizationId: "workspace_1", userId: "manager_1" },
      expect.objectContaining({ expectedRevision: null, budget: { monthlyLimitCents: 0, warningThresholdCents: null } }));
    m.save.mockResolvedValueOnce({ kind: "forbidden" });
    expect((await put(body)).status).toBe(403);
    m.save.mockResolvedValueOnce({ kind: "conflict" });
    expect((await put(body)).status).toBe(409);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAccount: vi.fn(), updateAccount: vi.fn(), createRun: vi.fn(), updateRun: vi.fn(), findRun: vi.fn(), snapshot: vi.fn(), preferences: vi.fn(),
  context: vi.fn(), sameOrigin: vi.fn(), admin: vi.fn(), audit: vi.fn(), changeMode: vi.fn(), membership: vi.fn(), events: vi.fn(), loadMode: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: {
  orgMembership: { findUnique: mocks.membership },
  axiomAutopilotEvent: { findMany: mocks.events },
  user: { findUnique: vi.fn(async () => ({ plan: "pro" })) },
  cloudAccount: { findUnique: mocks.findAccount, update: mocks.updateAccount },
  axiomAgentRun: { create: mocks.createRun, update: mocks.updateRun, findUniqueOrThrow: mocks.findRun },
} }));
vi.mock("@/lib/axiom/agent/providerRegistry", () => ({ generateSnapshot: mocks.snapshot }));
vi.mock("@/lib/axiom/agent/preferences", () => ({ loadPreferences: mocks.preferences }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.context }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.admin }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.audit }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "user" } })) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/entitlements", () => ({ getEntitlementsFromPlan: () => ({ axiomExecution: true }) }));
vi.mock("@/lib/axiom/agent/autopilot", async (original) => ({ ...await original<typeof import("../autopilot")>(), changeAutopilotMode: mocks.changeMode, loadAutopilotMode: mocks.loadMode }));

import { GET, PUT } from "@/app/api/axiom/autopilot/route";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/account/cloud-accounts/[id]/route";
import { runAgent } from "../runAgent";
import { getHandler } from "../../taskQueue/handlers";

const account = { id: "account", organizationId: "org", provider: "aws", externalAccountId: "123456789012", enabled: true, credentialRef: "cloud-v2:account", autopilotMode: "observe_only" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.findAccount.mockResolvedValue(account);
  mocks.membership.mockResolvedValue({ acceptedAt: new Date(), role: "admin" });
  mocks.events.mockResolvedValue([]); mocks.loadMode.mockResolvedValue("observe_only");
  mocks.changeMode.mockResolvedValue({ previousMode: "observe_only", newMode: "recommend" });
  mocks.createRun.mockResolvedValue({ id: "run" });
  mocks.updateRun.mockResolvedValue({});
  mocks.findRun.mockResolvedValue({ snapshotData: null });
  mocks.context.mockResolvedValue({ isAuthenticated: true, userId: "user", organizationId: "org", roles: ["owner"] });
  mocks.sameOrigin.mockReturnValue(true); mocks.admin.mockReturnValue(true);
  mocks.updateAccount.mockResolvedValue({ id: "account", enabled: false });
});

function request(enabled: boolean) { return new NextRequest("https://example.test/api/account/cloud-accounts/account", { method: "PATCH", body: JSON.stringify({ enabled }), headers: { "Content-Type": "application/json" } }); }
const params = { params: Promise.resolve({ id: "account" }) };

describe("cloud-v2 remains outside legacy Agent execution", () => {
  it("rejects enabling a scoped enrollment without changing the account", async () => {
    const response = await PATCH(request(true), params);
    expect(response.status).toBe(409);
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });
  it("still permits pausing a scoped account", async () => {
    expect((await PATCH(request(false), params)).status).toBe(200);
    expect(mocks.updateAccount).toHaveBeenCalledWith(expect.objectContaining({ data: { enabled: false } }));
  });
  it("preserves legacy enable requests", async () => {
    mocks.findAccount.mockResolvedValue({ ...account, credentialRef: "legacy-lead" });
    expect((await PATCH(request(true), params)).status).toBe(200);
    expect(mocks.updateAccount).toHaveBeenCalledWith(expect.objectContaining({ data: { enabled: true } }));
  });
  it("retains cross-tenant not-found behavior", async () => {
    mocks.findAccount.mockResolvedValue({ ...account, organizationId: "other" });
    expect((await PATCH(request(true), params)).status).toBe(404);
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });
  it("blocks direct scans even when an enrollment row is forcibly enabled", async () => {
    const result = await runAgent({ organizationId: "org", userId: "user", connectedAccountId: "account", provider: "aws" });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("scoped enrollment");
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.preferences).not.toHaveBeenCalled();
  });
  it("blocks queued scans before any legacy provider or credential lookup", async () => {
    const result = await getHandler("scan_cloud")({ taskId: "task", agentRunId: "run", organizationId: "org", userId: "user", cloudAccountId: "account", provider: "aws", attempt: 1, inputJson: null });
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("scoped enrollment");
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it("does not advance queued enrollment scans with a cached legacy snapshot", async () => {
    mocks.findRun.mockResolvedValue({ snapshotData: { resources: [] } });
    const result = await getHandler("scan_cloud")({ taskId: "task", agentRunId: "run", organizationId: "org", userId: "user", cloudAccountId: "account", provider: "aws", attempt: 1, inputJson: null });
    expect(result.status).toBe("failed");
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it("preserves legacy queued snapshot replay", async () => {
    mocks.findAccount.mockResolvedValue({ ...account, credentialRef: "legacy-lead" });
    mocks.findRun.mockResolvedValue({ snapshotData: { resources: [] } });
    const result = await getHandler("scan_cloud")({ taskId: "task", agentRunId: "run", organizationId: "org", userId: "user", cloudAccountId: "account", provider: "aws", attempt: 1, inputJson: null });
    expect(result).toMatchObject({ status: "completed", outputJson: { skipped: true } });
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it("preserves actual legacy snapshot dispatch", async () => {
    mocks.findAccount.mockResolvedValue({ ...account, credentialRef: "legacy-lead" });
    mocks.snapshot.mockResolvedValue({ provider: "aws", resources: [], regions: [] });
    const result = await getHandler("scan_cloud")({ taskId: "task", agentRunId: "run", organizationId: "org", userId: "user", cloudAccountId: "account", provider: "aws", attempt: 1, inputJson: null });
    expect(result.status).toBe("completed");
    expect(mocks.snapshot).toHaveBeenCalledWith("aws", "user", "legacy-lead");
  });
  it.each(["recommend", "assisted_apply", "full_guarded"])("does not escalate enrollment into %s autopilot", async (mode) => {
    const response = await PUT(new NextRequest("https://example.test/api/axiom/autopilot", { method: "PUT", body: JSON.stringify({ cloudAccountId: "account", organizationId: "org", mode }), headers: { "Content-Type": "application/json" } }));
    expect(response.status).toBe(409);
    expect(mocks.changeMode).not.toHaveBeenCalled();
  });

  it.each(["origin", "anonymous", "non_owner"])("preserves legacy toggle denial for %s", async (reason) => {
    if (reason === "origin") mocks.sameOrigin.mockReturnValue(false);
    if (reason === "anonymous") mocks.context.mockResolvedValue({ isAuthenticated: false });
    if (reason === "non_owner") mocks.admin.mockReturnValue(false);
    const response = await PATCH(request(true), params);
    expect(response.status).toBe(reason === "anonymous" ? 401 : 403);
    expect(mocks.findAccount).not.toHaveBeenCalled();
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

});


function modeRequest(body: unknown = { cloudAccountId: "account", organizationId: "org", mode: "recommend" }) {
  return new NextRequest("https://example.test/api/axiom/autopilot", { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}
const modeGet = () => new NextRequest("https://example.test/api/axiom/autopilot?cloudAccountId=account");

describe("legacy autopilot account-owned tenant authority", () => {
  it("denies a spoofed body organization even when it matches a foreign account", async () => {
    mocks.findAccount.mockResolvedValue({ ...account, organizationId: "victim", credentialRef: "legacy-lead" });
    mocks.membership.mockResolvedValue(null);
    const response = await PUT(modeRequest({ cloudAccountId: "account", organizationId: "victim", mode: "full_guarded" }));
    expect(response.status).toBe(404);
    expect(mocks.membership).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_organizationId: { userId: "user", organizationId: "victim" } } }));
    expect(mocks.changeMode).not.toHaveBeenCalled();
    expect(mocks.events).not.toHaveBeenCalled();
  });
  it.each(["missing", "pending", "read_only", "operator", "finance_viewer", "storage_error"])("denies mutation with %s membership", async (role) => {
    mocks.findAccount.mockResolvedValue({ ...account, credentialRef: "legacy-lead" });
    if (role === "missing") mocks.membership.mockResolvedValue(null);
    else if (role === "storage_error") mocks.membership.mockRejectedValue(new Error("unavailable"));
    else mocks.membership.mockResolvedValue({ role: role === "pending" ? "admin" : role, acceptedAt: role === "pending" ? null : new Date() });
    expect((await PUT(modeRequest())).status).toBe(404);
    expect(mocks.changeMode).not.toHaveBeenCalled();
    expect(mocks.events).not.toHaveBeenCalled();
  });
  it.each(["owner", "admin"])("preserves accepted legacy %s mutation", async (role) => {
    mocks.findAccount.mockResolvedValue({ ...account, credentialRef: "legacy-lead" });
    mocks.membership.mockResolvedValue({ role, acceptedAt: new Date() });
    expect((await PUT(modeRequest())).status).toBe(200);
    expect(mocks.changeMode).toHaveBeenCalledWith("account", "org", "user", "recommend");
  });
  it("treats the body organization only as consistency, never as a selector", async () => {
    expect((await PUT(modeRequest({ cloudAccountId: "account", organizationId: "other", mode: "recommend" }))).status).toBe(404);
    expect(mocks.changeMode).not.toHaveBeenCalled();
  });
  it.each(["missing", "pending", "storage_error"])("does not read another account's mode/events when membership is %s", async (kind) => {
    mocks.findAccount.mockResolvedValue({ ...account, organizationId: "other" });
    if (kind === "storage_error") mocks.membership.mockRejectedValue(new Error("unavailable"));
    else mocks.membership.mockResolvedValue(kind === "missing" ? null : { role: "owner", acceptedAt: null });
    expect((await GET(modeGet())).status).toBe(404);
    expect(mocks.loadMode).not.toHaveBeenCalled(); expect(mocks.events).not.toHaveBeenCalled();
  });
  it("permits accepted read-only members to read their account mode", async () => {
    mocks.membership.mockResolvedValue({ role: "read_only", acceptedAt: new Date() });
    expect((await GET(modeGet())).status).toBe(200);
    expect(mocks.loadMode).toHaveBeenCalledWith("account");
  });
  it("rejects cross-origin mutation before account reads", async () => {
    mocks.sameOrigin.mockReturnValue(false);
    expect((await PUT(modeRequest())).status).toBe(403);
    expect(mocks.findAccount).not.toHaveBeenCalled(); expect(mocks.changeMode).not.toHaveBeenCalled();
  });
  it.each(["{", "null", "[]"])("returns safe400 for malformed payload %s", async (body) => {
    expect((await PUT(new NextRequest("https://example.test/api/axiom/autopilot", { method: "PUT", body, headers: { "Content-Type": "application/json" } }))).status).toBe(400);
    expect(mocks.findAccount).not.toHaveBeenCalled(); expect(mocks.changeMode).not.toHaveBeenCalled();
  });
});

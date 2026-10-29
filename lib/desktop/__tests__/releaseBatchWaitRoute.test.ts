import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), request: vi.fn(), create: vi.fn(), wait: vi.fn(), cancel: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: m.auth }));
vi.mock("@/lib/db", () => ({ prisma: { tauriDeploymentRequest: { findFirst: m.request }, durableAgentWorkflow: { findFirst: m.wait } } }));
vi.mock("@/lib/agent/workflows/releaseBatchObservationCreation", () => ({ ensureReleaseBatchObservation: m.create }));
vi.mock("@/lib/agent/workflows/releaseBatchObservationCancellation", () => ({ cancelReleaseBatchObservation: m.cancel }));
import { GET, POST, DELETE } from "@/app/api/desktop/deployments/[id]/batch-wait/route";
const context = { params: Promise.resolve({ id: "release" }) };
const body = { expectedVersion: 2, deadlineAt: Date.now() + 60000 };
const post = (value: unknown = body) => new NextRequest("https://axiom.invalid/api/desktop/deployments/release/batch-wait", { method: "POST", body: JSON.stringify(value), headers: { "content-type": "application/json" } });
describe("paired release batch wait controls", () => {
 beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AXIOM_RELEASE_BATCH_WAITS_ENABLED", "true"); m.auth.mockResolvedValue({ organizationId: "org", userId: "user", capabilities: ["deploy:execute"] }); m.request.mockResolvedValue({ id: "release", organizationId: "org", version: 2, status: "submitted", intakeJson: { fixture: true } }); m.create.mockResolvedValue({ id: "wait", version: 0, status: "queued", inputJson: { deadlineAt: body.deadlineAt }, stateJson: { observationCount: 0 }, requestedByUserId: "private", secret: "private" }); });
 afterEach(() => vi.unstubAllEnvs());
 it("does not enqueue disabled background monitoring", async () => {
  vi.stubEnv("AXIOM_RELEASE_BATCH_WAITS_ENABLED", "false");
  expect((await POST(post(), context)).status).toBe(503); expect(m.create).not.toHaveBeenCalled(); expect(m.request).not.toHaveBeenCalled();
 });
 it("lets the authenticated creator cancel even while monitoring is disabled", async () => {
  vi.stubEnv("AXIOM_RELEASE_BATCH_WAITS_ENABLED", "false");
  m.cancel.mockResolvedValue({ id: "wait", version: 4, status: "cancelled", inputJson: {} });
  const response = await DELETE(post({ waitId: "release_batch_" + "a".repeat(64), expectedWaitVersion: 3 }), context);
  expect(response.status).toBe(200); expect(m.cancel).toHaveBeenCalledWith({ organizationId: "org", requestId: "release", workflowRunId: "release_batch_" + "a".repeat(64), expectedVersion: 3, actorUserId: "user" });
 });
 it("rejects cancellation authority injection before storage", async () => {
  expect((await DELETE(post({ waitId: "release_batch_" + "a".repeat(64), expectedWaitVersion: 3, actorUserId: "other" }), context)).status).toBe(400);
  expect(m.cancel).not.toHaveBeenCalled();
 });
 it("requires a paired authorized actor before reading or creating storage", async () => {
  m.auth.mockResolvedValue(null); expect((await POST(post(), context)).status).toBe(401); expect(m.request).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
 });
 it("derives tenant, actor and digest from server state and redacts the raw workflow", async () => {
  const response = await POST(post(), context); expect(response.status).toBe(200);
  expect(m.auth).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ allowApiKey: false, requiredScope: "pipeline:trigger", requiredCapability: "deploy:execute" }));
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org", requestedByUserId: "user", requestId: "release", expectedVersion: 2, expectedDigest: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  expect(JSON.stringify(await response.json())).not.toContain("private"); expect(response.headers.get("cache-control")).toBe("no-store");
 });
 it("rejects authority injection and stale versions without scheduling", async () => {
  expect((await POST(post({ ...body, organizationId: "other" }), context)).status).toBe(400);
  m.request.mockResolvedValue(null); expect((await POST(post(), context)).status).toBe(409); expect(m.create).not.toHaveBeenCalled();
 });
 it("rejects oversized bodies before storage and sanitizes create failures", async () => {
  expect((await POST(post({ ...body, extra: "x".repeat(3000) }), context)).status).toBe(400);
  expect(m.request).not.toHaveBeenCalled();
  m.create.mockRejectedValue(new Error("private storage detail")); const response = await POST(post(), context);
  expect(response.status).toBe(409); expect(JSON.stringify(await response.json())).not.toContain("private");
 });
 it("returns no workflow for a missing or stale current release", async () => {
  m.request.mockResolvedValue(null);
  const response = await GET(new NextRequest("https://axiom.invalid/api/desktop/deployments/release/batch-wait?expectedVersion=2"), context);
  expect(response.status).toBe(409); expect(m.wait).not.toHaveBeenCalled();
 });
 it("keeps enabled state and creator-only controls inside the typed data envelope", async () => {
  m.wait.mockResolvedValue({ id: "wait", version: 4, status: "running", requestedByUserId: "user", inputJson: { deadlineAt: body.deadlineAt } });
  const response = await GET(new NextRequest("https://axiom.invalid/api/desktop/deployments/release/batch-wait?expectedVersion=2"), context);
  const result = await response.json(); expect(result.data).toMatchObject({ requestVersion: 2, monitoringEnabled: true, canStart: false, canCancel: true, wait: { id: "wait" } });
  expect(JSON.stringify(result.data)).not.toContain("requestedByUserId");
 });
 it("reads only a tenant-bound current release wait with read capability", async () => {
  m.wait.mockResolvedValue({ id: "wait", version: 4, status: "paused_for_input", currentStep: "preflight_required", inputJson: { deadlineAt: body.deadlineAt }, stateJson: { observationCount: 2 } });
  const response = await GET(new NextRequest("https://axiom.invalid/api/desktop/deployments/release/batch-wait?expectedVersion=2"), context);
  expect(response.status).toBe(200); expect(m.auth).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ allowApiKey: false, requiredCapability: "workspace:read" }));
  expect(m.wait.mock.calls[0][0].where).toMatchObject({ organizationId: "org", workflowKind: "release_batch_observation_v1" });
 });
});

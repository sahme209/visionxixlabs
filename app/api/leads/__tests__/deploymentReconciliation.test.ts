import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), verify: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: () => { throw new Error("Token flow must not use admin authorization"); } }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: mocks.find, updateMany: mocks.update } } }));
vi.mock("@/lib/starterToken", () => ({ verifyStarterToken: mocks.verify }));
vi.mock("@/lib/async/statusBuilder", () => ({ buildEngineStatusResponse: ({ lead }: { lead: { status: string; fullPayload: Record<string, unknown> } }) => ({ previewUrl: lead.fullPayload.previewUrl ?? null, deployReady: ["deploy_ready", "published"].includes(lead.status) }) }));
import { GET } from "../status/route";
import { websiteDeploymentUpdate } from "@/lib/deploy/websiteDeploymentState";
import { reconcileWebsiteDeployment } from "@/lib/deploy/reconcileWebsiteDeployment";
import { observeWebsiteDeployment } from "@/lib/deploy/observeWebsiteDeployment";
const request = () => new NextRequest("https://example.test/api/leads/status?token=signed-fixture");
const payload = { previewDeployment: { deploymentId: "dpl_candidate", state: "BUILDING" }, pendingAiPackage: { companyName: "new" }, pendingAiPackageDeploymentId: "dpl_candidate", aiPackage: { companyName: "old" }, previewUrl: "https://working.vercel.app", vercelDeploymentId: "dpl_old" };
const lead = { id: "lead_fixture", status: "deploy_ready", fullPayload: payload };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("VERCEL_TOKEN", "test-only-vercel"); vi.stubEnv("VERCEL_TEAM_ID", "team_fixture"); vi.stubGlobal("fetch", mocks.fetch);
  mocks.verify.mockReturnValue({ leadId: lead.id }); mocks.find.mockResolvedValue(lead); mocks.update.mockResolvedValue({ count: 1 });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "dpl_candidate", readyState: "READY", url: "new.vercel.app" }) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("completes exact saved preview receipt and package only after provider confirms READY", async () => {
  const response = await GET(request()); const body = await response.json();
  expect(body.previewUrl).toBe("https://new.vercel.app/"); expect(body.deploymentPending).toBe(false); expect(body.deployReady).toBe(true);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.fetch.mock.calls[0][0]).toBe("https://api.vercel.com/v13/deployments/dpl_candidate?teamId=team_fixture");
  expect(mocks.fetch.mock.calls[0][1]).toMatchObject({ cache: "no-store", headers: { Authorization: "Bearer test-only-vercel" } });
  const update = mocks.update.mock.calls[0][0];
  expect(update.where).toEqual({ id: lead.id, status: lead.status, fullPayload: { equals: payload } });
  expect(update.data.fullPayload.aiPackage).toEqual({ companyName: "new" });
  expect(update.data.fullPayload.pendingAiPackage).toBeUndefined();
});
it("reports a pending operation separately from an existing working preview", async () => {
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "dpl_candidate", readyState: "BUILDING", url: "new.vercel.app" }) });
  const body = await (await GET(request())).json();
  expect(body.previewUrl).toBe("https://working.vercel.app"); expect(body.deploymentPending).toBe(true);
  expect(body.deployReady).toBe(false); expect(body.previewDeployment.state).toBe("BUILDING"); expect(mocks.update).not.toHaveBeenCalled();
});
it("records terminal failure without replacing the existing working preview", async () => {
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "dpl_candidate", readyState: "ERROR" }) });
  const body = await (await GET(request())).json();
  expect(body.previewUrl).toBe("https://working.vercel.app"); expect(body.deploymentPending).toBe(false); expect(body.previewDeployment.state).toBe("ERROR");
  expect(mocks.update.mock.calls[0][0].data.fullPayload.aiPackage).toEqual({ companyName: "old" });
});
it("does not overwrite a newer submission after delayed observation", async () => {
  mocks.update.mockResolvedValue({ count: 0 });
  mocks.find.mockResolvedValueOnce(lead).mockResolvedValueOnce({ ...lead, fullPayload: { ...payload, previewDeployment: { deploymentId: "dpl_newer", state: "BUILDING" } } });
  const body = await (await GET(request())).json();
  expect(body.previewUrl).toBe("https://working.vercel.app"); expect(body.previewDeployment.deploymentId).toBe("dpl_newer"); expect(body.deploymentPending).toBe(true);
});
it.each(["mismatch", "network", "missing-id", "missing-credential"])("keeps receipt unconfirmed on %s", async (mode) => {
  if (mode === "mismatch") mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "dpl_other", readyState: "READY", url: "wrong.vercel.app" }) });
  if (mode === "network") mocks.fetch.mockRejectedValue(new Error("timeout"));
  if (mode === "missing-id") mocks.find.mockResolvedValue({ ...lead, fullPayload: { ...payload, previewDeployment: { deploymentId: "managed-pending", state: "PENDING" } } });
  if (mode === "missing-credential") vi.stubEnv("VERCEL_TOKEN", "");
  const body = await (await GET(request())).json();
  expect(body.previewUrl).toBe("https://working.vercel.app"); expect(body.deploymentPending).toBe(true); expect(mocks.update).not.toHaveBeenCalled();
  if (["missing-id", "missing-credential"].includes(mode)) expect(mocks.fetch).not.toHaveBeenCalled();
});
it("does not read provider or mutate records for rejected signed token", async () => {
  mocks.verify.mockReturnValue({ error: "invalid" }); expect((await GET(request())).status).toBe(401);
  expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it("does not observe already settled receipt again", async () => {
  mocks.find.mockResolvedValue({ ...lead, fullPayload: { ...payload, previewDeployment: { deploymentId: "dpl_candidate", state: "READY" } } });
  await GET(request()); expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it("rejects arbitrary URL or malformed receipt IDs without an outbound request", async () => {
  await expect(observeWebsiteDeployment("https://attacker.test")).resolves.toBeNull(); expect(mocks.fetch).not.toHaveBeenCalled();
});
it("finishes accepted production publish only after exact provider READY confirmation", async () => {
  mocks.find.mockResolvedValue({ ...lead, fullPayload: { previewUrl: "https://working.vercel.app", productionDeployment: { deploymentId: "dpl_candidate", state: "QUEUED" } } });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "dpl_candidate", readyState: "READY", target: "production", url: "new.vercel.app" }) });
  const body = await (await GET(request())).json(); expect(body.status).toBe("published");
  expect(mocks.update.mock.calls[0][0].data.fullPayload).toMatchObject({ productionUrl: "https://new.vercel.app/", productionDeploymentId: "dpl_candidate", publishedAt: expect.any(String) });
});
it("cannot resurrect failed package A after immediate READY package B and a later retry", async () => {
  const packageA = { companyName: "failed A" }; const packageB = { companyName: "working B" };
  let current = { id: "lead_fixture", status: "deploy_ready", fullPayload: { ...payload, pendingAiPackage: packageA, pendingAiPackageDeploymentId: "dpl_candidate" } as Record<string, unknown> };
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "dpl_candidate", readyState: "ERROR" }) });
  const failed = await reconcileWebsiteDeployment(current);
  expect(failed.payload.pendingAiPackage).toBeUndefined(); expect(failed.payload.pendingAiPackageDeploymentId).toBeUndefined();
  const immediateB = websiteDeploymentUpdate({ result: { deploymentId: "dpl_B", state: "READY", url: "https://B.vercel.app" }, previousStatus: failed.status, payload: { ...failed.payload, aiPackage: packageB }, kind: "preview" });
  current = { id: current.id, status: immediateB.status, fullPayload: immediateB.payload };
  const retryB = websiteDeploymentUpdate({ result: { deploymentId: "dpl_retryB", state: "BUILDING", url: "https://retryB.vercel.app" }, previousStatus: current.status, payload: current.fullPayload, kind: "preview" });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "dpl_retryB", readyState: "READY", url: "retryB.vercel.app" }) });
  const completed = await reconcileWebsiteDeployment({ id: current.id, status: retryB.status, fullPayload: retryB.payload });
  expect(completed.payload.aiPackage).toEqual(packageB); expect(completed.payload.pendingAiPackage).toBeUndefined();
});
it("clears old pending package on immediate READY and never promotes a package bound to another receipt", async () => {
  const immediate = websiteDeploymentUpdate({ result: { deploymentId: "dpl_B", state: "READY", url: "https://B.vercel.app" }, previousStatus: lead.status, payload, kind: "preview" });
  expect(immediate.payload.pendingAiPackage).toBeUndefined(); expect(immediate.payload.pendingAiPackageDeploymentId).toBeUndefined();
  const completed = await reconcileWebsiteDeployment({ ...lead, fullPayload: { ...payload, pendingAiPackageDeploymentId: "dpl_other" } });
  expect(completed.payload.aiPackage).toEqual({ companyName: "old" }); expect(completed.payload.pendingAiPackage).toBeUndefined();
});
it.each([undefined, "preview"])("does not finalize publication when observed READY target is %s", async (target) => {
  mocks.find.mockResolvedValue({ ...lead, fullPayload: { previewUrl: "https://working.vercel.app", productionDeployment: { deploymentId: "dpl_candidate", state: "QUEUED" } } });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "dpl_candidate", readyState: "READY", target, url: "new.vercel.app" }) });
  const body = await (await GET(request())).json(); expect(body.status).not.toBe("published"); expect(body.deploymentPending).toBe(true); expect(mocks.update).not.toHaveBeenCalled();
});

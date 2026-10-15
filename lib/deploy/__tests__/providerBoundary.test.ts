import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const generators = vi.hoisted(() => ({ starter: vi.fn(), plan: vi.fn() }));
vi.mock("@/lib/scaffoldGenerator", () => ({ generateSiteFiles: generators.starter, generateSiteFilesFromPlan: generators.plan }));
import { deploySite, deploySiteFromPlan, type DeployProvider } from "../provider";
import { deployPreview, deployPreviewFromPlan } from "@/lib/previewDeploy";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";
const pkg = {} as AIStarterPackage;
const plan = { siteName: "test", fullPageHtml: "<h1>test</h1>" };
const files = [{ path: "index.html", content: "<h1>test</h1>" }];
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_TOKEN", "test-only-token");
  vi.stubGlobal("fetch", fetchMock);
  generators.starter.mockReturnValue(files);
  generators.plan.mockReturnValue(files);
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "dpl_fixture", url: "fixture.vercel.app" }) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const entrypoints = {
  starter: (provider: DeployProvider) => deploySite(provider, pkg, { projectName: "fixture" }),
  plan: (provider: DeployProvider) => deploySiteFromPlan(provider, plan, { projectName: "fixture" }),
  preview: (provider: DeployProvider) => deployPreview(pkg, "fixture", provider),
  previewPlan: (provider: DeployProvider) => deployPreviewFromPlan(plan, "fixture", provider),
};
describe.each(Object.entries(entrypoints))("%s provider boundary", (_name, deploy) => {
  it.each(["aws", "azure", "gcp", "unknown", "", null])("rejects explicit unsupported provider %s before generation or outbound action", async (provider) => {
    await expect(deploy(provider as DeployProvider)).rejects.toMatchObject({ code: "deployment_provider_not_supported" });
    expect(generators.starter).not.toHaveBeenCalled();
    expect(generators.plan).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves explicit Vercel file deployment", async () => {
    await expect(deploy("vercel")).resolves.toMatchObject({ deploymentId: "dpl_fixture", url: "https://fixture.vercel.app" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.vercel.com/v13/deployments");
    expect(JSON.parse(options.body)).toEqual({ name: "fixture", files: [{ file: "index.html", data: Buffer.from(files[0].content).toString("base64"), encoding: "base64" }] });
  });
});
it.each([() => deployPreview(pkg, "fixture"), () => deployPreviewFromPlan(plan, "fixture")])("preserves omitted preview provider as Vercel", async (deploy) => {
  await expect(deploy()).resolves.toMatchObject({ deploymentId: "dpl_fixture" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

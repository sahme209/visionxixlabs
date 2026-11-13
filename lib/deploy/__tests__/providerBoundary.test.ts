import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const generators = vi.hoisted(() => ({ starter: vi.fn(), plan: vi.fn() }));
vi.mock("@/lib/scaffoldGenerator", () => ({ generateSiteFiles: generators.starter, generateSiteFilesFromPlan: generators.plan }));
import { deploySite, deploySiteFromPlan, type DeployProvider } from "../provider";
import { deployPreview, deployPreviewFromPlan, deployProduction } from "@/lib/previewDeploy";
import {preparePlatformVercelDeployment} from '../platformDeployment';
import {bindPlatformExecution,bindPlatformDeploymentExecution} from '@/lib/governance/platform/effectExecution';
import {createDeploymentNativeTransport} from '@/lib/governance/platform/deploymentNativeTransport';
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";
const pkg = {} as AIStarterPackage;
const plan = { siteName: "test", fullPageHtml: "<h1>test</h1>" };
const files = [{ path: "index.html", content: "<h1>test</h1>" }];
const fetchMock = vi.fn();
function grant(projectName='fixture',target?:'production'){
 const effect=preparePlatformVercelDeployment(files,{projectName,target,teamId:'team_fixture'}).effect;
 const now=Date.now(),timing={clock:async()=>({earliest:Date.now(),latest:Date.now()}),signal:new AbortController().signal},transport=createDeploymentNativeTransport({...timing,fetch:(url,init)=>fetchMock(url,init),assertQualified:async()=>{},readHeldCredential:async()=>({token:'SYNTHETIC_HELD_TOKEN',notBefore:now-60000,expiresAt:now+60000}),assertCredentialCurrent:async()=>{}});
 return {binding:bindPlatformDeploymentExecution({claimNextEffect:async()=>({effect,proof:{}}),beforeEffectCredential:async(_proof,_effect,check)=>check(),beforeEffectSend:async(_proof,_effect,check)=>{if(!check)throw Error('missing check');await check()},observeEffect:async()=>{},beforeEffectResult:async()=>{}},'fixture-action',transport,timing)};
}
function response(value:unknown){return new Response(JSON.stringify(value),{status:200})}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_TOKEN", "test-only-token");vi.stubEnv("VERCEL_TEAM_ID","team_fixture");
  vi.stubGlobal("fetch", fetchMock);
  generators.starter.mockReturnValue(files);
  generators.plan.mockReturnValue(files);
  fetchMock.mockImplementation(async()=>response({id:"dpl_fixture",url:"fixture.vercel.app"}));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const entrypoints = {
  starter: (provider: DeployProvider) => deploySite(provider, pkg, { projectName: "fixture",platformExecution:grant().binding }),
  plan: (provider: DeployProvider) => deploySiteFromPlan(provider, plan, { projectName: "fixture",platformExecution:grant().binding }),
  preview: (provider: DeployProvider) => deployPreview(pkg, "fixture", provider,undefined,grant()),
  previewPlan: (provider: DeployProvider) => deployPreviewFromPlan(plan, "fixture", provider,undefined,grant()),
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
it.each([() => deployPreview(pkg, "fixture",undefined,undefined,grant()), () => deployPreviewFromPlan(plan, "fixture",undefined,undefined,grant())])("preserves omitted preview provider as Vercel", async (deploy) => {
  await expect(deploy()).resolves.toMatchObject({ deploymentId: "dpl_fixture" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each(["QUEUED", "BUILDING", "PENDING", "ERROR", "CANCELED", undefined])("preserves provider state %s instead of fabricating READY", async (state) => {
  fetchMock.mockImplementation(async()=>response({id:"dpl_fixture",url:"fixture.vercel.app",readyState:state}));
  const result = await deploySite("vercel", pkg, { projectName: "fixture",platformExecution:grant().binding });
  expect(result.state).toBe(state ?? "UNKNOWN");
});
it("does not invent a deployment URL from a missing provider URL", async () => {
  fetchMock.mockImplementation(async()=>response({id:"dpl_fixture",readyState:"READY"}));
  await expect(deploySite("vercel", pkg, { projectName: "fixture",platformExecution:grant().binding })).resolves.toMatchObject({ url: "", deploymentId: "dpl_fixture" });
});

it("requests production target only through explicit publication intent", async () => {
  fetchMock.mockImplementation(async()=>response({id:"dpl_production",readyState:"READY",target:"production",url:"production.vercel.app"}));
  await expect(deployProduction(pkg, "prod-fixture",grant("prod-fixture","production"))).resolves.toMatchObject({ target: "production" });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).target).toBe("production");
});
it('environment or options tokens cannot replace a qualified private deployment runtime',async()=>{
 const effect=preparePlatformVercelDeployment(files,{projectName:'fixture',teamId:'team_fixture'}).effect,bare=bindPlatformExecution({claimNextEffect:async()=>({effect,proof:{}}),beforeEffectSend:async()=>{},observeEffect:async()=>{}},'bare');await expect(deploySite('vercel',pkg,{projectName:'fixture',platformExecution:bare,credentials:{vercelToken:'SYNTHETIC_UNADMITTED_TOKEN'}})).rejects.toThrow();expect(fetchMock).not.toHaveBeenCalled();
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("node:crypto", () => ({ createSign: () => ({ update() {}, end() {}, sign: () => Buffer.from("fixture-signature") }) }));
const mocks = vi.hoisted(() => ({ config: vi.fn(), key: vi.fn() }));
vi.mock("../githubConfig", () => ({ getGithubConfig: mocks.config, resolveGithubAppPrivateKey: mocks.key }));
import { resolveGithubInstallationToken, clearInstallationTokenCache } from "../githubAppAuth";
beforeEach(() => { vi.clearAllMocks(); clearInstallationTokenCache(); mocks.config.mockResolvedValue({ appConfigured: true, appId: 123 }); mocks.key.mockResolvedValue("fixture-key"); });
afterEach(() => vi.unstubAllGlobals());

it("does not resolve/mint credentials after the bounded caller is already aborted", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController(); controller.abort();
  expect(await resolveGithubInstallationToken({ installationId: 19, repositories: ["repo"], signal: controller.signal })).toMatchObject({ ok: false });
  expect(fetcher).not.toHaveBeenCalled(); expect(mocks.key).not.toHaveBeenCalled();
});
it("uses the caller deadline, rejects redirects and bounds token response bytes without changing legacy defaults", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response("x".repeat(70_000))); vi.stubGlobal("fetch", fetcher);
  const result = await resolveGithubInstallationToken({ installationId: 19, repositories: ["repo"], signal: new AbortController().signal });
  expect(result).toMatchObject({ ok: false }); expect(result).not.toHaveProperty("token");
  expect(fetcher).toHaveBeenCalledWith("https://api.github.com/app/installations/19/access_tokens", expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal), redirect: "error", credentials: "omit" }));
});
it("does not mint if authority's deadline expires while reading App configuration", async () => {
  const controller = new AbortController();
  mocks.config.mockImplementation(async () => { controller.abort(); return { appConfigured: true, appId: 123 }; });
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(await resolveGithubInstallationToken({ installationId: 19, repositories: ["repo"], signal: controller.signal })).toMatchObject({ ok: false });
  expect(fetcher).not.toHaveBeenCalled();
});

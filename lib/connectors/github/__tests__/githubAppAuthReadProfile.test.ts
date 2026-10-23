import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("node:crypto", () => ({ createSign: () => ({ update() {}, end() {}, sign: () => Buffer.from("fixture-signature") }) }));
vi.mock("../githubConfig", () => ({ getGithubConfig: async () => ({ appConfigured: true, appId: 123 }), resolveGithubAppPrivateKey: async () => "fixture-key" }));
import { resolveGithubInstallationToken, clearInstallationTokenCache } from "../githubAppAuth";
const permissions = { contents: "read", actions: "read", attestations: "read", metadata: "read" };
const response = (overrides: Record<string, unknown> = {}) => new Response(JSON.stringify({ token: "fixture-reader-token", expires_at: new Date(Date.now() + 3600_000).toISOString(), permissions, repositories: [{ id: 19, name: "repo" }], repository_selection: "selected", ...overrides }));
beforeEach(() => { clearInstallationTokenCache(); });
afterEach(() => { vi.unstubAllGlobals(); clearInstallationTokenCache(); });
it("requests exactly the explicit read permission profile and validates the granted selected repository", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => response()); vi.stubGlobal("fetch", fetcher);
  expect(await resolveGithubInstallationToken({ installationId: 19, repositories: ["repo"], permissionProfile: "provenance_read" })).toMatchObject({ ok: true });
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ repositories: ["repo"], permissions: { contents: "read", actions: "read", attestations: "read" } });
});
it.each([
  { permissions: undefined }, { permissions: { contents: "read", actions: "read" } }, { permissions: { ...permissions, contents: "write" } },
  { permissions: { ...permissions, issues: "read" } }, { repositories: [{ name: "other" }] }, { repositories: undefined },
  { repository_selection: "all" },
])("rejects absent, broader or unexpected granted scope without caching/fallback", async overrides => {
  const fetcher = vi.fn<typeof fetch>(async () => response(overrides)); vi.stubGlobal("fetch", fetcher);
  const input = { installationId: 19, repositories: ["repo"], permissionProfile: "provenance_read" as const };
  expect(await resolveGithubInstallationToken(input)).toMatchObject({ ok: false });
  expect(await resolveGithubInstallationToken(input)).toMatchObject({ ok: false });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("never reuses a cached legacy broad token for the narrow profile or vice versa", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => response()); vi.stubGlobal("fetch", fetcher);
  const base = { installationId: 19, repositories: ["repo"] };
  await resolveGithubInstallationToken(base);
  await resolveGithubInstallationToken({ ...base, permissionProfile: "provenance_read" });
  await resolveGithubInstallationToken(base);
  await resolveGithubInstallationToken({ ...base, permissionProfile: "provenance_read" });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("requests contents-only authority without actions or attestations for coding evidence",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>response({permissions:{contents:'read',metadata:'read'}}));vi.stubGlobal('fetch',fetcher);
 expect(await resolveGithubInstallationToken({installationId:19,repositories:['repo'],permissionProfile:'contents_read'})).toMatchObject({ok:true});
 expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({repositories:['repo'],permissions:{contents:'read'}});
});
it.each([{contents:'write'},{contents:'read',actions:'read'},{contents:'read',attestations:'read'},{}])("refuses an unverified or broader contents-only grant %j",async grants=>{
 vi.stubGlobal('fetch',vi.fn<typeof fetch>(async()=>response({permissions:grants})));
 expect(await resolveGithubInstallationToken({installationId:19,repositories:['repo'],permissionProfile:'contents_read'})).toMatchObject({ok:false});
});
it("does not reuse provenance or broad tokens for contents-only evidence",async()=>{
 const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{const requested=JSON.parse(String(init?.body)).permissions;return response({permissions:requested??permissions});});vi.stubGlobal('fetch',fetcher);
 const base={installationId:19,repositories:['repo']};
 await resolveGithubInstallationToken(base);await resolveGithubInstallationToken({...base,permissionProfile:'provenance_read'});await resolveGithubInstallationToken({...base,permissionProfile:'contents_read'});await resolveGithubInstallationToken({...base,permissionProfile:'contents_read'});
 expect(fetcher).toHaveBeenCalledTimes(3);
});

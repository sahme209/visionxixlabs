import { afterEach, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
type FixtureRequest = { method: string; url: string; headers: Record<string, string>; [Symbol.asyncIterator](): AsyncGenerator<Buffer> };
type FixtureResponse = { destroyed: boolean; writeHead(status: number, headers?: Record<string, string>): FixtureResponse; end(bytes?: string | Buffer): void };
const seam = vi.hoisted(() => ({ handler: undefined as undefined | ((request: FixtureRequest, response: FixtureResponse) => Promise<void>), privateKey: "" }));
vi.mock("node:http", () => ({ createServer: (handler: typeof seam.handler) => {
  seam.handler = handler;
  // In-memory protocol callback only: never constructs a native server/socket.
  return { once() { return this; }, on() { return this; }, listen(_port: number, _host: string, done: () => void) { done(); }, address() { return { port: 34567 }; }, closeAllConnections() {}, close(done: () => void) { done(); } };
} }));
vi.mock("@/lib/connectors/github/githubConfig", () => ({ getGithubConfig: async () => ({ appConfigured: true, appId: 42 }), resolveGithubAppPrivateKey: async () => seam.privateKey }));
import { startOwnedEcsCheckedInputWire } from "../../scripts/fixtures/ownedEcsCheckedInputWire.mjs";
import { clearInstallationTokenCache, resolveGithubInstallationToken } from "@/lib/connectors/github/githubAppAuth";
afterEach(() => { clearInstallationTokenCache(); vi.unstubAllGlobals(); seam.handler = undefined; seam.privateKey = ""; });
it.each(["exact", "missing_permissions", "write_permission", "all_repositories", "wrong_repository"])("the actual owned token response enforces %s scope through the actual validator without network IO", async mode => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } }); seam.privateKey = keys.privateKey;
  const proof = "a".repeat(32), wire = await startOwnedEcsCheckedInputWire({ proof, publicKey: keys.publicKey }); wire.bindProcess(9001);
  const deliver = (url: string, headers: Record<string, string>, body: string) => new Promise<Response>((resolve, reject) => {
    let status = 0, responseHeaders: Record<string, string> = {};
    const response: FixtureResponse = { destroyed: false, writeHead(code, values = {}) { status = code; responseHeaders = values; return this; }, end(bytes = "") { resolve(new Response(typeof bytes === "string" ? bytes : new Uint8Array(bytes), { status, headers: responseHeaders })); } };
    const request: FixtureRequest = { method: "POST", url, headers: { "x-axiom-fixture-guard": proof, "x-axiom-fixture-process": "9001", ...headers }, async *[Symbol.asyncIterator]() { yield Buffer.from(body); } };
    if (!seam.handler) { reject(new Error("fixture_callback_missing")); return; } void seam.handler(request, response).catch(reject);
  });
  try {
    expect((await deliver("/__fixture_guard_ready", {}, "{}")).status).toBe(200);
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input) === "https://api.github.com/app/installations/19/access_tokens").toBe(true); expect({ method: init?.method, redirect: init?.redirect, credentials: init?.credentials }).toEqual({ method: "POST", redirect: "error", credentials: "omit" });
      const response = await deliver("/app/installations/19/access_tokens", { ...Object.fromEntries(new Headers(init?.headers)), "x-axiom-original-host": "api.github.com", "x-axiom-fixture-sequence": "1" }, String(init?.body));
      const value = await response.json();
      // Assert only public fixed scope metadata; omit all credential-bearing fields.
      expect({ permissions: value.permissions, repositories: value.repositories, repository_selection: value.repository_selection }).toEqual({ permissions: { contents: "read", actions: "read", attestations: "read" }, repositories: [{ id: 804468129, name: "artifact-attestations-workflows", full_name: "github/artifact-attestations-workflows" }], repository_selection: "selected" });
      if (mode === "missing_permissions") delete value.permissions;
      if (mode === "write_permission") value.permissions.contents = "write";
      if (mode === "all_repositories") value.repository_selection = "all";
      if (mode === "wrong_repository") value.repositories = [{ name: "other" }];
      return new Response(JSON.stringify(value), { status: response.status, headers: response.headers });
    }); vi.stubGlobal("fetch", fetcher);
    const outcome = await resolveGithubInstallationToken({ installationId: 19, repositories: ["artifact-attestations-workflows"], permissionProfile: "provenance_read" });
    // Safe closed assertion only: never print a token/key/header/error payload on failure.
    expect({ ok: outcome.ok, errorCode: outcome.ok ? null : outcome.errorCode }).toEqual(mode === "exact" ? { ok: true, errorCode: null } : { ok: false, errorCode: "github.app_read_scope_unverified" });
    expect(wire.summary()).toMatchObject({ requests: ["GithubToken"], violation: false, guardProcesses: 1 }); expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { await wire.close(); }
});

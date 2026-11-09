import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { realpathSync } from "node:fs";
import * as fs from "node:fs";
import { newTestChildEnvironment, newTestPrismaEnvironment } from "./fixtures/newTestChildEnvironment";
vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});
const fixture = { databaseUrl: "postgresql://postgres:synthetic@127.0.0.1:54999/axiom_new_test_contract_rehearsal", appOrigin: "http://127.0.0.1:31999", fontResponses: "/tmp/owned-font-fixture.cjs", runtimeId: "runtime", accountId: "acct_test", organizationId: "org", authSecret: "synthetic-owned-auth-only" };
describe("owned new TEST Next child environment", () => {
  it("opaquely preserves managed proxy/CA selectors and supported exact heap option while excluding ambient credentials", () => {
    const selectors = { HTTPS_PROXY: "opaque-proxy", https_proxy: "opaque-lowercase", HTTP_PROXY: "opaque-http", ALL_PROXY: "opaque-all", NO_PROXY: "opaque-no", http_proxy: "opaque-http-lower", all_proxy: "opaque-all-lower", no_proxy: "opaque-no-lower", NODE_USE_ENV_PROXY: "1", NODE_EXTRA_CA_CERTS: "opaque-node-ca", SSL_CERT_FILE: "opaque-ssl-ca", SSL_CERT_DIR: "opaque-ca-dir", CODEX_PROXY_CERT: "opaque-managed-cert", REQUESTS_CA_BUNDLE: "opaque-requests-ca", CURL_CA_BUNDLE: "opaque-curl-ca", AWS_CA_BUNDLE: "opaque-aws-ca" };
    const inherited = { ...selectors, NODE_ENV: "production", NODE_OPTIONS: "  --max-old-space-size=2048  ", STRIPE_SECRET_KEY: "forbidden", AWS_ACCESS_KEY_ID: "forbidden", AI_GATEWAY_API_KEY: "forbidden", DATABASE_URL: "forbidden", NEXTAUTH_SECRET: "forbidden", PATH: "/synthetic/bin" };
    const before = { ...inherited };
    const child = newTestChildEnvironment(inherited, ["--conditions", "node", "--conditions=development"], fixture);
    expect(child).toMatchObject(selectors); expect(child.NODE_OPTIONS).toBe(inherited.NODE_OPTIONS);
    expect(child).toMatchObject({ NODE_ENV: "development", PATH: "/synthetic/bin", DATABASE_URL: fixture.databaseUrl, DIRECT_URL: fixture.databaseUrl, NEXTAUTH_URL: fixture.appOrigin, NEXTAUTH_SECRET: fixture.authSecret, AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true", AXIOM_ISOLATED_TEST_RUNTIME_ID: fixture.runtimeId, AXIOM_ISOLATED_TEST_ACCOUNT_ID: fixture.accountId, AXIOM_ISOLATED_TEST_ORGANIZATIONS: fixture.organizationId, AI_GATEWAY_API_KEY: "synthetic-inert-not-a-provider-credential", AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null" });
    expect(child).not.toHaveProperty("STRIPE_SECRET_KEY"); expect(child).not.toHaveProperty("AWS_ACCESS_KEY_ID"); expect(inherited).toEqual(before);
  });
  it("retains actual installed Vitest worker options through a literal child stub without a server", () => {
    const child = newTestChildEnvironment({ HTTPS_PROXY: "opaque-managed-proxy", NODE_OPTIONS: "--max-old-space-size=2048" }, process.execArgv, fixture);
    const stub = `const fs = require("node:fs"), path = require("node:path"); const preload = fs.realpathSync(path.join(path.dirname(require.resolve("vitest/package.json")), "suppress-warnings.cjs")); console.log(JSON.stringify({ preloadLoaded: !!require.cache[preload], builtinRetained: process.env.NODE_OPTIONS.includes("--experimental-import-meta-resolve"), heapRetained: process.env.NODE_OPTIONS.includes("--max-old-space-size=2048"), managedSelectorPreserved: process.env.HTTPS_PROXY === "opaque-managed-proxy", providerDenied: process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME === "true", providerCredentialExcluded: process.env.STRIPE_SECRET_KEY === undefined }));`;
    const result = spawnSync(process.execPath, ["-e", stub], { env: child, encoding: "utf8", timeout: 10000 });
    expect(result.status).toBe(0); expect(result.error).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual({ preloadLoaded: true, builtinRetained: true, heapRetained: true, managedSelectorPreserved: true, providerDenied: true, providerCredentialExcluded: true });
  });
  it("refuses alternate warning-preload spellings and extra guards rather than accepting a basename", () => {
    const require = createRequire(import.meta.url);
    const installed = realpathSync(resolve(dirname(require.resolve("vitest/package.json")), "suppress-warnings.cjs"));
    for (const args of [["--require", "/tmp/suppress-warnings.cjs"], ["--require", installed + ".substituted"], ["--require", installed, "--require", "/managed/guard.cjs"], ["--require=" + installed], ["--experimental-import-meta-resolve=unexpected"]]) {
      expect(() => newTestChildEnvironment({}, args, fixture)).toThrow("owned_test_child_options_unsupported");
    }
  });
  it.each(["source", "installed_version", "locked_version"])("refuses substituted installed Vitest provenance: %s", changed => {
    const require = createRequire(import.meta.url);
    const installed = realpathSync(resolve(dirname(require.resolve("vitest/package.json")), "suppress-warnings.cjs"));
    const read = vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(JSON.stringify({ version: changed === "installed_version" ? "0.0.0" : "4.1.12" }))
      .mockReturnValueOnce(JSON.stringify({ packages: { "node_modules/vitest": { version: changed === "locked_version" ? "0.0.0" : "4.1.12" } } }))
      .mockReturnValueOnce(Buffer.from("substituted preload"));
    try { expect(() => newTestChildEnvironment({}, ["--require", installed], fixture)).toThrow("owned_test_child_options_unsupported"); }
    finally { read.mockRestore(); }
  });
  it("sets the owned heap only when absent and retains an allowed CLI heap option", () => {
    expect(newTestChildEnvironment({}, [], fixture).NODE_OPTIONS).toBe("--max-old-space-size=3072");
    expect(newTestChildEnvironment({}, ["--max_old_space_size=2048"], fixture).NODE_OPTIONS).toBe("--max_old_space_size=2048");
  });
  it.each(["--require=/managed/guard.cjs", "--import=/managed/guard.mjs", "--loader=/managed/loader.mjs", "--use-openssl-ca", "--max-old-space-size=2048 --require=/managed/guard.cjs"])("refuses unsupported inherited NODE_OPTIONS before spawn: %s", option => {
    const spawn = vi.fn();
    expect(() => { const env = newTestChildEnvironment({ NODE_OPTIONS: option }, [], fixture); spawn(env); }).toThrow("owned_test_child_options_unsupported");
    expect(spawn).not.toHaveBeenCalled();
    try { newTestChildEnvironment({ NODE_OPTIONS: option }, [], fixture); } catch (error) { expect(String(error)).not.toContain(option); }
  });
  it.each([["--require", "/managed/guard.cjs"], ["--import=/managed/guard.mjs"], ["--loader=/managed/loader.mjs"], ["--conditions=unknown"]])("refuses unsupported inherited CLI guard/options %j", (...options) => {
    expect(() => newTestChildEnvironment({}, options, fixture)).toThrow("owned_test_child_options_unsupported");
  });
  it.each(["NODE_TLS_REJECT_UNAUTHORIZED", "OPENSSL_CONF"])("refuses unsupported inherited trust selector %s without overriding it", key => {
    expect(() => newTestChildEnvironment({ [key]: "opaque" }, [], fixture)).toThrow("owned_test_child_options_unsupported");
  });
  it.each([{ databaseUrl: "postgresql://postgres:synthetic@remote.invalid:5432/axiom_new_test_contract_rehearsal" }, { databaseUrl: "postgresql://postgres:synthetic@127.0.0.1:5432/production" }, { appOrigin: "https://public.invalid" }])("rejects a non-owned target %j", patch => {
    expect(() => newTestChildEnvironment({}, [], { ...fixture, ...patch })).toThrow("owned_test_child_scope_required");
  });
});

describe("owned Prisma setup child environment", () => {
  it.each([undefined, "false"])("forces checkpoint network refusal when inherited CHECKPOINT_DISABLE is %s", value => {
    const inherited = value === undefined ? {} : { CHECKPOINT_DISABLE: value };
    const before = { ...inherited };
    expect(newTestPrismaEnvironment(inherited, [], fixture.databaseUrl).CHECKPOINT_DISABLE).toBe("1");
    expect(inherited).toEqual(before);
  });
  it("preserves reviewed transport/framework options but excludes every ambient provider/database credential", () => {
    const selectors = { HTTPS_PROXY: "opaque-managed-proxy", NODE_EXTRA_CA_CERTS: "opaque-managed-ca", AWS_CA_BUNDLE: "opaque-managed-aws-ca" };
    const inherited = { ...selectors, NODE_ENV: "production", STRIPE_SECRET_KEY: "forbidden", AWS_ACCESS_KEY_ID: "forbidden", AI_GATEWAY_API_KEY: "forbidden", DATABASE_URL: "forbidden", DIRECT_URL: "forbidden", SHADOW_DATABASE_URL: "forbidden", VERCEL: "forbidden", NEXTAUTH_SECRET: "forbidden" };
    const before = { ...inherited }, child = newTestPrismaEnvironment(inherited, process.execArgv, fixture.databaseUrl);
    expect(child).toMatchObject({ ...selectors, NODE_ENV: "development", DATABASE_URL: fixture.databaseUrl, DIRECT_URL: fixture.databaseUrl, SHADOW_DATABASE_URL: fixture.databaseUrl });
    for (const key of ["STRIPE_SECRET_KEY", "AWS_ACCESS_KEY_ID", "AI_GATEWAY_API_KEY", "VERCEL", "NEXTAUTH_SECRET"]) expect(child).not.toHaveProperty(key);
    expect(child.NODE_OPTIONS).toContain("--experimental-import-meta-resolve"); expect(inherited).toEqual(before);
  });
  it("roundtrips the checked framework preload through a literal child without a database/CLI/server", () => {
    const child = newTestPrismaEnvironment({ HTTPS_PROXY: "opaque-managed-proxy", STRIPE_SECRET_KEY: "forbidden" }, process.execArgv, fixture.databaseUrl);
    const result = spawnSync(process.execPath, ["-e", 'console.log(JSON.stringify({ owned: new URL(process.env.DATABASE_URL).hostname === "127.0.0.1" && process.env.DATABASE_URL === process.env.DIRECT_URL && process.env.DATABASE_URL === process.env.SHADOW_DATABASE_URL, managed: process.env.HTTPS_PROXY === "opaque-managed-proxy", noProvider: process.env.STRIPE_SECRET_KEY === undefined && process.env.AI_GATEWAY_API_KEY === undefined, preload: process.env.NODE_OPTIONS.includes("suppress-warnings.cjs") }))'], { env: child, encoding: "utf8", timeout: 10000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0); expect(JSON.parse(result.stdout)).toEqual({ owned: true, managed: true, noProvider: true, preload: true });
  });
  it.each(["postgresql://postgres:synthetic@remote.invalid:5432/axiom_new_test_contract_rehearsal", "postgresql://postgres:synthetic@127.0.0.1:5432/production"])("refuses a non-owned Prisma target", database => {
    expect(() => newTestPrismaEnvironment({}, [], database)).toThrow("owned_test_child_scope_required");
  });
  it("refuses inherited guards/trust instead of silently removing them", () => {
    expect(() => newTestPrismaEnvironment({ NODE_OPTIONS: "--require=/managed/guard.cjs" }, [], fixture.databaseUrl)).toThrow("owned_test_child_options_unsupported");
    expect(() => newTestPrismaEnvironment({ OPENSSL_CONF: "opaque" }, [], fixture.databaseUrl)).toThrow("owned_test_child_options_unsupported");
  });
});

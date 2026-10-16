import { describe, expect, it, vi } from "vitest";
import { newTestChildEnvironment } from "./fixtures/newTestChildEnvironment";
const fixture = { databaseUrl: "postgresql://postgres:synthetic@127.0.0.1:54999/axiom_new_test_contract_rehearsal", appOrigin: "http://127.0.0.1:31999", fontResponses: "/tmp/owned-font-fixture.cjs", runtimeId: "runtime", accountId: "acct_test", organizationId: "org", authSecret: "synthetic-owned-auth-only" };
describe("owned new TEST Next child environment", () => {
  it("opaquely preserves managed proxy/CA selectors and supported exact heap option while excluding ambient credentials", () => {
    const selectors = { HTTPS_PROXY: "opaque-proxy", https_proxy: "opaque-lowercase", HTTP_PROXY: "opaque-http", ALL_PROXY: "opaque-all", NO_PROXY: "opaque-no", http_proxy: "opaque-http-lower", all_proxy: "opaque-all-lower", no_proxy: "opaque-no-lower", NODE_USE_ENV_PROXY: "1", NODE_EXTRA_CA_CERTS: "opaque-node-ca", SSL_CERT_FILE: "opaque-ssl-ca", SSL_CERT_DIR: "opaque-ca-dir", CODEX_PROXY_CERT: "opaque-managed-cert", REQUESTS_CA_BUNDLE: "opaque-requests-ca", CURL_CA_BUNDLE: "opaque-curl-ca", AWS_CA_BUNDLE: "opaque-aws-ca" };
    const inherited = { ...selectors, NODE_OPTIONS: "  --max-old-space-size=2048  ", STRIPE_SECRET_KEY: "forbidden", AWS_ACCESS_KEY_ID: "forbidden", AI_GATEWAY_API_KEY: "forbidden", DATABASE_URL: "forbidden", NEXTAUTH_SECRET: "forbidden", PATH: "/synthetic/bin" };
    const before = { ...inherited };
    const child = newTestChildEnvironment(inherited, ["--conditions", "node", "--conditions=development"], fixture);
    expect(child).toMatchObject(selectors); expect(child.NODE_OPTIONS).toBe(inherited.NODE_OPTIONS);
    expect(child).toMatchObject({ PATH: "/synthetic/bin", DATABASE_URL: fixture.databaseUrl, DIRECT_URL: fixture.databaseUrl, NEXTAUTH_URL: fixture.appOrigin, NEXTAUTH_SECRET: fixture.authSecret, AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true", AXIOM_ISOLATED_TEST_RUNTIME_ID: fixture.runtimeId, AXIOM_ISOLATED_TEST_ACCOUNT_ID: fixture.accountId, AXIOM_ISOLATED_TEST_ORGANIZATIONS: fixture.organizationId, AI_GATEWAY_API_KEY: "synthetic-inert-not-a-provider-credential", AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null" });
    expect(child).not.toHaveProperty("STRIPE_SECRET_KEY"); expect(child).not.toHaveProperty("AWS_ACCESS_KEY_ID"); expect(inherited).toEqual(before);
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

import { expect, it } from "vitest";
import { ownedEcsBaseEnvironment, ownedEcsChildEnvironment } from "../../scripts/run-owned-ecs-checked-inputs.mjs";
const marker = { AXIOM_RUN_OWNED_ECS_CHECKED_INPUTS: "1" };
it.each([{}, { AXIOM_RUN_OWNED_ECS_CHECKED_INPUTS: "true" }])("requires exact runner opt-in without any runtime", env => expect(() => ownedEcsBaseEnvironment(env)).toThrow("owned_ecs_explicit_opt_in_required"));
it.each(["DATABASE_URL", "DIRECT_URL", "PGHOST", "NODE_OPTIONS", "NODE_TLS_REJECT_UNAUTHORIZED", "GITHUB_TOKEN", "GITHUB_APP_ID", "AWS_ENDPOINT_URL", "AWS_ACCESS_KEY_ID", "CREDENTIAL_ENCRYPTION_KEY", "AXIOM_OWNED_ECS_ORIGIN", "DOCKER_HOST", "STRIPE_SECRET_KEY"])("rejects inherited %s without reading/printing its value", key => expect(() => ownedEcsBaseEnvironment({ ...marker, [key]: "never-echo" })).toThrow("owned_ecs_inherited_binding_forbidden"));
it("preserves opaque proxy/CA but omits HOME and all unrelated environment", () => {
  const base = ownedEcsBaseEnvironment({ ...marker, PATH: "/usr/bin", HOME: "/private", HTTPS_PROXY: "opaque-private-proxy", NODE_EXTRA_CA_CERTS: "/managed/ca", UNRELATED: "omit" });
  expect(base).toEqual({ PATH: "/usr/bin", HTTPS_PROXY: "opaque-private-proxy", NODE_EXTRA_CA_CERTS: "/managed/ca" });
});
it("constructs only owned child transport/DB and synthetic explicit credentials", () => {
  const options = { databaseUrl: "postgresql://fixture:owned@127.0.0.1:34568/axiom_auth_http_123456789abc", origin: "http://127.0.0.1:34567", proof: "a".repeat(32), sourceCommit: "b".repeat(40), privateKey: "-----BEGIN PRIVATE KEY-----owned-test-only", encryptionKey: "a".repeat(32), desktopKey: "b".repeat(32) };
  const env = ownedEcsChildEnvironment({}, options);
  expect(env.DATABASE_URL).toBe(options.databaseUrl); expect(env.DIRECT_URL).toBe(options.databaseUrl);
  expect(env.AWS_CONFIG_FILE).toBe("/dev/null"); expect(env.AWS_ENDPOINT_URL).toBeUndefined(); expect(env.HOME).toBeUndefined();
  expect(env.NODE_OPTIONS).toMatch(/--require=.*ownedEcsCheckedInputPreload.cjs$/); expect(env.NODE_OPTIONS).not.toContain("tls");
  expect(() => ownedEcsChildEnvironment({ NODE_OPTIONS: "forbidden" }, options)).toThrow();
  expect(() => ownedEcsChildEnvironment({}, { ...options, databaseUrl: options.databaseUrl.replace("127.0.0.1", "localhost") })).toThrow();
  expect(() => ownedEcsChildEnvironment({}, { ...options, origin: "https://real.invalid" })).toThrow();
});

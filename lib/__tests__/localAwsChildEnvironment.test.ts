import { describe, expect, it } from "vitest";
import { localAwsChildEnvironment } from "../../scripts/fixtures/localAwsChildEnvironment.mjs";
const fixture = { origin: "http://127.0.0.1:34567", proof: "synthetic-only-proof", brokerKey: "fixture-key", secret: "fixture-only-secret", encryptionSecret: "fixture-only-encryption-secret" };
const input = { appOrigin: "http://127.0.0.1:34568", mailOrigin: "http://127.0.0.1:34569", fixture };
describe("explicit owned AWS fixture child environment", () => {
  it("omits inherited HOME and sets only native owned endpoints with committed preload", () => {
    const base = { PATH: "/fixture", HOME: "/unchanged-parent", DATABASE_URL: "synthetic-local-target" };
    const result = localAwsChildEnvironment(base, input);
    expect("HOME" in result).toBe(false); expect(base.HOME).toBe("/unchanged-parent");
    expect(result.AWS_ENDPOINT_URL_STS).toBe(fixture.origin); expect(result.AWS_ENDPOINT_URL_EC2).toBe(fixture.origin);
    expect(result.AWS_CONFIG_FILE).toBe("/dev/null"); expect(result.AWS_SHARED_CREDENTIALS_FILE).toBe("/dev/null");
    expect(result.NODE_OPTIONS).toMatch(/^--require=\/.*\/scripts\/fixtures\/ownedAwsHttpPreload\.cjs$/);
  });
  it.each(["NODE_OPTIONS", "AWS_PROFILE", "AWS_ENDPOINT_URL", "CREDENTIAL_ENCRYPTION_KEY"])("refuses inherited override %s", key => {
    expect(() => localAwsChildEnvironment({ [key]: "untrusted" }, input)).toThrow("inherited_aws_fixture_configuration_forbidden");
  });
  it("refuses a non-loopback fixture endpoint before launching a child", () => {
    expect(() => localAwsChildEnvironment({}, { ...input, fixture: { ...fixture, origin: "https://sts.amazonaws.com" } })).toThrow("owned_aws_child_origins_required");
  });
});

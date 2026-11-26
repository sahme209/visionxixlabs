import { describe, expect, it } from "vitest";
import { partialKeys, resolveVariables, resolvedDigest, scopeKeyFor, validateVariable } from "../scopedVariables";

const ok = (key: string, value = "x", scopeKey = "workspace") => validateVariable({ key, value, scopeKey });
describe("scoped variables", () => {
  it("accepts plain configuration and rejects malformed names and scopes", () => {
    expect(ok("API_BASE_URL", "https://api.example.invalid")).toEqual([]);
    expect(ok("api_url")).toContain("key_invalid");
    expect(ok("1URL")).toContain("key_invalid");
    expect(ok("URL", "x", "env:../x")).toContain("scope_invalid");
    expect(ok("URL", "a\u0007b")).toContain("value_has_control_characters");
    expect(ok("URL", "x".repeat(4097))).toContain("value_too_long");
  });
  it("refuses secret-looking names and values so credentials stay scoped and encrypted", () => {
    expect(ok("DB_PASSWORD")).toContain("looks_like_secret_key");
    expect(ok("STRIPE_API_KEY")).toContain("looks_like_secret_key");
    for (const v of ["AKIAABCDEFGHIJKLMNOP", "ghp_" + "a".repeat(36), "-----BEGIN RSA PRIVATE KEY-----", "postgres://u:p@host/db", "sk_live_" + "a".repeat(24)])
      expect(ok("CONFIG", v)).toContain("looks_like_secret_value");
    expect(ok("GITHUB_TOKEN")).toContain("looks_like_secret_key");
    expect(ok("AWS_SECRET_ACCESS_KEY")).toContain("looks_like_secret_key");
    expect(ok("TOKENIZER_MODE", "fast")).toEqual([]);
    expect(ok("KEYCLOAK_REALM", "main")).toEqual([]);
  });
  it("resolves environment overrides over workspace defaults, sorted, with source", () => {
    const vars = [
      { key: "REGION", value: "us-east-1", scopeKey: "workspace" },
      { key: "LOG_LEVEL", value: "info", scopeKey: "workspace" },
      { key: "LOG_LEVEL", value: "warn", scopeKey: scopeKeyFor("prod") },
      { key: "REPLICAS", value: "3", scopeKey: "env:prod" },
      { key: "REPLICAS", value: "1", scopeKey: "env:dev" },
    ];
    expect(resolveVariables(vars, "prod")).toEqual([
      { key: "LOG_LEVEL", value: "warn", source: "environment" },
      { key: "REGION", value: "us-east-1", source: "workspace" },
      { key: "REPLICAS", value: "3", source: "environment" },
    ]);
    expect(resolveVariables(vars, "dev").map((v) => v.value)).toEqual(["info", "us-east-1", "1"]);
    expect(partialKeys(vars, ["dev", "prod", "uat"])).toEqual([{ key: "REPLICAS", missingIn: ["uat"] }]);
  });
  it("digests the resolved set stably and changes when any value changes", () => {
    const a = resolvedDigest([{ key: "A", value: "1", source: "workspace" }]);
    expect(a).toBe(resolvedDigest([{ key: "A", value: "1", source: "environment" }]));
    expect(a).not.toBe(resolvedDigest([{ key: "A", value: "2", source: "workspace" }]));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

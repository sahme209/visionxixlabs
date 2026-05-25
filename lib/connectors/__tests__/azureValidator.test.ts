import { describe, expect, it } from "vitest";
import { parseAzureSpJson } from "../cloudInputValidation";

/* ──────────────────────────────────────────────────────────────────
   Azure connector — input-shape regression suite.

   These tests pin the contract of parseAzureSpJson — the pure
   JSON+GUID validator the /api/azure/validate-subscription route
   uses BEFORE delegating to the live ARM call. If a customer
   pastes garbage, this layer catches it and returns a structured
   error with a customer-actionable hint, never an unhandled throw.

   No SDK imports — runs anywhere.
   ────────────────────────────────────────────────────────────── */

const VALID_TENANT = "12345678-1234-1234-1234-123456789012";
const VALID_SUB    = "abcdef01-2345-6789-abcd-ef0123456789";
const VALID_CLIENT = "00000000-0000-0000-0000-000000000001";

const SDK_AUTH_JSON = JSON.stringify({
  tenantId: VALID_TENANT,
  subscriptionId: VALID_SUB,
  clientId: VALID_CLIENT,
  clientSecret: "shh-secret",
  activeDirectoryEndpointUrl: "https://login.microsoftonline.com",
});

const DEFAULT_AZ_JSON = JSON.stringify({
  tenant: VALID_TENANT,
  subscription: VALID_SUB,
  appId: VALID_CLIENT,
  password: "shh-secret",
});

describe("parseAzureSpJson", () => {
  it("accepts az --sdk-auth output (tenantId/subscriptionId/clientId/clientSecret keys)", () => {
    const r = parseAzureSpJson(SDK_AUTH_JSON);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tenantId).toBe(VALID_TENANT);
      expect(r.subscriptionId).toBe(VALID_SUB);
      expect(r.clientId).toBe(VALID_CLIENT);
      expect(r.clientSecret).toBe("shh-secret");
    }
  });

  it("accepts the default az output too (tenant/subscription/appId/password keys)", () => {
    const r = parseAzureSpJson(DEFAULT_AZ_JSON);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tenantId).toBe(VALID_TENANT);
      expect(r.clientId).toBe(VALID_CLIENT);
    }
  });

  it("trims surrounding whitespace", () => {
    const r = parseAzureSpJson(`\n  ${SDK_AUTH_JSON}  \n`);
    expect(r.ok).toBe(true);
  });

  it("returns missing_credentials when given an empty payload", () => {
    const r = parseAzureSpJson("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_credentials");
  });

  it("returns malformed_json on non-JSON input — never throws", () => {
    const r = parseAzureSpJson("definitely not json {");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("malformed_json");
  });

  it("returns malformed_tenant_id when tenant is not a UUID", () => {
    const r = parseAzureSpJson(JSON.stringify({ ...JSON.parse(SDK_AUTH_JSON), tenantId: "not-a-uuid" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("malformed_tenant_id");
  });

  it("returns malformed_subscription_id when subscription is not a UUID", () => {
    const r = parseAzureSpJson(JSON.stringify({ ...JSON.parse(SDK_AUTH_JSON), subscriptionId: "nope" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("malformed_subscription_id");
  });

  it("returns malformed_client_id when client id is not a UUID", () => {
    const r = parseAzureSpJson(JSON.stringify({ ...JSON.parse(SDK_AUTH_JSON), clientId: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("malformed_client_id");
  });

  it("returns missing_client_secret when secret is empty", () => {
    const r = parseAzureSpJson(JSON.stringify({ ...JSON.parse(SDK_AUTH_JSON), clientSecret: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_client_secret");
  });

  it("every error path returns a hint string a customer can act on", () => {
    const cases = ["", "not json", "{}", JSON.stringify({ tenantId: "no" })];
    for (const c of cases) {
      const r = parseAzureSpJson(c);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(typeof r.hint).toBe("string");
        expect(r.hint.length).toBeGreaterThan(10);
      }
    }
  });
});

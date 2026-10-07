import { describe, expect, it } from "vitest";
import { evaluateSsoSignIn, type SsoSignInRepo, type SsoProviderRow } from "../ssoSignInGate";

function makeRepo(rows: SsoProviderRow[]): SsoSignInRepo {
  return { tenantIdentityProvider: { async findMany() { return rows; } } };
}

const BASE_PROVIDER: SsoProviderRow = {
  organizationId: "org_1",
  protocol: "oidc",
  status: "active",
  issuerOrEntityId: "https://idp.acme.com",
  managedDomains: ["acme.com"],
  roleMappingJson: [{ claimKey: "cognito:groups", claimValue: "admins", role: "admin" }],
  requireMfaClaim: false,
};

describe("evaluateSsoSignIn", () => {
  it("denies when no provider's managedDomains cover this email's domain", async () => {
    const result = await evaluateSsoSignIn(makeRepo([BASE_PROVIDER]), { email: "a@other.com", claims: {} });
    expect(result).toEqual({ kind: "denied", reason: "sso.no_provider_for_domain" });
  });

  it("denies with sso.no_role_mapping when the domain matches but no claim rule fires — never grants a default role", async () => {
    const result = await evaluateSsoSignIn(makeRepo([BASE_PROVIDER]), { email: "a@acme.com", claims: { iss: BASE_PROVIDER.issuerOrEntityId, "cognito:groups": ["engineers"] } });
    expect(result).toEqual({ kind: "denied", reason: "sso.no_role_mapping" });
  });

  it("matches and maps the role when a claim rule fires", async () => {
    const result = await evaluateSsoSignIn(makeRepo([BASE_PROVIDER]), { email: "a@acme.com", claims: { iss: BASE_PROVIDER.issuerOrEntityId, "cognito:groups": ["admins"] } });
    expect(result).toEqual({ kind: "matched", organizationId: "org_1", role: "admin" });
  });

  it("denies with sso.mfa_required_not_present when MFA is required and absent from the claims, even with a valid role match", async () => {
    const mfaProvider = { ...BASE_PROVIDER, requireMfaClaim: true };
    const result = await evaluateSsoSignIn(makeRepo([mfaProvider]), { email: "a@acme.com", claims: { iss: BASE_PROVIDER.issuerOrEntityId, "cognito:groups": ["admins"] } });
    expect(result).toEqual({ kind: "denied", reason: "sso.mfa_required_not_present" });
  });

  it("matches when MFA is required and the amr claim proves it happened", async () => {
    const mfaProvider = { ...BASE_PROVIDER, requireMfaClaim: true };
    const result = await evaluateSsoSignIn(makeRepo([mfaProvider]), { email: "a@acme.com", claims: { iss: BASE_PROVIDER.issuerOrEntityId, amr: ["mfa"], "cognito:groups": ["admins"] } });
    expect(result).toEqual({ kind: "matched", organizationId: "org_1", role: "admin" });
  });

  it("fails closed when the matching provider has malformed role mapping", async () => {
    const malformed = { ...BASE_PROVIDER, roleMappingJson: "not-an-array" };
    const result = await evaluateSsoSignIn(makeRepo([malformed]), { email: "a@acme.com", claims: {} });
    expect(result).toEqual({ kind: "denied", reason: "sso.no_provider_for_domain" });
  });

  it("is case-insensitive on the email domain", async () => {
    const result = await evaluateSsoSignIn(makeRepo([BASE_PROVIDER]), { email: "a@ACME.COM", claims: { iss: BASE_PROVIDER.issuerOrEntityId, "cognito:groups": ["admins"] } });
    expect(result).toEqual({ kind: "matched", organizationId: "org_1", role: "admin" });
  });

  it("denies an OIDC token whose trusted issuer does not match the tenant provider", async () => {
    const result = await evaluateSsoSignIn(makeRepo([BASE_PROVIDER]), {
      email: "a@acme.com",
      claims: { iss: "https://attacker.example", "cognito:groups": ["admins"] },
    });
    expect(result).toEqual({ kind: "denied", reason: "sso.issuer_mismatch" });
  });
});

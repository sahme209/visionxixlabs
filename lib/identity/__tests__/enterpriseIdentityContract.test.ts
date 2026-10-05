import { describe, expect, it } from "vitest";
import {
  evaluateMfaClaim,
  mapClaimsToRole,
  resolveIdentityProviderForEmail,
  type IdentityProviderConfig,
} from "../enterpriseIdentityContract";

function provider(overrides: Partial<IdentityProviderConfig> = {}): IdentityProviderConfig {
  return {
    organizationId: "org-1",
    protocol: "oidc",
    status: "active",
    issuerOrEntityId: "https://idp.acme.test",
    managedDomains: ["acme.test"],
    roleMapping: [{ claimKey: "groups", claimValue: "axiom-admins", role: "admin" }],
    requireMfaClaim: true,
    ...overrides,
  };
}

describe("resolveIdentityProviderForEmail — domain routing, never user choice", () => {
  it("matches the active provider whose managedDomains covers the email domain", () => {
    const result = resolveIdentityProviderForEmail("sam@acme.test", [provider()]);
    expect(result?.organizationId).toBe("org-1");
  });

  it("is case-insensitive on the domain", () => {
    const result = resolveIdentityProviderForEmail("sam@ACME.TEST", [provider()]);
    expect(result).not.toBeNull();
  });

  it("falls through to null (password/OAuth) when no provider matches — not an error", () => {
    const result = resolveIdentityProviderForEmail("sam@other-company.test", [provider()]);
    expect(result).toBeNull();
  });

  it("never matches a revoked or pending provider, even if the domain matches", () => {
    expect(resolveIdentityProviderForEmail("sam@acme.test", [provider({ status: "revoked" })])).toBeNull();
    expect(resolveIdentityProviderForEmail("sam@acme.test", [provider({ status: "pending" })])).toBeNull();
  });

  it("never matches tenant B's provider for tenant A's domain — prevents IdP-mixing", () => {
    const providers = [
      provider({ organizationId: "org-A", managedDomains: ["acme.test"] }),
      provider({ organizationId: "org-B", managedDomains: ["other.test"] }),
    ];
    const result = resolveIdentityProviderForEmail("user@acme.test", providers);
    expect(result?.organizationId).toBe("org-A");
  });
});

describe("mapClaimsToRole — first match wins, no match is a hard denial", () => {
  const rules = [
    { claimKey: "groups", claimValue: "axiom-owners", role: "owner" },
    { claimKey: "groups", claimValue: "axiom-admins", role: "admin" },
  ];

  it("maps a matching group claim to its configured role", () => {
    const result = mapClaimsToRole({ groups: ["axiom-admins", "everyone"] }, rules);
    expect(result).toEqual({ ok: true, role: "admin" });
  });

  it("matches the first rule in order when multiple could apply", () => {
    const result = mapClaimsToRole({ groups: ["axiom-owners", "axiom-admins"] }, rules);
    expect(result).toEqual({ ok: true, role: "owner" });
  });

  it("never defaults to any role when nothing matches — a hard denial, not read_only", () => {
    const result = mapClaimsToRole({ groups: ["unrelated-group"] }, rules);
    expect(result).toEqual({ ok: false, reason: "no_role_mapping" });
  });

  it("denies when the claim is entirely absent from the token", () => {
    const result = mapClaimsToRole({}, rules);
    expect(result).toEqual({ ok: false, reason: "no_role_mapping" });
  });

  it("supports a scalar (non-array) claim value too", () => {
    const result = mapClaimsToRole({ role: "axiom-admins" }, [{ claimKey: "role", claimValue: "axiom-admins", role: "admin" }]);
    expect(result).toEqual({ ok: true, role: "admin" });
  });
});

describe("evaluateMfaClaim — fail closed, never silently downgrade", () => {
  it("passes unconditionally when the tenant doesn't require MFA", () => {
    expect(evaluateMfaClaim({}, false)).toEqual({ ok: true });
  });

  it("passes when amr indicates a real MFA method", () => {
    expect(evaluateMfaClaim({ amr: ["pwd", "otp"] }, true)).toEqual({ ok: true });
  });

  it("passes when acr indicates MFA", () => {
    expect(evaluateMfaClaim({ acr: "urn:mfa:hardware" }, true)).toEqual({ ok: true });
  });

  it("fails closed when MFA is required and neither claim indicates it", () => {
    expect(evaluateMfaClaim({ amr: ["pwd"] }, true)).toEqual({ ok: false, reason: "sso.mfa_required_not_present" });
  });

  it("fails closed when MFA is required and no claims are present at all", () => {
    expect(evaluateMfaClaim({}, true)).toEqual({ ok: false, reason: "sso.mfa_required_not_present" });
  });
});

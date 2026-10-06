/**
 * Enterprise identity — concrete interface contracts.
 *
 * Turns docs/ENTERPRISE_IDENTITY_DESIGN.md's prose into real,
 * implementable, testable TypeScript. Pure logic only — no network
 * call, no SAML/OIDC client, no real identity provider. Nothing here
 * makes SSO live; it is the decision logic a real sign-in route would
 * call once an actual TenantIdentityProvider row and a real
 * assertion/token exist.
 */

export type IdentityProviderProtocol = "oidc" | "saml";

/** Mirrors the TenantIdentityProvider shape proposed in the design doc. */
export interface IdentityProviderConfig {
  organizationId: string;
  protocol: IdentityProviderProtocol;
  status: "pending" | "active" | "needs_attention" | "revoked";
  issuerOrEntityId: string;
  managedDomains: readonly string[];
  roleMapping: readonly RoleMappingRule[];
  requireMfaClaim: boolean;
}

export interface RoleMappingRule {
  /** The IdP claim/group key to inspect, e.g. "groups" or "role". */
  claimKey: string;
  /** The exact value that must be present for this rule to match. */
  claimValue: string;
  /** The OrgRole to assign when this rule matches. */
  role: string;
}

/**
 * Domain-routing: look up the active identity provider whose
 * managedDomains covers this email's domain. A user never picks a
 * provider — picking by domain prevents IdP-mixing attacks where a
 * malicious or compromised IdP for tenant A claims to speak for tenant
 * B's users.
 *
 * Returns null (not an error) when no provider matches — the caller
 * falls through to password/OAuth sign-in unchanged, which is the
 * correct, intentional default.
 */
export function resolveIdentityProviderForEmail(
  email: string,
  providers: readonly IdentityProviderConfig[],
): IdentityProviderConfig | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;
  const match = providers.find(
    (p) => p.status === "active" && p.managedDomains.some((d) => d.toLowerCase() === domain),
  );
  return match ?? null;
}

export type RoleMappingResult =
  | { ok: true; role: string }
  | { ok: false; reason: "no_role_mapping" };

/**
 * Maps IdP claims to an OrgRole using the tenant's configured rules,
 * in order — first match wins. No match is a hard denial, never a
 * default role. This is deliberate: an unmapped claim set must never
 * silently grant read_only (or any other) access, because that would
 * let a misconfigured or evolving IdP group scheme quietly create
 * access nobody explicitly authorized.
 */
export function mapClaimsToRole(
  claims: Readonly<Record<string, unknown>>,
  rules: readonly RoleMappingRule[],
): RoleMappingResult {
  for (const rule of rules) {
    const claimValue = claims[rule.claimKey];
    const matches = Array.isArray(claimValue)
      ? claimValue.includes(rule.claimValue)
      : claimValue === rule.claimValue;
    if (matches) return { ok: true, role: rule.role };
  }
  return { ok: false, reason: "no_role_mapping" };
}

export type MfaClaimResult =
  | { ok: true }
  | { ok: false; reason: "sso.mfa_required_not_present" };

/**
 * Checks the standard OIDC `amr` (authentication methods references) /
 * `acr` (authentication context class reference) claims for evidence
 * MFA was performed at the IdP. If the tenant doesn't require it,
 * passes unconditionally. If it does and neither claim indicates MFA,
 * fails closed with a named reason — never silently downgrades to
 * single-factor.
 */
export function evaluateMfaClaim(
  claims: Readonly<{ amr?: readonly string[]; acr?: string }>,
  requireMfa: boolean,
): MfaClaimResult {
  if (!requireMfa) return { ok: true };
  const amrIndicatesMfa = Array.isArray(claims.amr)
    && claims.amr.some((m) => m === "mfa" || m === "otp" || m === "hwk" || m === "sms");
  const acrIndicatesMfa = typeof claims.acr === "string" && claims.acr.toLowerCase().includes("mfa");
  if (amrIndicatesMfa || acrIndicatesMfa) return { ok: true };
  return { ok: false, reason: "sso.mfa_required_not_present" };
}

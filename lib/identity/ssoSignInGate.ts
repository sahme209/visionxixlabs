/**
 * The real sign-in-time decision point for docs/ENTERPRISE_IDENTITY_DESIGN.md's
 * domain-routing + role-mapping + MFA-claim steps. Domain-routing here means
 * "does this email's domain match a configured TenantIdentityProvider" —
 * not yet "redirect to that tenant's own IdP before authentication" (that
 * needs a custom OIDC client outside NextAuth's static provider model,
 * described as future work in the design doc). This runs *after*
 * authentication already happened via whichever IdP NextAuth used
 * (Cognito today), and decides which tenant + role the authenticated
 * identity maps to.
 *
 * Fail-closed per the design doc's non-negotiable principles: no matching
 * provider falls through to the caller's existing default (e.g. personal
 * workspace bootstrap) unchanged. A matching provider with no role-mapping
 * hit, or with MFA required but absent, is a hard sign-in denial — never a
 * default/weaker role.
 */

import "server-only";

import { resolveIdentityProviderForEmail, mapClaimsToRole, evaluateMfaClaim, type IdentityProviderConfig, type RoleMappingRule } from "./enterpriseIdentityContract";

export interface SsoProviderRow {
  organizationId: string;
  protocol: string;
  status: string;
  issuerOrEntityId: string;
  managedDomains: string[];
  roleMappingJson: unknown;
  requireMfaClaim: boolean;
}

export interface SsoSignInRepo {
  tenantIdentityProvider: {
    findMany(args: { where: { status: "active" } }): Promise<SsoProviderRow[]>;
  };
}

export type SsoGateResult =
  | { kind: "no_match" }
  | { kind: "denied"; reason: "sso.no_role_mapping" | "sso.mfa_required_not_present" }
  | { kind: "matched"; organizationId: string; role: string };

function isRoleMappingRuleArray(value: unknown): value is RoleMappingRule[] {
  return Array.isArray(value) && value.every((r) => r && typeof r === "object" && "claimKey" in r && "claimValue" in r && "role" in r);
}

export async function evaluateSsoSignIn(
  repo: SsoSignInRepo,
  input: { email: string; claims: Record<string, unknown> },
): Promise<SsoGateResult> {
  const rows = await repo.tenantIdentityProvider.findMany({ where: { status: "active" } });
  const providers: IdentityProviderConfig[] = rows
    .filter((r) => isRoleMappingRuleArray(r.roleMappingJson))
    .map((r) => ({
      organizationId: r.organizationId,
      protocol: r.protocol as IdentityProviderConfig["protocol"],
      status: r.status as IdentityProviderConfig["status"],
      issuerOrEntityId: r.issuerOrEntityId,
      managedDomains: r.managedDomains,
      roleMapping: r.roleMappingJson as RoleMappingRule[],
      requireMfaClaim: r.requireMfaClaim,
    }));

  const match = resolveIdentityProviderForEmail(input.email, providers);
  if (!match) return { kind: "no_match" };

  const mfaResult = evaluateMfaClaim(
    { amr: Array.isArray(input.claims.amr) ? (input.claims.amr as string[]) : undefined, acr: typeof input.claims.acr === "string" ? input.claims.acr : undefined },
    match.requireMfaClaim,
  );
  if (!mfaResult.ok) return { kind: "denied", reason: mfaResult.reason };

  const roleResult = mapClaimsToRole(input.claims, match.roleMapping);
  if (!roleResult.ok) return { kind: "denied", reason: "sso.no_role_mapping" };

  return { kind: "matched", organizationId: match.organizationId, role: roleResult.role };
}

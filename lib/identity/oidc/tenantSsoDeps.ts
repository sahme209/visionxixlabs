import "server-only";
import { prisma } from "@/lib/db";
import { decryptScopedCredential, encryptScopedCredential } from "@/lib/security/credentialVault";
import { claimOrganizationSeat, type OrganizationSeatClaimRepo } from "@/lib/billing/organizationSeatClaim";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { newCorrelationId } from "@/lib/domain/ids";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";
import { canonicalAuthOrigin } from "@/lib/auth/canonicalAuthOrigin";
import type { SsoDeps } from "./tenantSsoService";

/** Production wiring for company sign-in. */
export function tenantSsoDeps(): SsoDeps {
  return {
    db: prisma as unknown as SsoDeps["db"],
    encrypt: encryptScopedCredential,
    decrypt: decryptScopedCredential,
    claimSeat: (input) => claimOrganizationSeat(prisma as unknown as OrganizationSeatClaimRepo, input),
    async denied({ email, reason }) {
      try {
        await recordAudit({
          organizationId: deriveWorkspaceIdFromEmail(email), actorKind: "user", action: "auth.failed", outcome: "blocked",
          entityRef: `user:${email}`, correlationId: newCorrelationId(), source: "live", errorCode: reason, detail: { provider: "tenant-oidc" },
        });
      } catch { /* best-effort audit */ }
    },
  };
}

/** V19's own canonical origin (never taken from request headers). */
export function ssoOrigin(): string | null {
  return canonicalAuthOrigin(process.env.NEXTAUTH_URL);
}

/** The one redirect URI every company registers with its identity provider. */
export function ssoRedirectUri(): string | null {
  const origin = canonicalAuthOrigin(process.env.NEXTAUTH_URL);
  return origin ? `${origin}/api/sso/oidc/callback` : null;
}

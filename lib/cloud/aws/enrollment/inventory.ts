import "server-only";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import type { EnrollmentRepo, EnrollmentPrincipal } from "./service";
import { readEnrollmentInventory } from "./stsValidation";
import { withTenantAwsConnection } from "./scopedConnection";

export async function readTenantAwsInventory(repo: EnrollmentRepo, principal: EnrollmentPrincipal, accountId: string, dependencies: { now?: () => Date; open?: typeof decryptScopedCredential; read?: typeof readEnrollmentInventory } = {}) {
  return withTenantAwsConnection(repo, principal, accountId, input => (dependencies.read ?? readEnrollmentInventory)(input), dependencies);
}

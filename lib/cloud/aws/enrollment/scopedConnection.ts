import "server-only";
import { randomBytes } from "node:crypto";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import { hasDesktopCapability } from "@/lib/desktop/desktopAuthorization";
import { AwsEnrollmentError, cloudCredentialContext, parseAwsEnrollmentInput } from "./policy";
import type { EnrollmentPrincipal, EnrollmentRepo } from "./service";
import type { TargetSnapshotRows } from "@/lib/releaseops/ecsReleaseV2/targetSnapshot";
import { readEnrollmentInventory } from "./stsValidation";

export async function withTenantAwsConnection<T>(repo: EnrollmentRepo, principal: EnrollmentPrincipal, accountId: string, operation: (input: Parameters<typeof readEnrollmentInventory>[0], connection: { id: string; version: number }, snapshot: Pick<TargetSnapshotRows, "account" | "credential">) => Promise<T>, dependencies: {
  now?: () => Date;
  open?: typeof decryptScopedCredential;
  managementOnly?: boolean;
} = {}) {
  const now = dependencies.now ?? (() => new Date());
  async function authority() {
    const device = await repo.desktopSessionRecord.findUnique({ where: { id: principal.sessionId } });
    const membership = await repo.orgMembership.findUnique({ where: { userId_organizationId: { userId: principal.userId, organizationId: principal.organizationId } } });
    if (!device || device.revokedAt || device.expiresAt <= now() || device.userId !== principal.userId || device.organizationId !== principal.organizationId || !membership?.acceptedAt || !["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"].includes(membership.role) || !hasDesktopCapability(membership.role, "workspace:read") || (dependencies.managementOnly && !["owner", "admin"].includes(membership.role))) throw new AwsEnrollmentError("connection_authority_required");
  }
  await authority();
  const accounts = await repo.cloudAccount.findMany({ where: { id: accountId, organizationId: principal.organizationId, provider: "aws" }, take: 1 });
  const account = accounts[0] ? structuredClone(accounts[0]) : null;
  if (!account || account.id !== accountId || account.organizationId !== principal.organizationId || account.provider !== "aws" || account.credentialRef !== `cloud-v2:${account.id}`) throw new AwsEnrollmentError("enrollment_not_found");
  const storedCredential = await repo.cloudAccountCredential.findUnique({ where: { id: account.id } });
  const credential = storedCredential ? structuredClone(storedCredential) : null;
  if (!credential || credential.organizationId !== principal.organizationId || !Number.isSafeInteger(credential.version) || credential.version < 1) throw new AwsEnrollmentError("enrollment_unavailable");
  if (credential.revokedAt) throw new AwsEnrollmentError("connection_disconnected");
  let configuration;
  try {
    configuration = JSON.parse((dependencies.open ?? decryptScopedCredential)(credential.encryptedConfiguration, cloudCredentialContext({ organizationId: principal.organizationId, accountId: account.id, version: credential.version }))) as unknown;
  } catch { throw new AwsEnrollmentError("enrollment_unavailable"); }
  if (!configuration || typeof configuration !== "object") throw new AwsEnrollmentError("enrollment_unavailable");
  const stored = configuration as Record<string, unknown>;
  const parsed = parseAwsEnrollmentInput({ expectedAccountId: stored.expectedAccountId, roleArn: stored.roleArn, region: stored.region });
  if (parsed.expectedAccountId !== account.externalAccountId || !account.regions.includes(parsed.region) || typeof stored.externalId !== "string" || !/^axiom-[a-f0-9]{32}$/.test(stored.externalId)) throw new AwsEnrollmentError("enrollment_unavailable");
  const result = await operation({ ...parsed, externalId: stored.externalId, sessionName: `axiom-inventory-${randomBytes(10).toString("hex")}` }, { id: account.id, version: credential.version }, {
    account: { id: account.id, organizationId: account.organizationId, provider: account.provider, externalAccountId: account.externalAccountId, credentialRef: account.credentialRef, regions: [...account.regions], enabled: account.enabled, updatedAt: new Date(account.updatedAt) },
    credential: { id: credential.id, organizationId: credential.organizationId, version: credential.version, revokedAt: credential.revokedAt },
  });
  await authority();
  // Never deliver a late inventory from a replaced connection/vault revision.
  const currentAccounts = await repo.cloudAccount.findMany({ where: { id: accountId, organizationId: principal.organizationId, provider: "aws" }, take: 1 });
  const currentAccount = currentAccounts[0];
  if (!currentAccount || currentAccount.id !== account.id || currentAccount.organizationId !== account.organizationId || currentAccount.provider !== account.provider || currentAccount.externalAccountId !== account.externalAccountId || currentAccount.credentialRef !== account.credentialRef || currentAccount.enabled !== account.enabled || currentAccount.updatedAt.getTime() !== account.updatedAt.getTime() || JSON.stringify(currentAccount.regions) !== JSON.stringify(account.regions)) throw new AwsEnrollmentError("enrollment_conflict");
  const current = await repo.cloudAccountCredential.findUnique({ where: { id: account.id } });
  if (!current || current.organizationId !== principal.organizationId || current.revokedAt || current.version !== credential.version) throw new AwsEnrollmentError("enrollment_conflict");
  return result;
}

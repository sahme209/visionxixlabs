import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { checkEntitlement } from "@/lib/billing/checkEntitlement";
import { planForStripeTier } from "@/lib/billing/planRegistry";
import { isBillingTier } from "@/lib/billing/tierCatalog";
import { hasDesktopCapability, type DesktopWorkspaceRole } from "@/lib/desktop/desktopAuthorization";
import { AwsEnrollmentError, cloudCredentialContext, externalIdDigest, matchesExternalId, parseAwsEnrollmentInput, type AwsEnrollmentInput } from "./policy";
import { assertAwsEnrollmentConfigured, validateEnrollmentRole } from "./stsValidation";

interface Delegate<Row> {
  findUnique(args: Record<string, unknown>): Promise<Row | null>;
  findMany(args: Record<string, unknown>): Promise<Row[]>;
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
}
export interface CloudAccountRow { id: string; organizationId: string; provider: string; externalAccountId: string; alias: string | null; credentialRef: string | null; regions: string[]; enabled: boolean; updatedAt: Date }
export interface CloudCredentialRow { id: string; organizationId: string; encryptedConfiguration: string; version: number; validatedAt: Date }
export interface EnrollmentAttemptRow extends AwsEnrollmentInput { id: string; organizationId: string; userId: string; externalIdDigest: string; expiresAt: Date; consumedAt: Date | null; expectedCredentialVersion: number | null; expectedAccountUpdatedAt: Date | null; cloudAccountId: string | null }
export interface EnrollmentRepo {
  cloudAccount: Delegate<CloudAccountRow> & { count(args: { where: { organizationId: string } }): Promise<number> };
  tenantBillingPlan: { findUnique(args: { where: { organizationId: string } }): Promise<{ organizationId: string; tier: string; status: string } | null> };
  cloudAccountCredential: Delegate<CloudCredentialRow>;
  cloudAccountEnrollmentAttempt: Delegate<EnrollmentAttemptRow>;
  desktopSessionRecord: { findUnique(args: Record<string, unknown>): Promise<{ id: string; userId: string; organizationId: string; expiresAt: Date; revokedAt: Date | null } | null> };
  orgMembership: { findUnique(args: Record<string, unknown>): Promise<{ acceptedAt: Date | null; role: DesktopWorkspaceRole } | null> };
  $transaction<T>(operation: (tx: EnrollmentRepo) => Promise<T>, options?: { isolationLevel: "Serializable" }): Promise<T>;
}
export interface EnrollmentPrincipal { organizationId: string; userId: string; sessionId: string }
export interface EnrollmentDependencies {
  now: () => Date;
  randomId: () => string;
  randomExternalId: () => string;
  configured: () => void;
  validate: (input: AwsEnrollmentInput & { externalId: string; sessionName: string }) => Promise<{ accountId: string; assumedRoleArn: string }>;
  seal: (plain: string, context: string) => string;
  audit: (input: { organizationId: string; userId: string; accountId: string }) => Promise<void>;
}
const defaults: EnrollmentDependencies = { now: () => new Date(), randomId: randomUUID, randomExternalId: () => `axiom-${randomBytes(16).toString("hex")}`, configured: assertAwsEnrollmentConfigured, validate: validateEnrollmentRole, seal: encryptScopedCredential, audit: async () => {} };
export function createAwsEnrollmentService(repo: EnrollmentRepo, supplied: Partial<EnrollmentDependencies> = {}) {
  const deps = { ...defaults, ...supplied };
  async function requireAuthority(tx: EnrollmentRepo, principal: EnrollmentPrincipal) {
    const device = await tx.desktopSessionRecord.findUnique({ where: { id: principal.sessionId } });
    if (!device || device.revokedAt || device.expiresAt <= deps.now() || device.userId !== principal.userId || device.organizationId !== principal.organizationId) throw new AwsEnrollmentError("connection_authority_required");
    const membership = await tx.orgMembership.findUnique({ where: { userId_organizationId: { userId: principal.userId, organizationId: principal.organizationId } }, select: { acceptedAt: true, role: true } });
    if (!membership?.acceptedAt || !["owner", "admin"].includes(membership.role) || !hasDesktopCapability(membership.role, "connections:manage")) throw new AwsEnrollmentError("connection_authority_required");
  }
  async function storageReady(organizationId: string) {
    // Required tables must exist before a provider request or false connection state.
    await repo.cloudAccount.findMany({ where: { organizationId }, select: { id: true }, take: 1 });
    await repo.cloudAccountCredential.findMany({ where: { organizationId }, select: { id: true }, take: 1 });
    await repo.cloudAccountEnrollmentAttempt.findMany({ where: { organizationId }, select: { id: true }, take: 1 });
  }
  async function requireAccountCapacity(tx: EnrollmentRepo, organizationId: string, existing: boolean) {
    // Revalidation changes no resource count, even after a plan downgrade.
    if (existing) return;
    let row;
    let currentUsage;
    try {
      row = await tx.tenantBillingPlan.findUnique({ where: { organizationId } });
      currentUsage = await tx.cloudAccount.count({ where: { organizationId } });
    } catch { throw new AwsEnrollmentError("enrollment_unavailable"); }
    if ((row && row.organizationId !== organizationId) || !Number.isSafeInteger(currentUsage) || currentUsage < 0) throw new AwsEnrollmentError("enrollment_unavailable");
    // Match readBillingPlan's validated tier/status shaping without its
    // read-error sentinel: absent/invalid/trial rows use canonical Starter.
    const validStatus = row && ["trialing", "active", "past_due", "canceled", "no_plan"].includes(row.status);
    const tier = row && isBillingTier(row.tier) && validStatus && row.tier !== "trial" && row.status !== "trialing" ? row.tier : "trial";
    const decision = checkEntitlement({ plan: planForStripeTier(tier), dimension: "cloud_accounts", currentUsage, attemptedDelta: 1 });
    if (decision.kind !== "allow") throw new AwsEnrollmentError("cloud_account_limit_reached");
  }
  const accountKey = (organizationId: string, accountId: string) => ({ organizationId_provider_externalAccountId: { organizationId, provider: "aws", externalAccountId: accountId } });
  async function start(principal: EnrollmentPrincipal, input: unknown) {
    const parsed = parseAwsEnrollmentInput(input);
    deps.configured();
    await requireAuthority(repo, principal);
    await storageReady(principal.organizationId);
    const account = await repo.cloudAccount.findUnique({ where: accountKey(principal.organizationId, parsed.expectedAccountId) });
    const credential = account ? await repo.cloudAccountCredential.findUnique({ where: { id: account.id } }) : null;
    if (account && (account.organizationId !== principal.organizationId || account.credentialRef !== `cloud-v2:${account.id}` || account.enabled)) throw new AwsEnrollmentError("enrollment_conflict");
    if (credential && (credential.organizationId !== principal.organizationId || credential.version < 1)) throw new AwsEnrollmentError("enrollment_conflict");
    await requireAccountCapacity(repo, principal.organizationId, Boolean(account));
    const externalId = deps.randomExternalId();
    const expiresAt = new Date(deps.now().getTime() + 10 * 60_000);
    const attempt = await repo.cloudAccountEnrollmentAttempt.create({ data: {
      id: deps.randomId(), organizationId: principal.organizationId, userId: principal.userId, ...parsed, externalIdDigest: externalIdDigest(externalId), expiresAt,
      cloudAccountId: account?.id ?? null, expectedAccountUpdatedAt: account?.updatedAt ?? null, expectedCredentialVersion: credential?.version ?? null,
    } });
    return { attemptId: attempt.id, externalId, expiresAt: expiresAt.toISOString(), ...parsed };
  }
  function assertAttempt(attempt: EnrollmentAttemptRow | null, principal: EnrollmentPrincipal, externalId: unknown, now: Date): asserts attempt is EnrollmentAttemptRow {
    if (!attempt || attempt.organizationId !== principal.organizationId || attempt.userId !== principal.userId) throw new AwsEnrollmentError("enrollment_not_found");
    if (attempt.consumedAt) throw new AwsEnrollmentError("enrollment_conflict");
    if (attempt.expiresAt <= now) throw new AwsEnrollmentError("enrollment_expired");
    if (!matchesExternalId(externalId, attempt.externalIdDigest)) throw new AwsEnrollmentError("invalid_input");
  }
  async function complete(principal: EnrollmentPrincipal, attemptId: string, externalId: unknown) {
    deps.configured();
    await requireAuthority(repo, principal);
    await storageReady(principal.organizationId);
    const observedAttempt = await repo.cloudAccountEnrollmentAttempt.findUnique({ where: { id: attemptId } });
    const attempt = observedAttempt ? structuredClone(observedAttempt) : null;
    assertAttempt(attempt, principal, externalId, deps.now());
    await requireAccountCapacity(repo, principal.organizationId, Boolean(attempt.cloudAccountId));
    const parsed = parseAwsEnrollmentInput({ expectedAccountId: attempt.expectedAccountId, roleArn: attempt.roleArn, region: attempt.region });
    const identity = await deps.validate({ ...parsed, externalId: externalId as string, sessionName: `axiom-enroll-${randomBytes(12).toString("hex")}` });
    if (identity.accountId !== attempt.expectedAccountId) throw new AwsEnrollmentError("aws_identity_unverified");
    const account = await repo.$transaction(async (tx) => {
      // Fresh authority and clock after external IO; old device authority and challenge time cannot extend permission.
      await requireAuthority(tx, principal);
      const now = deps.now();
      const currentAttempt = await tx.cloudAccountEnrollmentAttempt.findUnique({ where: { id: attempt.id } });
      assertAttempt(currentAttempt, principal, externalId, now);
      if (currentAttempt.expiresAt.getTime() !== attempt.expiresAt.getTime() || currentAttempt.externalIdDigest !== attempt.externalIdDigest || currentAttempt.roleArn !== attempt.roleArn || currentAttempt.expectedAccountId !== attempt.expectedAccountId || currentAttempt.region !== attempt.region || currentAttempt.cloudAccountId !== attempt.cloudAccountId || currentAttempt.expectedCredentialVersion !== attempt.expectedCredentialVersion || currentAttempt.expectedAccountUpdatedAt?.getTime() !== attempt.expectedAccountUpdatedAt?.getTime()) throw new AwsEnrollmentError("enrollment_conflict");
      const existing = await tx.cloudAccount.findUnique({ where: accountKey(principal.organizationId, attempt.expectedAccountId) });
      if ((existing?.id ?? null) !== attempt.cloudAccountId || (existing?.updatedAt.getTime() ?? null) !== (attempt.expectedAccountUpdatedAt?.getTime() ?? null) || (existing && (existing.enabled || existing.credentialRef !== `cloud-v2:${existing.id}`))) throw new AwsEnrollmentError("enrollment_conflict");
      const existingCredential = existing ? await tx.cloudAccountCredential.findUnique({ where: { id: existing.id } }) : null;
      if ((existingCredential?.version ?? null) !== attempt.expectedCredentialVersion || (existingCredential && existingCredential.organizationId !== principal.organizationId)) throw new AwsEnrollmentError("enrollment_conflict");
      // This predicate read and insertion share Serializable isolation, so
      // concurrent different-account claims cannot both consume the last slot.
      await requireAccountCapacity(tx, principal.organizationId, Boolean(existing));
      const claim = await tx.cloudAccountEnrollmentAttempt.updateMany({ where: { id: attempt.id, organizationId: principal.organizationId, userId: principal.userId, consumedAt: null, expiresAt: { gt: now }, externalIdDigest: attempt.externalIdDigest }, data: { consumedAt: now } });
      if (claim.count !== 1) throw new AwsEnrollmentError("enrollment_conflict");
      const accountId = existing?.id ?? deps.randomId();
      const version = (existingCredential?.version ?? 0) + 1;
      const encryptedConfiguration = deps.seal(JSON.stringify({ roleArn: attempt.roleArn, externalId, region: attempt.region, expectedAccountId: attempt.expectedAccountId }), cloudCredentialContext({ organizationId: principal.organizationId, accountId, version }));
      let saved = existing;
      if (!saved) saved = await tx.cloudAccount.create({ data: { id: accountId, organizationId: principal.organizationId, provider: "aws", externalAccountId: attempt.expectedAccountId, credentialRef: `cloud-v2:${accountId}`, regions: [attempt.region], autopilotMode: "observe_only", enabled: false } });
      else {
        const updated = await tx.cloudAccount.updateMany({ where: { id: accountId, organizationId: principal.organizationId, updatedAt: attempt.expectedAccountUpdatedAt, enabled: false }, data: { regions: [attempt.region], updatedAt: now } });
        if (updated.count !== 1) throw new AwsEnrollmentError("enrollment_conflict");
        saved = { ...saved, regions: [attempt.region], updatedAt: now };
      }
      if (existingCredential) {
        const updated = await tx.cloudAccountCredential.updateMany({ where: { id: accountId, organizationId: principal.organizationId, version: attempt.expectedCredentialVersion }, data: { encryptedConfiguration, version, validatedAt: now } });
        if (updated.count !== 1) throw new AwsEnrollmentError("enrollment_conflict");
      } else await tx.cloudAccountCredential.create({ data: { id: accountId, organizationId: principal.organizationId, encryptedConfiguration, version, validatedAt: now } });
      return accountSummary(saved, { validatedAt: now } );
    }, { isolationLevel: "Serializable" });
    try { await deps.audit({ ...principal, accountId: account.id }); } catch { /* best effort; never include configuration */ }
    return { account };
  }
  async function list(organizationId: string) {
    await storageReady(organizationId);
    const accounts = await repo.cloudAccount.findMany({ where: { organizationId, provider: "aws", enabled: false }, orderBy: { createdAt: "desc" }, take: 100 });
    const summaries = [];
    for (const account of accounts) {
      if (account.enabled || account.organizationId !== organizationId || account.credentialRef !== `cloud-v2:${account.id}`) continue;
      const credential = await repo.cloudAccountCredential.findUnique({ where: { id: account.id } });
      if (!credential || credential.organizationId !== organizationId) continue;
      summaries.push(accountSummary(account, credential));
    }
    return { accounts: summaries };
  }
  return { start, complete, list };
}
function accountSummary(account: CloudAccountRow, credential: { validatedAt: Date }) {
  return { id: account.id, provider: "aws" as const, accountId: account.externalAccountId, alias: account.alias ?? null, regions: account.regions, connected: true, status: "connected" as const, lastValidatedAt: credential.validatedAt.toISOString(), enabled: false, agentScanAvailable: false, inventoryAvailability: "not_checked" as const };
}

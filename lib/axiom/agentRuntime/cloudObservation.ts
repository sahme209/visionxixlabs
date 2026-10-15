import "server-only";
import { createAwsEnrollmentService, type EnrollmentPrincipal, type EnrollmentRepo } from "@/lib/cloud/aws/enrollment/service";
import { readTenantAwsInventory } from "@/lib/cloud/aws/enrollment/inventory";
import { hasDesktopCapability, type DesktopWorkspaceRole } from "@/lib/desktop/desktopAuthorization";

/** Supplied by the authenticated route, never reconstructed from model args. */
export interface CloudObservationContext {
  principal: EnrollmentPrincipal;
  repo: EnrollmentRepo;
}
import { isBoundedAwsObservation, type BoundedAwsObservation } from "./cloudObservationPolicy";

async function assertAuthority(context: CloudObservationContext) {
  const { repo, principal } = context;
  const device = await repo.desktopSessionRecord.findUnique({ where: { id: principal.sessionId } });
  const membership = await repo.orgMembership.findUnique({ where: { userId_organizationId: { userId: principal.userId, organizationId: principal.organizationId } } });
  const roles: DesktopWorkspaceRole[] = ["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"];
  if (!device || device.userId !== principal.userId || device.organizationId !== principal.organizationId || device.revokedAt || device.expiresAt <= new Date()
    || !membership?.acceptedAt || !roles.includes(membership.role) || !hasDesktopCapability(membership.role, "workspace:read")) throw new Error("cloud_observation_authority_required");
}

export async function executeCloudObservationTool(
  organizationId: string, toolName: "list_cloud_accounts" | "read_aws_inventory", args: Record<string, unknown>, context?: CloudObservationContext,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  if (!context || context.principal.organizationId !== organizationId) return { ok: false, error: "paired_cloud_observation_required" };
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).some(key => toolName === "list_cloud_accounts" || key !== "accountId")
    || (toolName === "read_aws_inventory" && (typeof args.accountId !== "string" || !args.accountId.trim() || args.accountId.length > 128))) return { ok: false, error: "invalid_cloud_observation_args" };
  try {
    await assertAuthority(context);
    if (toolName === "list_cloud_accounts") {
      const result = await createAwsEnrollmentService(context.repo).list(organizationId);
      await assertAuthority(context);
      return { ok: true, result: { kind: "aws_connection_catalog", maximumAccounts: 100, complete: false, accounts: result.accounts.map(account => ({
        id: account.id, accountId: account.accountId, regions: account.regions, connected: account.connected,
        connectionVersion: account.connectionVersion, revokedAt: account.revokedAt,
        agentScanAvailable: false, deploymentAuthority: false,
      })) } };
    }
    const accountId = args.accountId as string;
    const rows = await context.repo.cloudAccount.findMany({ where: { id: accountId, organizationId, provider: "aws", enabled: false }, take: 1 });
    const account = rows[0] ? structuredClone(rows[0]) : null;
    const credential = account ? await context.repo.cloudAccountCredential.findUnique({ where: { id: accountId } }) : null;
    if (!account || account.id !== accountId || account.organizationId !== organizationId || account.provider !== "aws" || account.enabled || account.credentialRef !== `cloud-v2:${accountId}`
      || !credential || credential.organizationId !== organizationId || credential.revokedAt || !Number.isSafeInteger(credential.version) || credential.version < 1) return { ok: false, error: "cloud_observation_unavailable" };
    const version = credential.version;
    const observed = await readTenantAwsInventory(context.repo, context.principal, accountId);
    await assertAuthority(context);
    const currentAccounts = await context.repo.cloudAccount.findMany({ where: { id: accountId, organizationId, provider: "aws", enabled: false }, take: 1 });
    const currentAccount = currentAccounts[0];
    if (!currentAccount || currentAccount.id !== account.id || currentAccount.organizationId !== organizationId || currentAccount.provider !== "aws" || currentAccount.enabled || currentAccount.credentialRef !== account.credentialRef || currentAccount.externalAccountId !== account.externalAccountId || currentAccount.updatedAt.getTime() !== account.updatedAt.getTime() || JSON.stringify(currentAccount.regions) !== JSON.stringify(account.regions)) return { ok: false, error: "cloud_observation_changed" };
    const current = await context.repo.cloudAccountCredential.findUnique({ where: { id: accountId } });
    if (!current || current.organizationId !== organizationId || current.revokedAt || current.version !== version) return { ok: false, error: "cloud_observation_changed" };
    const observation: BoundedAwsObservation = {
      kind: "aws_bounded_observation", connection: { id: accountId, version, revokedAt: null }, provider: "aws", accountId: observed.accountId,
      observedAt: observed.observedAt, source: observed.source,
      coverage: { complete: false, regions: [observed.region], resourceTypes: ["ec2_instance"], maximumResources: 5, pagination: "single_page", truncated: observed.truncated },
      unknown: { costs: true, utilizationMetrics: true, backups: true, otherRegions: true, otherResourceTypes: true }, authority: "observation_only",
      instances: observed.instances.map(instance => ({ instanceId: instance.instanceId, state: instance.state, instanceType: instance.instanceType, availabilityZone: instance.availabilityZone })),
    };
    if (observed.accountId !== account.externalAccountId || !account.regions.includes(observed.region) || !isBoundedAwsObservation(observation)) return { ok: false, error: "invalid_cloud_observation" };
    return { ok: true, result: observation };
  } catch { return { ok: false, error: "cloud_observation_unavailable" }; }
}

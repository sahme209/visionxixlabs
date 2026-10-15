import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ inventory: vi.fn() }));
vi.mock("@/lib/cloud/aws/enrollment/inventory", () => ({ readTenantAwsInventory: mocks.inventory }));
import { createAwsEnrollmentService } from "@/lib/cloud/aws/enrollment/service";
import { fixture, input, principal, externalId } from "@/lib/cloud/aws/enrollment/__tests__/fixture";
import { executeCloudObservationTool } from "../cloudObservation";
import { isBoundedAwsObservation } from "../cloudObservationPolicy";

const sample = { accountId: input.expectedAccountId, region: input.region, source: "live", complete: false, truncated: true,
  observedAt: "2026-10-16T00:00:00Z", instances: [{ instanceId: "i-real", state: "running", instanceType: "m5.large", availabilityZone: "us-east-1a" }] };
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-16T00:00:00Z")); mocks.inventory.mockResolvedValue(sample); });
afterEach(() => { vi.useRealTimers(); });
async function setup() {
  const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies);
  const challenge = await service.start(principal, input); await service.complete(principal, challenge.attemptId, externalId);
  return { f, service, context: { principal, repo: f.typedRepo }, accountId: f.state.account!.id };
}

describe("paired governed AWS observations", () => {
  it("returns real read-service facts with explicit coverage/unknowns, no fabricated snapshot fields", async () => {
    const { context, accountId } = await setup();
    const result = await executeCloudObservationTool(principal.organizationId, "read_aws_inventory", { accountId }, context);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected observation");
    expect(isBoundedAwsObservation(result.result)).toBe(true);
    expect(result.result).toMatchObject({ kind: "aws_bounded_observation", connection: { id: accountId, version: 1, revokedAt: null },
      authority: "observation_only", coverage: { complete: false, pagination: "single_page", maximumResources: 5, regions: [input.region], truncated: true },
      unknown: { costs: true, utilizationMetrics: true, backups: true }, instances: sample.instances });
    expect(result.result).not.toHaveProperty("flags"); expect(result.result).not.toHaveProperty("monthlySpend");
    expect(JSON.stringify(result.result)).not.toContain(externalId);
    expect(mocks.inventory).toHaveBeenCalledWith(context.repo, principal, accountId);
  });
  it("lists only scoped connection metadata, never credentials or execution authority", async () => {
    const { context, accountId } = await setup();
    const result = await executeCloudObservationTool(principal.organizationId, "list_cloud_accounts", {}, context);
    expect(result).toMatchObject({ ok: true, result: { complete: false, accounts: [{ id: accountId, connectionVersion: 1, deploymentAuthority: false, agentScanAvailable: false }] } });
    expect(JSON.stringify(result)).not.toMatch(/encryptedConfiguration|roleArn|externalId|credentialRef/);
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
  it("requires a trusted route principal and the same workspace", async () => {
    const { context, accountId } = await setup();
    expect((await executeCloudObservationTool(principal.organizationId, "read_aws_inventory", { accountId })).ok).toBe(false);
    expect((await executeCloudObservationTool("another", "read_aws_inventory", { accountId }, context)).ok).toBe(false);
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
  it.each(["organizationId", "sessionId", "roleArn", "region", "credentialRef"])("rejects model-supplied authority/target override %s", async (field) => {
    const { context, accountId } = await setup();
    expect((await executeCloudObservationTool(principal.organizationId, "read_aws_inventory", { accountId, [field]: "override" }, context)).ok).toBe(false);
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
  it.each(["device", "expired_device", "membership", "pending", "foreign_account", "revoked_credential", "legacy", "enabled"])("denies %s before inventory lookup", async (change) => {
    const { f, context, accountId } = await setup();
    if (change === "device") f.state.device.revokedAt = new Date();
    if (change === "expired_device") f.state.device.expiresAt = new Date();
    if (change === "membership") f.state.membership.role = "unknown";
    if (change === "pending") f.state.membership.acceptedAt = null as unknown as Date;
    if (change === "foreign_account") f.state.account!.organizationId = "other";
    if (change === "revoked_credential") f.state.credential!.revokedAt = new Date();
    if (change === "legacy") f.state.account!.credentialRef = "legacy-lead";
    if (change === "enabled") f.state.account!.enabled = true;
    expect((await executeCloudObservationTool(principal.organizationId, "read_aws_inventory", { accountId }, context)).ok).toBe(false);
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
  it.each(["disconnect", "replacement", "device", "membership", "account_ref"])("withholds late evidence after %s", async (change) => {
    const { f, context, accountId } = await setup();
    mocks.inventory.mockImplementation(async () => {
      if (change === "disconnect") f.state.credential!.revokedAt = new Date();
      if (change === "replacement") f.state.credential!.version++;
      if (change === "device") f.state.device.revokedAt = new Date();
      if (change === "membership") f.state.membership.role = "unknown";
      if (change === "account_ref") f.state.account!.credentialRef = "changed";
      return sample;
    });
    expect((await executeCloudObservationTool(principal.organizationId, "read_aws_inventory", { accountId }, context)).ok).toBe(false);
  });
  it.each(["denied", "timeout"])("does not replace %s with sample data", async (failure) => {
    const { context, accountId } = await setup(); mocks.inventory.mockRejectedValue(new Error(failure));
    expect(await executeCloudObservationTool(principal.organizationId, "read_aws_inventory", { accountId }, context)).toEqual({ ok: false, error: "cloud_observation_unavailable" });
  });
  it("represents an empty bounded page without any account absence claim", async () => {
    const { context, accountId } = await setup(); mocks.inventory.mockResolvedValue({ ...sample, truncated: false, instances: [] });
    const result = await executeCloudObservationTool(principal.organizationId, "read_aws_inventory", { accountId }, context);
    expect(result).toMatchObject({ ok: true, result: { instances: [], coverage: { complete: false }, unknown: { otherRegions: true, backups: true } } });
  });
  it.each([{ ...sample, accountId: "999999999999" }, { ...sample, region: "us-west-2" }, { ...sample, instances: Array(6).fill(sample.instances[0]) }])("rejects invalid provider evidence", async (invalid) => {
    const { context, accountId } = await setup(); mocks.inventory.mockResolvedValue(invalid);
    expect((await executeCloudObservationTool(principal.organizationId, "read_aws_inventory", { accountId }, context)).ok).toBe(false);
  });
});

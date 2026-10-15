import { describe, expect, it } from "vitest";
import { createAwsEnrollmentService } from "../service";
import { AwsEnrollmentError } from "../policy";
import { fixture, input, externalId, principal } from "./fixture";

describe("tenant AWS enrollment composed service", () => {
  it("binds challenge, real identity boundary, scoped ciphertext, consume without fabricated lifecycle; never enables old Agent", async () => {
    const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies);
    const start = await service.start(principal, input);
    expect(start.externalId).toBe(externalId); expect(JSON.stringify(f.state.attempt)).not.toContain(externalId);
    const result = await service.complete(principal, start.attemptId, externalId);
    expect(f.dependencies.validate).toHaveBeenCalledWith(expect.objectContaining({ ...input, externalId }));
    expect(result.account).toMatchObject({ provider: "aws", accountId: input.expectedAccountId, connected: true, enabled: false, agentScanAvailable: false, inventoryAvailability: "not_checked", regions: [input.region] });
    expect(f.state.attempt?.consumedAt).toEqual(f.dependencies.now()); expect(f.state.credential?.version).toBe(1);
    expect(f.dependencies.seal.mock.calls[0][1]).toBe(`cloud-account-credential-v1:${principal.organizationId}:aws:${result.account.id}:1`);
    expect(f.state.account?.credentialRef).toBe(`cloud-v2:${result.account.id}`); expect(f.state.account?.enabled).toBe(false);
    expect(f.state.lifecycle).toBeNull(); expect(f.state.transitions).toHaveLength(0);
    expect(f.dependencies.audit).toHaveBeenCalledWith(expect.objectContaining({ organizationId: principal.organizationId, accountId: result.account.id }));
    expect(JSON.stringify(result)).not.toContain("v2."); expect(JSON.stringify(result)).not.toContain(externalId);
    await expect(service.complete(principal, start.attemptId, externalId)).rejects.toMatchObject({ code: "enrollment_conflict" });
    expect(f.dependencies.validate).toHaveBeenCalledTimes(1);
  });
  it.each(["foreign_org", "foreign_user", "wrong_proof", "expired", "storage_missing", "no_configuration", "read_only", "revoked_device"])("fails %s before provider IO", async (mode) => {
    const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies); const start = await service.start(principal, input);
    if (mode === "foreign_org") f.state.attempt!.organizationId = "other";
    if (mode === "foreign_user") f.state.attempt!.userId = "other";
    if (mode === "expired") f.setNow(new Date(start.expiresAt));
    if (mode === "storage_missing") f.repo.cloudAccountCredential.findMany.mockRejectedValue({ code: "P2021" });
    if (mode === "no_configuration") f.dependencies.configured.mockImplementation(() => { throw new AwsEnrollmentError("enrollment_unavailable"); });
    if (mode === "read_only") f.state.membership.role = "read_only";
    if (mode === "revoked_device") f.state.device.revokedAt = f.dependencies.now();
    await expect(service.complete(principal, start.attemptId, mode === "wrong_proof" ? "wrong" : externalId)).rejects.toBeDefined();
    expect(f.dependencies.validate).not.toHaveBeenCalled(); expect(f.state.account).toBeNull(); expect(f.state.credential).toBeNull();
  });
  it.each(["revoked_membership", "revoked_device", "expired_device", "expired_challenge", "changed_challenge", "wrong_account", "provider_failure"])("does not commit after provider IO when %s", async (mode) => {
    const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies); const start = await service.start(principal, input);
    f.dependencies.validate.mockImplementation(async () => {
      if (mode === "revoked_membership") f.state.membership.role = "read_only";
      if (mode === "revoked_device") f.state.device.revokedAt = f.dependencies.now();
      if (mode === "expired_device") f.state.device.expiresAt = f.dependencies.now();
      if (mode === "expired_challenge") f.setNow(new Date(start.expiresAt));
      if (mode === "changed_challenge") f.state.attempt!.roleArn = "arn:aws:iam::123456789012:role/Changed";
      if (mode === "provider_failure") throw new AwsEnrollmentError("aws_identity_unverified");
      return { accountId: mode === "wrong_account" ? "999999999999" : input.expectedAccountId, assumedRoleArn: "verified-session" };
    });
    await expect(service.complete(principal, start.attemptId, externalId)).rejects.toBeDefined();
    expect(f.state.account).toBeNull(); expect(f.state.credential).toBeNull(); expect(f.state.attempt?.consumedAt).toBeNull();
  });
  it("preserves working configuration and rolls back challenge consumption if vault CAS loses", async () => {
    const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies);
    await service.complete(principal, (await service.start(principal, input)).attemptId, externalId);
    const previous = structuredClone(f.state.credential); const next = await service.start(principal, { ...input, region: "us-west-2" });
    f.repo.cloudAccountCredential.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.complete(principal, next.attemptId, externalId)).rejects.toMatchObject({ code: "enrollment_conflict" });
    expect(f.state.credential).toEqual(previous); expect(f.state.account?.regions).toEqual([input.region]); expect(f.state.attempt?.consumedAt).toBeNull();
  });
  it("returns the updated region after a successful versioned re-enrollment", async () => {
    const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies);
    await service.complete(principal, (await service.start(principal, input)).attemptId, externalId);
    const result = await service.complete(principal, (await service.start(principal, { ...input, region: "us-west-2" })).attemptId, externalId);
    expect(result.account.regions).toEqual(["us-west-2"]); expect(f.state.credential?.version).toBe(2);
  });
  it("rejects automatic adoption of legacy Lead pointers", async () => {
    const f = fixture(); f.state.account = { id: "existing", organizationId: principal.organizationId, provider: "aws", externalAccountId: input.expectedAccountId, credentialRef: "legacy-lead", alias: null, regions: [input.region], enabled: true, updatedAt: f.dependencies.now() };
    await expect(createAwsEnrollmentService(f.typedRepo, f.dependencies).start(principal, input)).rejects.toMatchObject({ code: "enrollment_conflict" });
    expect(f.dependencies.validate).not.toHaveBeenCalled(); expect(f.repo.cloudAccountEnrollmentAttempt.create).not.toHaveBeenCalled();
  });
});

it("retains no credential or account when a competing completion wins the challenge claim", async () => {
  const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies); const start = await service.start(principal, input);
  f.repo.cloudAccountEnrollmentAttempt.updateMany.mockResolvedValueOnce({ count: 0 });
  await expect(service.complete(principal, start.attemptId, externalId)).rejects.toMatchObject({ code: "enrollment_conflict" });
  expect(f.repo.cloudAccount.create).not.toHaveBeenCalled(); expect(f.repo.cloudAccountCredential.create).not.toHaveBeenCalled(); expect(f.dependencies.seal).not.toHaveBeenCalled();
});
describe("canonical cloud-account creation allowance", () => {
  it("uses Starter allowance for a missing billing row and counts every tenant account", async () => {
    const f = fixture(); f.state.additionalAccountCount = 1;
    await expect(createAwsEnrollmentService(f.typedRepo, f.dependencies).start(principal, input)).rejects.toMatchObject({ code: "cloud_account_limit_reached" });
    expect(f.repo.cloudAccount.count).toHaveBeenCalledWith({ where: { organizationId: principal.organizationId } });
    expect(f.dependencies.validate).not.toHaveBeenCalled(); expect(f.repo.cloudAccountEnrollmentAttempt.create).not.toHaveBeenCalled();
  });
  it.each([{ tier: "business", status: "active" }, { tier: "enterprise", status: "invalid" }, { tier: "enterprise", status: "trialing" }])("does not grant unvalidated or legacy-trial unlimited quota: %s", async (row) => {
    const f = fixture(); f.state.additionalAccountCount = 1; f.state.billingPlan = { organizationId: principal.organizationId, ...row };
    await expect(createAwsEnrollmentService(f.typedRepo, f.dependencies).start(principal, input)).rejects.toMatchObject({ code: "cloud_account_limit_reached" });
  });
  it.each(["active", "past_due", "canceled", "no_plan"])("preserves Growth count allowance with validated status %s without inventing a paid access gate", async (status) => {
    const f = fixture(); f.state.additionalAccountCount = 2; f.state.billingPlan = { organizationId: principal.organizationId, tier: "growth", status };
    const service = createAwsEnrollmentService(f.typedRepo, f.dependencies);
    await expect(service.complete(principal, (await service.start(principal, input)).attemptId, externalId)).resolves.toHaveProperty("account");
    expect(f.state.account).not.toBeNull(); expect(f.repo.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });
  it("rechecks allowance inside the commit transaction after a competing account takes the slot", async () => {
    const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies); const start = await service.start(principal, input);
    f.dependencies.validate.mockImplementation(async () => { f.state.additionalAccountCount = 1; return { accountId: input.expectedAccountId, assumedRoleArn: "verified-session" }; });
    await expect(service.complete(principal, start.attemptId, externalId)).rejects.toMatchObject({ code: "cloud_account_limit_reached" });
    expect(f.state.account).toBeNull(); expect(f.state.credential).toBeNull(); expect(f.state.attempt?.consumedAt).toBeNull();
  });
  it.each(["billing", "count"])("fails closed when %s read fails rather than treating storage failure as free quota", async (boundary) => {
    const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies); const start = await service.start(principal, input);
    if (boundary === "billing") f.repo.tenantBillingPlan.findUnique.mockRejectedValue(new Error("unavailable"));
    else f.repo.cloudAccount.count.mockRejectedValue(new Error("unavailable"));
    await expect(service.complete(principal, start.attemptId, externalId)).rejects.toMatchObject({ code: "enrollment_unavailable" });
    expect(f.dependencies.validate).not.toHaveBeenCalled(); expect(f.state.account).toBeNull();
  });
  it("revalidates an existing account at or above the allowance without consuming a new slot", async () => {
    const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies);
    await service.complete(principal, (await service.start(principal, input)).attemptId, externalId);
    f.state.additionalAccountCount = 5; f.repo.cloudAccount.count.mockClear(); f.repo.tenantBillingPlan.findUnique.mockClear();
    f.repo.cloudAccount.count.mockRejectedValue(new Error("unavailable")); f.repo.tenantBillingPlan.findUnique.mockRejectedValue(new Error("unavailable"));
    await expect(service.complete(principal, (await service.start(principal, input)).attemptId, externalId)).resolves.toHaveProperty("account");
    expect(f.state.credential?.version).toBe(2); expect(f.repo.cloudAccount.count).not.toHaveBeenCalled(); expect(f.repo.tenantBillingPlan.findUnique).not.toHaveBeenCalled();
  });
});

it.each(["before_provider", "during_provider"])("respects a downgraded plan %s without consuming the challenge", async (when) => {
  const f = fixture(); f.state.additionalAccountCount = 2; f.state.billingPlan = { organizationId: principal.organizationId, tier: "growth", status: "active" };
  const service = createAwsEnrollmentService(f.typedRepo, f.dependencies); const start = await service.start(principal, input);
  if (when === "before_provider") f.state.billingPlan.tier = "starter";
  else f.dependencies.validate.mockImplementation(async () => { f.state.billingPlan!.tier = "starter"; return { accountId: input.expectedAccountId, assumedRoleArn: "verified-session" }; });
  await expect(service.complete(principal, start.attemptId, externalId)).rejects.toMatchObject({ code: "cloud_account_limit_reached" });
  if (when === "before_provider") expect(f.dependencies.validate).not.toHaveBeenCalled();
  expect(f.state.account).toBeNull(); expect(f.state.credential).toBeNull(); expect(f.state.attempt?.consumedAt).toBeNull();
});
it.each(["billing", "count"])("fails closed on a %s read outage after provider IO inside the commit transaction", async (boundary) => {
  const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies); const start = await service.start(principal, input);
  f.dependencies.validate.mockImplementation(async () => { if (boundary === "billing") f.repo.tenantBillingPlan.findUnique.mockRejectedValue(new Error("database unavailable")); else f.repo.cloudAccount.count.mockRejectedValue(new Error("database unavailable")); return { accountId: input.expectedAccountId, assumedRoleArn: "verified-session" }; });
  await expect(service.complete(principal, start.attemptId, externalId)).rejects.toMatchObject({ code: "enrollment_unavailable" });
  expect(f.state.account).toBeNull(); expect(f.state.credential).toBeNull(); expect(f.state.attempt?.consumedAt).toBeNull();
});

it("retains no account/vault/challenge consumption after a simulated Serializable commit conflict", async () => {
  const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies); const start = await service.start(principal, input);
  f.state.serializationAbort = true;
  await expect(service.complete(principal, start.attemptId, externalId)).rejects.toMatchObject({ code: "P2034" });
  expect(f.state.account).toBeNull(); expect(f.state.credential).toBeNull(); expect(f.state.attempt?.consumedAt).toBeNull();
});

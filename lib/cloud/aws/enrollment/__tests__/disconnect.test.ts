import { expect, it, vi } from "vitest";
import { createAwsEnrollmentService } from "../service";
import { readTenantAwsInventory } from "../inventory";
import { fixture, input, externalId, principal } from "./fixture";
async function connected() {
  const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies);
  const result = await service.complete(principal, (await service.start(principal, input)).attemptId, externalId);
  return { f, service, account: result.account };
}
it("locally disconnects without provider/config/billing/decryption, preserving canonical history and quota", async () => {
  const { f, service, account } = await connected();
  f.dependencies.configured.mockImplementation(() => { throw new Error("provider unavailable"); });
  f.dependencies.validate.mockClear(); f.dependencies.seal.mockClear(); f.dependencies.audit.mockClear(); f.repo.cloudAccount.count.mockClear(); f.repo.tenantBillingPlan.findUnique.mockClear();
  const result = await service.disconnect(principal, account.id, account.connectionVersion);
  expect(result.account).toMatchObject({ id: account.id, connected: false, status: "disconnected", connectionVersion: 2, enabled: false, agentScanAvailable: false, inventoryAvailability: "unavailable", revokedAt: f.dependencies.now().toISOString() });
  expect(f.state.credential).toMatchObject({ version: 2, encryptedConfiguration: "", revokedAt: f.dependencies.now() });
  expect(f.state.account?.credentialRef).toBe(`cloud-v2:${account.id}`); expect(f.state.account?.enabled).toBe(false);
  expect(f.dependencies.validate).not.toHaveBeenCalled(); expect(f.dependencies.seal).not.toHaveBeenCalled(); expect(f.repo.cloudAccount.count).not.toHaveBeenCalled(); expect(f.repo.tenantBillingPlan.findUnique).not.toHaveBeenCalled();
  expect(f.dependencies.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "disconnected", accountId: account.id }));
  expect(f.state.transitions).toHaveLength(0);
});
it("retains disconnected metadata and makes repeat disconnect idempotent without extra version/audit", async () => {
  const { f, service, account } = await connected(); f.dependencies.audit.mockClear();
  const first = await service.disconnect(principal, account.id, 1);
  const repeat = await service.disconnect(principal, account.id, 1);
  expect(repeat).toEqual(first); expect(f.state.credential?.version).toBe(2); expect(f.dependencies.audit).toHaveBeenCalledTimes(1);
  expect((await service.list(principal.organizationId)).accounts[0]).toMatchObject({ connected: false, connectionVersion: 2 });
});
it.each(["foreign_org", "legacy_ref", "read_only", "device_revoked", "stale_version", "bad_version"])("denies %s without clearing credential", async (mode) => {
  const { f, service, account } = await connected(); const before = structuredClone(f.state.credential);
  if (mode === "foreign_org") f.state.account!.organizationId = "foreign";
  if (mode === "legacy_ref") f.state.account!.credentialRef = "legacy-lead";
  if (mode === "read_only") f.state.membership.role = "read_only";
  if (mode === "device_revoked") f.state.device.revokedAt = f.dependencies.now();
  await expect(service.disconnect(principal, account.id, mode === "stale_version" ? 8 : mode === "bad_version" ? "1" : 1)).rejects.toBeDefined();
  expect(f.state.credential).toEqual(before);
});
it.each(["bound", "null_sibling"])("expires %s enrollment and prevents completion even before provider IO", async (kind) => {
  const { f, service, account } = await connected(); const pending = await service.start(principal, input);
  if (kind === "null_sibling") { f.state.attempt!.cloudAccountId = null; f.state.attempt!.expectedCredentialVersion = null; f.state.attempt!.expectedAccountUpdatedAt = null; }
  await service.disconnect(principal, account.id, 1); f.dependencies.validate.mockClear();
  await expect(service.complete(principal, pending.attemptId, externalId)).rejects.toMatchObject({ code: "enrollment_expired" });
  expect(f.dependencies.validate).not.toHaveBeenCalled(); expect(f.state.credential?.encryptedConfiguration).toBe("");
});
it("reconnects only with fresh identity, advances monotonic version and rejects stale old disconnect", async () => {
  const { f, service, account } = await connected(); await service.disconnect(principal, account.id, 1);
  const result = await service.complete(principal, (await service.start(principal, input)).attemptId, externalId);
  expect(result.account).toMatchObject({ connected: true, connectionVersion: 3, revokedAt: null });
  expect(f.state.credential?.encryptedConfiguration).not.toBe("");
  await expect(service.disconnect(principal, account.id, 1)).rejects.toMatchObject({ code: "enrollment_conflict" });
  expect(f.state.credential?.version).toBe(3);
});
it("disconnect winning while validation is in flight cannot be resurrected by its stale completion", async () => {
  const { f, service, account } = await connected(); const pending = await service.start(principal, input);
  f.dependencies.validate.mockImplementation(async () => { await service.disconnect(principal, account.id, 1); return { accountId: input.expectedAccountId, assumedRoleArn: "verified-session" }; });
  await expect(service.complete(principal, pending.attemptId, externalId)).rejects.toMatchObject({ code: "enrollment_expired" });
  expect(f.state.credential).toMatchObject({ version: 2, encryptedConfiguration: "" });
});
it("re-enrollment winning first prevents a stale disconnect from revoking the new credential", async () => {
  const { f, service, account } = await connected();
  await service.complete(principal, (await service.start(principal, input)).attemptId, externalId);
  await expect(service.disconnect(principal, account.id, 1)).rejects.toMatchObject({ code: "enrollment_conflict" });
  expect(f.state.credential).toMatchObject({ version: 2, revokedAt: null });
});
it("rolls back revocation and pending expiry on a simulated serialization failure", async () => {
  const { f, service, account } = await connected(); const pending = await service.start(principal, input); const before = structuredClone(f.state.credential);
  f.state.serializationAbort = true;
  await expect(service.disconnect(principal, account.id, 1)).rejects.toMatchObject({ code: "P2034" });
  expect(f.state.credential).toEqual(before); expect(f.state.attempt!.expiresAt.toISOString()).toBe(pending.expiresAt);
});
it("withholds in-flight inventory after disconnect and blocks future inventory without SDK reads", async () => {
  const { f, service, account } = await connected();
  const read = vi.fn(async () => { await service.disconnect(principal, account.id, 1); return { accountId: input.expectedAccountId, region: input.region, source: "live" as const, complete: false as const, truncated: false, instances: [], observedAt: f.dependencies.now().toISOString() }; });
  const dependencies = { now: f.dependencies.now, open: () => JSON.stringify({ ...input, externalId }), read };
  await expect(readTenantAwsInventory(f.typedRepo, principal, account.id, dependencies)).rejects.toMatchObject({ code: "enrollment_conflict" });
  read.mockClear(); await expect(readTenantAwsInventory(f.typedRepo, principal, account.id, dependencies)).rejects.toMatchObject({ code: "connection_disconnected" }); expect(read).not.toHaveBeenCalled();
});
it("rejects integer overflow without destroying current configuration", async () => {
  const {f, service, account} = await connected();
  f.state.credential!.version = 2147483647;
  const before = structuredClone(f.state.credential);
  await expect(service.disconnect(principal, account.id, 2147483647)).rejects.toMatchObject({code: "enrollment_unavailable"});
  expect(f.state.credential).toEqual(before);
});
it.each(["empty_active", "ciphertext_revoked"])("does not misrepresent corrupt %s credential metadata", async mode => {
  const {f, service} = await connected();
  if (mode === "empty_active") f.state.credential!.encryptedConfiguration = "";
  else f.state.credential!.revokedAt = f.dependencies.now();
  await expect(service.list(principal.organizationId)).rejects.toMatchObject({code: "enrollment_unavailable"});
});

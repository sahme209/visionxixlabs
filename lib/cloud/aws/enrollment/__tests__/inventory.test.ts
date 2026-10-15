import { expect, it, vi } from "vitest";
import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { createAwsEnrollmentService } from "../service";
import { readTenantAwsInventory } from "../inventory";
import { fixture, input, externalId, principal } from "./fixture";
async function enrolled() {
  const f = fixture(); const service = createAwsEnrollmentService(f.typedRepo, f.dependencies); const start = await service.start(principal, input);
  const result = await service.complete(principal, start.attemptId, externalId);
  const page = { accountId: input.expectedAccountId, region: input.region, source: "live" as const, complete: false as const, truncated: false, instances: [], observedAt: f.dependencies.now().toISOString() };
  const open = vi.fn(() => JSON.stringify({ ...input, externalId })); const read = vi.fn(async () => page);
  return { f, account: result.account, open, read, page };
}
it("reads only the tenant-owned bound vault in its stored region, without enabling old Agent", async () => {
  const { f, account, open, read, page } = await enrolled();
  await expect(readTenantAwsInventory(f.typedRepo, principal, account.id, { now: f.dependencies.now, open, read })).resolves.toEqual(page);
  expect(open).toHaveBeenCalledWith("v2.fixture-sealed", `cloud-account-credential-v1:${principal.organizationId}:aws:${account.id}:1`);
  expect(read).toHaveBeenCalledWith(expect.objectContaining({ ...input, externalId })); expect(f.state.account?.enabled).toBe(false);
});
it.each(["foreign_tenant", "wrong_account", "wrong_region", "bad_ciphertext"])("rejects %s before provider read", async (mode) => {
  const { f, account, open, read } = await enrolled();
  if (mode === "foreign_tenant") f.state.account!.organizationId = "other";
  if (mode === "wrong_account") open.mockReturnValue(JSON.stringify({ ...input, expectedAccountId: "999999999999", externalId }));
  if (mode === "wrong_region") f.state.account!.regions = ["us-west-2"];
  if (mode === "bad_ciphertext") open.mockImplementation(() => { throw new Error("ciphertext context mismatch"); });
  await expect(readTenantAwsInventory(f.typedRepo, principal, account.id, { now: f.dependencies.now, open, read })).rejects.toBeDefined(); expect(read).not.toHaveBeenCalled();
});
it.each(["device_revoked", "role_revoked", "credential_replaced", "ref_changed", "account_removed", "region_changed"])("withholds late provider observations after %s", async (mode) => {
  const { f, account, open, read, page } = await enrolled();
  read.mockImplementation(async () => {
    if (mode === "device_revoked") f.state.device.revokedAt = f.dependencies.now();
    if (mode === "role_revoked") f.state.membership.role = "unknown";
    if (mode === "credential_replaced") f.state.credential!.version++;
    if (mode === "ref_changed") f.state.account!.credentialRef = null;
    if (mode === "account_removed") f.state.account = null;
    if (mode === "region_changed") f.state.account!.regions = ["us-west-2"];
    return page;
  });
  await expect(readTenantAwsInventory(f.typedRepo, principal, account.id, { now: f.dependencies.now, open, read })).rejects.toBeDefined();
});

it("rejects real scoped ciphertext copied from another tenant before any provider read", async () => {
  const { f, account, read } = await enrolled();
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "fixture-only-key-with-at-least-32-characters");
  try {
    f.state.credential!.encryptedConfiguration = encryptScopedCredential(JSON.stringify({ ...input, externalId }), `cloud-account-credential-v1:other-org:aws:${account.id}:1`);
    await expect(readTenantAwsInventory(f.typedRepo, principal, account.id, { now: f.dependencies.now, read })).rejects.toMatchObject({ code: "enrollment_unavailable" });
    expect(read).not.toHaveBeenCalled();
  } finally { vi.unstubAllEnvs(); }
});

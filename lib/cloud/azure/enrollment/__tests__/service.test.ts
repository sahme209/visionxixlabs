import { expect, it, vi } from "vitest";
import { createAzureEnrollmentService } from "../service";
import { parseAzureEnrollmentInput, azureCredentialContext } from "../policy";
import { input, principal, fixture } from "./fixture";
it("validates strictly without echoing secrets or accepting caller authority", () => {
    expect(parseAzureEnrollmentInput({ ...input, tenantId: input.tenantId.toUpperCase() })).toEqual(input);
    for (const bad of [{ ...input, url: "https://evil.invalid" }, { ...input, clientSecret: "x".repeat(4097) }, { ...input, tenantId: "common" }, { ...input, expectedVersion: 0 }, { ...input, clientSecret: "bad\nsecret" }])
        expect(() => parseAzureEnrollmentInput(bad)).toThrow("invalid_input");
    expect(azureCredentialContext({ ...principal, accountId: "account", version: 1 })).toBe(`cloud-account-credential-v1:${principal.organizationId}:azure:account:1`);
});
it("connects explicit validated Azure credentials in canonical scoped storage without enabling Agent", async () => {
    const f = fixture(), service = createAzureEnrollmentService(f.typedRepo, f.deps);
    const result = await service.enroll(principal, input);
    expect(result.account).toMatchObject({ provider: "azure", subscriptionId: input.subscriptionId, connected: true, connectionVersion: 1, enabled: false, agentScanAvailable: false });
    expect(f.state.account).toMatchObject({ provider: "azure", credentialRef: "cloud-v2:azure-account", autopilotMode: "observe_only", enabled: false, regions: [] });
    expect(f.deps.seal).toHaveBeenCalledWith(JSON.stringify({ tenantId: input.tenantId, subscriptionId: input.subscriptionId, clientId: input.clientId, clientSecret: input.clientSecret }), azureCredentialContext({ ...principal, accountId: result.account.id, version: 1 }));
    expect(JSON.stringify(result)).not.toContain(input.clientSecret);
    expect(JSON.stringify(result)).not.toContain("v2.");
    expect((await service.list(principal)).accounts).toEqual([result.account]);
});
it.each(["read_only", "unaccepted", "revoked", "expired", "foreign_device", "missing_tables", "missing_config", "quota", "quota_error"])("blocks %s before provider IO", async (mode) => {
    const f = fixture();
    if (mode === "read_only")
        f.state.membership.role = "read_only";
    if (mode === "unaccepted")
        f.state.membership.acceptedAt = null;
    if (mode === "revoked")
        f.state.device.revokedAt = f.deps.now();
    if (mode === "expired")
        f.state.device.expiresAt = f.deps.now();
    if (mode === "foreign_device")
        f.state.device.organizationId = "other";
    if (mode === "missing_tables")
        f.repo.cloudAccountCredential.findMany.mockRejectedValue(new Error("missing"));
    if (mode === "missing_config")
        f.deps.configured.mockImplementation(() => { throw new Error("missing"); });
    if (mode === "quota")
        f.state.extraAccounts = 1;
    if (mode === "quota_error")
        f.repo.tenantBillingPlan.findUnique.mockRejectedValue(new Error("missing"));
    await expect(createAzureEnrollmentService(f.typedRepo, f.deps).enroll(principal, input)).rejects.toBeDefined();
    expect(f.deps.validate).not.toHaveBeenCalled();
    expect(f.state.account).toBeNull();
});
it.each(["role", "device", "identity", "quota"])("rechecks %s after external validation before storing", async (mode) => {
    const f = fixture();
    f.deps.validate.mockImplementation(async () => { if (mode === "role")
        f.state.membership.role = "read_only"; if (mode === "device")
        f.state.device.revokedAt = f.deps.now(); if (mode === "quota")
        f.state.extraAccounts = 1; return { tenantId: input.tenantId, subscriptionId: mode === "identity" ? "wrong" : input.subscriptionId }; });
    await expect(createAzureEnrollmentService(f.typedRepo, f.deps).enroll(principal, input)).rejects.toBeDefined();
    expect(f.state.account).toBeNull();
    expect(f.state.credential).toBeNull();
});
it("zeroizes locally independent of provider/config/billing and idempotently returns revocation", async () => {
    const f = fixture(), s = createAzureEnrollmentService(f.typedRepo, f.deps);
    await s.enroll(principal, input);
    f.deps.validate.mockClear();
    f.deps.configured.mockImplementation(() => { throw new Error("off"); });
    f.repo.tenantBillingPlan.findUnique.mockRejectedValue(new Error("off"));
    const first = await s.disconnect(principal, "azure-account", 1);
    expect(first.account).toMatchObject({ connected: false, connectionVersion: 2, inventoryAvailability: "unavailable" });
    expect(f.state.credential).toMatchObject({ encryptedConfiguration: "", version: 2 });
    expect(await s.disconnect(principal, "azure-account", 1)).toEqual(first);
    expect(f.deps.validate).not.toHaveBeenCalled();
    await expect(s.inventory(principal, "azure-account")).rejects.toMatchObject({ code: "connection_disconnected" });
    expect(f.deps.read).not.toHaveBeenCalled();
});
it("requires fresh version validation on reconnect and rejects stale disconnect", async () => {
    const f = fixture(), s = createAzureEnrollmentService(f.typedRepo, f.deps);
    await s.enroll(principal, input);
    await s.disconnect(principal, "azure-account", 1);
    await expect(s.enroll(principal, { ...input, expectedVersion: 1 })).rejects.toMatchObject({ code: "enrollment_conflict" });
    expect(f.deps.validate).toHaveBeenCalledTimes(1);
    const r = await s.enroll(principal, { ...input, expectedVersion: 2 });
    expect(r.account).toMatchObject({ connected: true, connectionVersion: 3 });
    expect(f.deps.validate).toHaveBeenCalledTimes(2);
    await expect(s.disconnect(principal, "azure-account", 1)).rejects.toMatchObject({ code: "enrollment_conflict" });
});
it("disconnect winning during validation cannot resurrect credentials", async () => {
    const f = fixture(), s = createAzureEnrollmentService(f.typedRepo, f.deps);
    await s.enroll(principal, input);
    f.deps.validate.mockImplementation(async () => { await s.disconnect(principal, "azure-account", 1); return { tenantId: input.tenantId, subscriptionId: input.subscriptionId }; });
    await expect(s.enroll(principal, { ...input, expectedVersion: 1 })).rejects.toMatchObject({ code: "enrollment_conflict" });
    expect(f.state.credential).toMatchObject({ version: 2, encryptedConfiguration: "" });
});
it.each(["role", "disconnect", "version", "account"])("withholds stale inventory after %s changes", async (mode) => {
    const f = fixture(), s = createAzureEnrollmentService(f.typedRepo, f.deps);
    await s.enroll(principal, input);
    f.deps.read.mockImplementation(async () => { if (mode === "role")
        f.state.membership.acceptedAt = null; if (mode === "disconnect")
        await s.disconnect(principal, "azure-account", 1); if (mode === "version")
        f.state.credential!.version++; if (mode === "account")
        f.state.account!.externalAccountId = "other"; return { resourceGroups: [], complete: false, scope: "first_resource_groups_page", limit: 100, limitations: [] }; });
    await expect(s.inventory(principal, "azure-account")).rejects.toBeDefined();
});
it("does not leak foreign existing accounts or provider work", async () => {
    const f = fixture(), s = createAzureEnrollmentService(f.typedRepo, f.deps);
    await s.enroll(principal, input);
    f.state.account!.organizationId = "foreign";
    await expect(s.inventory(principal, "azure-account")).rejects.toMatchObject({ code: "enrollment_not_found" });
    expect(f.deps.read).not.toHaveBeenCalled();
});
it("audit failure does not reject a committed connection", async () => { const f = fixture(); f.deps.audit.mockRejectedValue(new Error("offline")); await expect(createAzureEnrollmentService(f.typedRepo, f.deps).enroll(principal, input)).resolves.toHaveProperty("account.connected", true); });
it("disconnect zeroizes corrupted ciphertext without requiring vault health", async () => { const f = fixture(), s = createAzureEnrollmentService(f.typedRepo, f.deps); await s.enroll(principal, input); f.state.credential!.encryptedConfiguration = "corrupted"; await expect(s.disconnect(principal, "azure-account", 1)).resolves.toHaveProperty("account.connected", false); expect(f.state.credential!.encryptedConfiguration).toBe(""); });
it("rolls back credential replacement when account CAS loses", async () => { const f = fixture(), s = createAzureEnrollmentService(f.typedRepo, f.deps); await s.enroll(principal, input); const previous = structuredClone(f.state); f.repo.cloudAccount.updateMany.mockResolvedValueOnce({ count: 0 }); await expect(s.enroll(principal, { ...input, expectedVersion: 1 })).rejects.toMatchObject({ code: "enrollment_conflict" }); expect(f.state.credential).toEqual(previous.credential); });
it("reserves a version increment so a last allowed active credential can still disconnect", async () => { const f = fixture(), s = createAzureEnrollmentService(f.typedRepo, f.deps); await s.enroll(principal, input); f.state.credential!.version = 2147483645; const r = await s.enroll(principal, { ...input, expectedVersion: 2147483645 }); expect(r.account.connectionVersion).toBe(2147483646); expect((await s.disconnect(principal, "azure-account", 2147483646)).account.connectionVersion).toBe(2147483647); });

import "server-only";
import { AzureEnrollmentError, azureCredentialContext, parseAzureEnrollmentInput, requireAzureAccountId, type AzureInventory } from "./policy";
import { assertAzureBinding, requireAzureAuthority, type AzureEnrollmentDependencies, type AzureEnrollmentRepo, type AzurePrincipal } from "./service";
export async function readScopedAzureInventory(repo: AzureEnrollmentRepo, principal: AzurePrincipal, accountId: string, deps: AzureEnrollmentDependencies): Promise<AzureInventory> {
    requireAzureAccountId(accountId);
    await requireAzureAuthority(repo, principal, deps.now);
    const rows = await repo.cloudAccount.findMany({ where: { id: accountId, organizationId: principal.organizationId, provider: "azure" }, take: 1 });
    const account = rows[0] ? structuredClone(rows[0]) : null;
    const stored = account ? await repo.cloudAccountCredential.findUnique({ where: { id: account.id } }) : null;
    const credential = stored ? structuredClone(stored) : null;
    assertAzureBinding(account, credential, principal);
    if (credential!.revokedAt)
        throw new AzureEnrollmentError("connection_disconnected");
    let parsed;
    try {
        const value = JSON.parse(deps.open(credential!.encryptedConfiguration, azureCredentialContext({ organizationId: principal.organizationId, accountId, version: credential!.version })));
        parsed = parseAzureEnrollmentInput({ ...value, expectedVersion: null });
    }
    catch {
        throw new AzureEnrollmentError("enrollment_unavailable");
    }
    if (parsed.subscriptionId !== account!.externalAccountId)
        throw new AzureEnrollmentError("enrollment_unavailable");
    const { expectedVersion: _, ...explicit } = parsed;
    void _;
    const page = await deps.read(explicit);
    await requireAzureAuthority(repo, principal, deps.now);
    const currentRows = await repo.cloudAccount.findMany({ where: { id: accountId, organizationId: principal.organizationId, provider: "azure" }, take: 1 });
    const current = await repo.cloudAccountCredential.findUnique({ where: { id: accountId } });
    if (JSON.stringify(currentRows[0]) !== JSON.stringify(account) || JSON.stringify(current) !== JSON.stringify(credential))
        throw new AzureEnrollmentError("enrollment_conflict");
    return { ...page, accountId, subscriptionId: account!.externalAccountId, connectionVersion: credential!.version, observedAt: deps.now().toISOString() };
}

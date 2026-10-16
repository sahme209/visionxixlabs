import "server-only";
import { randomUUID } from "node:crypto";
import { encryptScopedCredential, decryptScopedCredential } from "@/lib/security/credentialVault";
import { hasDesktopCapability, type DesktopWorkspaceRole } from "@/lib/desktop/desktopAuthorization";
import { checkEntitlement } from "@/lib/billing/checkEntitlement";
import { planForStripeTier } from "@/lib/billing/planRegistry";
import { isBillingTier } from "@/lib/billing/tierCatalog";
import { AzureEnrollmentError, azureCredentialContext, parseAzureEnrollmentInput, parseAzureDisconnectInput, requireAzureAccountId, type AzureAccount, type AzureCredentialInput, type AzureInventoryPage } from "./policy";
import { readScopedAzureInventory } from "./scopedConnection";
interface Delegate<Row> {
    findUnique(args: Record<string, unknown>): Promise<Row | null>;
    findMany(args: Record<string, unknown>): Promise<Row[]>;
    create(args: {
        data: Record<string, unknown>;
    }): Promise<Row>;
    updateMany(args: Record<string, unknown>): Promise<{
        count: number;
    }>;
}
export interface AzureAccountRow {
    id: string;
    organizationId: string;
    provider: string;
    externalAccountId: string;
    credentialRef: string | null;
    alias: string | null;
    regions: string[];
    enabled: boolean;
    updatedAt: Date;
}
export interface AzureCredentialRow {
    id: string;
    organizationId: string;
    encryptedConfiguration: string;
    version: number;
    validatedAt: Date;
    revokedAt: Date | null;
}
export interface AzurePrincipal {
    organizationId: string;
    userId: string;
    sessionId: string;
}
export interface AzureEnrollmentRepo {
    cloudAccount: Delegate<AzureAccountRow> & {
        count(args: {
            where: {
                organizationId: string;
            };
        }): Promise<number>;
    };
    cloudAccountCredential: Delegate<AzureCredentialRow>;
    tenantBillingPlan: {
        findUnique(args: {
            where: {
                organizationId: string;
            };
        }): Promise<{
            organizationId: string;
            tier: string;
            status: string;
        } | null>;
    };
    desktopSessionRecord: {
        findUnique(args: Record<string, unknown>): Promise<{
            id: string;
            userId: string;
            organizationId: string;
            expiresAt: Date;
            revokedAt: Date | null;
        } | null>;
    };
    orgMembership: {
        findUnique(args: Record<string, unknown>): Promise<{
            acceptedAt: Date | null;
            role: DesktopWorkspaceRole;
        } | null>;
    };
    $transaction<T>(operation: (tx: AzureEnrollmentRepo) => Promise<T>, options: {
        isolationLevel: "Serializable";
    }): Promise<T>;
}
export interface AzureEnrollmentDependencies {
    now: () => Date;
    randomId: () => string;
    configured: () => void;
    validate: (input: AzureCredentialInput) => Promise<{
        tenantId: string;
        subscriptionId: string;
    }>;
    read: (input: AzureCredentialInput) => Promise<AzureInventoryPage>;
    seal: typeof encryptScopedCredential;
    open: typeof decryptScopedCredential;
    audit: (input: AzurePrincipal & {
        accountId: string;
        action: "validated" | "disconnected";
    }) => Promise<void>;
}
const defaults: AzureEnrollmentDependencies = { now: () => new Date(), randomId: randomUUID, configured: () => { encryptScopedCredential("configuration-check", "azure-enrollment-preflight"); }, validate: async (input) => (await import("./providerClient")).validateAzureEnrollment(input), read: async (input) => (await import("./providerClient")).readAzureResourceGroups(input), seal: encryptScopedCredential, open: decryptScopedCredential, audit: async () => { } };
export async function requireAzureAuthority(repo: AzureEnrollmentRepo, principal: AzurePrincipal, now: () => Date, manage = false) {
    const device = await repo.desktopSessionRecord.findUnique({ where: { id: principal.sessionId } });
    const membership = await repo.orgMembership.findUnique({ where: { userId_organizationId: { userId: principal.userId, organizationId: principal.organizationId } } });
    const roles = ["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"];
    if (!device || device.id !== principal.sessionId || device.revokedAt || device.expiresAt <= now() || device.userId !== principal.userId || device.organizationId !== principal.organizationId || !membership?.acceptedAt || !roles.includes(membership.role) || !hasDesktopCapability(membership.role, manage ? "connections:manage" : "workspace:read") || (manage && !["owner", "admin"].includes(membership.role)))
        throw new AzureEnrollmentError("connection_authority_required");
}
export function azureAccountSummary(account: AzureAccountRow, credential: AzureCredentialRow): AzureAccount {
    const connected = credential.revokedAt === null;
    return { id: account.id, provider: "azure", subscriptionId: account.externalAccountId, connected, status: connected ? "connected" : "disconnected", connectionVersion: credential.version, lastValidatedAt: credential.validatedAt.toISOString(), revokedAt: credential.revokedAt?.toISOString() ?? null, enabled: false, agentScanAvailable: false, inventoryAvailability: connected ? "not_checked" : "unavailable" };
}
export function assertAzureBinding(account: AzureAccountRow | null, credential: AzureCredentialRow | null, principal: AzurePrincipal, checkEnvelope = true) {
    if (!account || account.organizationId !== principal.organizationId || account.provider !== "azure" || account.enabled || account.credentialRef !== `cloud-v2:${account.id}`)
        throw new AzureEnrollmentError("enrollment_not_found");
    if (!credential || credential.id !== account.id || credential.organizationId !== principal.organizationId || !Number.isSafeInteger(credential.version) || credential.version < 1 || credential.version > 2147483647 || !(credential.validatedAt instanceof Date) || !Number.isFinite(credential.validatedAt.getTime()) || (credential.revokedAt === null ? checkEnvelope && !credential.encryptedConfiguration.startsWith("v2.") : !(credential.revokedAt instanceof Date) || credential.encryptedConfiguration !== ""))
        throw new AzureEnrollmentError("enrollment_unavailable");
}
const sameAccount = (a: AzureAccountRow | null, b: AzureAccountRow | null) => JSON.stringify(a) === JSON.stringify(b);
const sameCredential = (a: AzureCredentialRow | null, b: AzureCredentialRow | null) => JSON.stringify(a) === JSON.stringify(b);
export function createAzureEnrollmentService(repo: AzureEnrollmentRepo, supplied: Partial<AzureEnrollmentDependencies> = {}) {
    const deps = { ...defaults, ...supplied };
    const accountKey = (organizationId: string, subscriptionId: string) => ({ organizationId_provider_externalAccountId: { organizationId, provider: "azure", externalAccountId: subscriptionId } });
    async function ready(organizationId: string) { await repo.cloudAccount.findMany({ where: { organizationId }, take: 1, select: { id: true } }); await repo.cloudAccountCredential.findMany({ where: { organizationId }, take: 1, select: { id: true } }); }
    async function capacity(tx: AzureEnrollmentRepo, organizationId: string, existing: boolean) {
        if (existing)
            return;
        let row, usage;
        try {
            row = await tx.tenantBillingPlan.findUnique({ where: { organizationId } });
            usage = await tx.cloudAccount.count({ where: { organizationId } });
        }
        catch {
            throw new AzureEnrollmentError("enrollment_unavailable");
        }
        if ((row && row.organizationId !== organizationId) || !Number.isSafeInteger(usage) || usage < 0)
            throw new AzureEnrollmentError("enrollment_unavailable");
        const valid = row && ["trialing", "active", "past_due", "canceled", "no_plan"].includes(row.status);
        const tier = row && isBillingTier(row.tier) && valid && row.tier !== "trial" && row.status !== "trialing" ? row.tier : "trial";
        if (checkEntitlement({ plan: planForStripeTier(tier), dimension: "cloud_accounts", currentUsage: usage, attemptedDelta: 1 }).kind !== "allow")
            throw new AzureEnrollmentError("cloud_account_limit_reached");
    }
    async function enroll(principal: AzurePrincipal, input: unknown) {
        const parsed = parseAzureEnrollmentInput(input);
        await requireAzureAuthority(repo, principal, deps.now, true);
        await ready(principal.organizationId);
        deps.configured();
        const account = await repo.cloudAccount.findUnique({ where: accountKey(principal.organizationId, parsed.subscriptionId) });
        const credential = account ? await repo.cloudAccountCredential.findUnique({ where: { id: account.id } }) : null;
        if (account) {
            assertAzureBinding(account, credential, principal);
            if (credential!.version !== parsed.expectedVersion)
                throw new AzureEnrollmentError("enrollment_conflict");
        }
        else if (parsed.expectedVersion !== null)
            throw new AzureEnrollmentError("enrollment_conflict");
        await capacity(repo, principal.organizationId, !!account);
        const explicit = { tenantId: parsed.tenantId, subscriptionId: parsed.subscriptionId, clientId: parsed.clientId, clientSecret: parsed.clientSecret };
        const identity = await deps.validate(explicit);
        if (identity.tenantId !== parsed.tenantId || identity.subscriptionId !== parsed.subscriptionId)
            throw new AzureEnrollmentError("azure_identity_unverified");
        const summary = await repo.$transaction(async (tx) => {
            await requireAzureAuthority(tx, principal, deps.now, true);
            const current = await tx.cloudAccount.findUnique({ where: accountKey(principal.organizationId, parsed.subscriptionId) });
            const currentCredential = current ? await tx.cloudAccountCredential.findUnique({ where: { id: current.id } }) : null;
            if (!sameAccount(current, account) || !sameCredential(currentCredential, credential))
                throw new AzureEnrollmentError("enrollment_conflict");
            await capacity(tx, principal.organizationId, !!account);
            const now = deps.now(), id = account?.id ?? deps.randomId(), version = (credential?.version ?? 0) + 1;
            if (version > 2147483646)
                throw new AzureEnrollmentError("enrollment_unavailable");
            const encryptedConfiguration = deps.seal(JSON.stringify(explicit), azureCredentialContext({ organizationId: principal.organizationId, accountId: id, version }));
            let saved = account;
            if (!saved)
                saved = await tx.cloudAccount.create({ data: { id, organizationId: principal.organizationId, provider: "azure", externalAccountId: parsed.subscriptionId, credentialRef: `cloud-v2:${id}`, regions: [], autopilotMode: "observe_only", enabled: false } });
            else {
                const update = await tx.cloudAccount.updateMany({ where: { id, organizationId: principal.organizationId, provider: "azure", updatedAt: account!.updatedAt, enabled: false, credentialRef: account!.credentialRef }, data: { updatedAt: now } });
                if (update.count !== 1)
                    throw new AzureEnrollmentError("enrollment_conflict");
                saved = { ...saved, updatedAt: now };
            }
            const next = { id, organizationId: principal.organizationId, encryptedConfiguration, version, validatedAt: now, revokedAt: null };
            if (credential) {
                const updated = await tx.cloudAccountCredential.updateMany({ where: { id, organizationId: principal.organizationId, version: credential.version, revokedAt: credential.revokedAt, encryptedConfiguration: credential.encryptedConfiguration }, data: next });
                if (updated.count !== 1)
                    throw new AzureEnrollmentError("enrollment_conflict");
            }
            else
                await tx.cloudAccountCredential.create({ data: next });
            return azureAccountSummary(saved, next);
        }, { isolationLevel: "Serializable" });
        try {
            await deps.audit({ ...principal, accountId: summary.id, action: "validated" });
        }
        catch { /* best effort */ }
        return { account: summary };
    }
    async function list(principal: AzurePrincipal) { await requireAzureAuthority(repo, principal, deps.now); await ready(principal.organizationId); const rows = await repo.cloudAccount.findMany({ where: { organizationId: principal.organizationId, provider: "azure", enabled: false }, orderBy: { createdAt: "desc" }, take: 100 }); const accounts = []; for (const account of rows) {
        if (account.organizationId !== principal.organizationId || account.provider !== "azure" || account.enabled || account.credentialRef !== `cloud-v2:${account.id}`)
            continue;
        const credential = await repo.cloudAccountCredential.findUnique({ where: { id: account.id } });
        assertAzureBinding(account, credential, principal);
        accounts.push(azureAccountSummary(account, credential!));
    } await requireAzureAuthority(repo, principal, deps.now); return { accounts }; }
    async function disconnect(principal: AzurePrincipal, accountId: string, expectedVersion: unknown) {
        requireAzureAccountId(accountId);
        const parsed = parseAzureDisconnectInput({ expectedVersion });
        const result = await repo.$transaction(async (tx) => {
            await requireAzureAuthority(tx, principal, deps.now, true);
            const rows = await tx.cloudAccount.findMany({ where: { id: accountId, organizationId: principal.organizationId, provider: "azure" }, take: 1 });
            const account = rows[0] ?? null;
            const credential = account ? await tx.cloudAccountCredential.findUnique({ where: { id: account.id } }) : null;
            assertAzureBinding(account, credential, principal, false);
            if (credential!.revokedAt) {
                if (credential!.version !== parsed.expectedVersion && credential!.version !== parsed.expectedVersion + 1)
                    throw new AzureEnrollmentError("enrollment_conflict");
                return { account: azureAccountSummary(account!, credential!), changed: false };
            }
            if (credential!.version !== parsed.expectedVersion)
                throw new AzureEnrollmentError("enrollment_conflict");
            if (credential!.version >= 2147483647)
                throw new AzureEnrollmentError("enrollment_unavailable");
            const now = deps.now();
            const updated = await tx.cloudAccountCredential.updateMany({ where: { id: accountId, organizationId: principal.organizationId, version: parsed.expectedVersion, revokedAt: null }, data: { encryptedConfiguration: "", version: { increment: 1 }, revokedAt: now } });
            if (updated.count !== 1)
                throw new AzureEnrollmentError("enrollment_conflict");
            const changed = await tx.cloudAccount.updateMany({ where: { id: accountId, organizationId: principal.organizationId, provider: "azure", enabled: false, updatedAt: account!.updatedAt, credentialRef: account!.credentialRef }, data: { updatedAt: now } });
            if (changed.count !== 1)
                throw new AzureEnrollmentError("enrollment_conflict");
            return { account: azureAccountSummary(account!, { ...credential!, encryptedConfiguration: "", version: credential!.version + 1, revokedAt: now }), changed: true };
        }, { isolationLevel: "Serializable" });
        if (result.changed)
            try {
                await deps.audit({ ...principal, accountId, action: "disconnected" });
            }
            catch { /* best effort */ }
        return { account: result.account };
    }
    return { enroll, list, disconnect, inventory: (principal: AzurePrincipal, accountId: string) => readScopedAzureInventory(repo, principal, accountId, deps) };
}

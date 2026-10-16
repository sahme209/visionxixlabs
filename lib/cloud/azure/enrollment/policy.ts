export type AzureErrorCode = "invalid_input" | "enrollment_unavailable" | "enrollment_not_found" | "enrollment_conflict" | "connection_authority_required" | "cloud_account_limit_reached" | "connection_disconnected" | "azure_identity_unverified" | "azure_inventory_denied" | "azure_inventory_unavailable";
export class AzureEnrollmentError extends Error {
    constructor(readonly code: AzureErrorCode) { super(code); this.name = "AzureEnrollmentError"; }
}
export interface AzureCredentialInput {
    tenantId: string;
    subscriptionId: string;
    clientId: string;
    clientSecret: string;
}
export interface AzureEnrollmentInput extends AzureCredentialInput {
    expectedVersion: number | null;
}
export interface AzureAccount {
    id: string;
    provider: "azure";
    subscriptionId: string;
    connected: boolean;
    status: "connected" | "disconnected";
    connectionVersion: number;
    lastValidatedAt: string;
    revokedAt: string | null;
    enabled: false;
    agentScanAvailable: false;
    inventoryAvailability: "not_checked" | "unavailable";
}
export interface AzureResourceGroup {
    id: string;
    name: string;
    location: string;
}
export interface AzureInventoryPage {
    resourceGroups: AzureResourceGroup[];
    complete: false;
    scope: "first_resource_groups_page";
    limit: 100;
    limitations: string[];
}
export interface AzureInventory extends AzureInventoryPage {
    accountId: string;
    subscriptionId: string;
    connectionVersion: number;
    observedAt: string;
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function isAzureUuid(value: unknown): value is string { return typeof value === "string" && uuid.test(value); }
export function azureCredentialContext(input: {
    organizationId: string;
    accountId: string;
    version: number;
}): string { return `cloud-account-credential-v1:${input.organizationId}:azure:${input.accountId}:${input.version}`; }
export function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AzureEnrollmentError("invalid_input"); return value as Record<string, unknown>; }
export function parseAzureEnrollmentInput(input: unknown): AzureEnrollmentInput {
    const value = record(input);
    const fields = ["tenantId", "subscriptionId", "clientId", "clientSecret", "expectedVersion"];
    if (Object.keys(value).length !== fields.length || Object.keys(value).some(key => !fields.includes(key)))
        throw new AzureEnrollmentError("invalid_input");
    const ids = [value.tenantId, value.subscriptionId, value.clientId].map(id => typeof id === "string" ? id.trim().toLowerCase() : "");
    if (!ids.every(isAzureUuid) || typeof value.clientSecret !== "string" || value.clientSecret.length === 0 || new TextEncoder().encode(value.clientSecret).length > 4096 || /[\u0000-\u001f\u007f]/.test(value.clientSecret))
        throw new AzureEnrollmentError("invalid_input");
    if (value.expectedVersion !== null && (!Number.isSafeInteger(value.expectedVersion) || (value.expectedVersion as number) < 1 || (value.expectedVersion as number) > 2147483645))
        throw new AzureEnrollmentError("invalid_input");
    return { tenantId: ids[0], subscriptionId: ids[1], clientId: ids[2], clientSecret: value.clientSecret, expectedVersion: value.expectedVersion as number | null };
}
export function parseAzureDisconnectInput(input: unknown): {
    expectedVersion: number;
} {
    const value = record(input);
    if (Object.keys(value).length !== 1 || !Number.isSafeInteger(value.expectedVersion) || (value.expectedVersion as number) < 1 || (value.expectedVersion as number) > 2147483647)
        throw new AzureEnrollmentError("invalid_input");
    return { expectedVersion: value.expectedVersion as number };
}
export function requireAzureAccountId(id: unknown): asserts id is string { if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw new AzureEnrollmentError("invalid_input"); }

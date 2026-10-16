export interface AzureEnrollmentInput {
    tenantId: string;
    subscriptionId: string;
    clientId: string;
    clientSecret: string;
    expectedVersion: number | null;
}
export interface DesktopAzureAccount {
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
export interface DesktopAzureInventory {
    accountId: string;
    subscriptionId: string;
    connectionVersion: number;
    observedAt: string;
    scope: "first_resource_groups_page";
    complete: false;
    resourceGroups: Array<{
        id: string;
        name: string;
        location: string;
    }>;
    limit: 100;
    limitations: string[];
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const time = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
const version = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 2147483647;
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function azureEnrollmentInputError(value: AzureEnrollmentInput): string | null {
    if (![value.tenantId, value.subscriptionId, value.clientId].every(v => uuid.test(v.trim().toLowerCase())))
        return "Enter the Azure tenant, subscription and client UUIDs.";
    if (!value.clientSecret || new TextEncoder().encode(value.clientSecret).length > 4096 || /[\u0000-\u001f\u007f]/.test(value.clientSecret))
        return "Enter the existing service-principal secret (at most 4096 bytes).";
    if (value.expectedVersion !== null && (!version(value.expectedVersion) || value.expectedVersion > 2147483645))
        return "Refresh the connection before revalidating it.";
    return null;
}
export function isDesktopAzureAccount(value: unknown): value is DesktopAzureAccount {
    if (!record(value) || Object.keys(value).length !== 11)
        return false;
    return id(value.id) && value.provider === "azure" && typeof value.subscriptionId === "string" && uuid.test(value.subscriptionId) && typeof value.connected === "boolean" && value.status === (value.connected ? "connected" : "disconnected") && version(value.connectionVersion) && time(value.lastValidatedAt) && value.enabled === false && value.agentScanAvailable === false && (value.connected ? value.revokedAt === null && value.inventoryAvailability === "not_checked" : time(value.revokedAt) && value.inventoryAvailability === "unavailable");
}
export function isDesktopAzureInventory(value: unknown): value is DesktopAzureInventory {
    if (!record(value) || Object.keys(value).length !== 9 || !id(value.accountId) || typeof value.subscriptionId !== "string" || !uuid.test(value.subscriptionId) || !version(value.connectionVersion) || !time(value.observedAt) || value.complete !== false || value.scope !== "first_resource_groups_page" || value.limit !== 100 || !Array.isArray(value.limitations) || value.limitations.length > 5 || !value.limitations.every(v => typeof v === "string" && v.length <= 256) || !Array.isArray(value.resourceGroups) || value.resourceGroups.length > 100)
        return false;
    return value.resourceGroups.every(row => record(row) && Object.keys(row).length === 3 && typeof row.id === "string" && row.id.length <= 512 && typeof row.name === "string" && row.name.length > 0 && row.name.length <= 90 && !/[\u0000-\u001f\u007f/\\]/.test(row.name) && typeof row.location === "string" && row.location.length > 0 && row.location.length <= 64 && !/[\u0000-\u001f\u007f]/.test(row.location) && row.id.toLowerCase() === `/subscriptions/${value.subscriptionId}/resourcegroups/${row.name}`.toLowerCase());
}

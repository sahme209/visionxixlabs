import { desktopClient, type ApiResult } from "./desktopClient";
import { azureEnrollmentInputError, isDesktopAzureAccount, isDesktopAzureInventory, type AzureEnrollmentInput, type DesktopAzureAccount, type DesktopAzureInventory } from "./azureEnrollmentContract";
const unavailable = "Azure connection service is unavailable. Refresh connection state before trying again.";
const messages: Record<string, string> = { connection_authority_required: "Your current workspace role no longer permits this action.", cloud_account_limit_reached: "The workspace cloud account allowance is exhausted.", connection_disconnected: "This Azure connection is disconnected. Reconnect with fresh validation.", enrollment_conflict: "Connection state changed. Refresh before retrying.", azure_identity_unverified: "Azure did not confirm the expected tenant and subscription read identity.", azure_inventory_denied: "Azure denied this bounded resource-group read.", azure_inventory_unavailable: "The bounded inventory could not be observed. No complete inventory is claimed.", invalid_input: "Check the Azure IDs, secret and current connection version." };
async function request(method: "GET" | "POST", path: string, body?: unknown): Promise<ApiResult<unknown>> {
    const config = desktopClient.config;
    if (!config.sessionToken?.startsWith("axm.desk."))
        return { ok: false, error: "A browser-paired desktop session is required for Azure enrollment." };
    // Native transport has the same origin bound. Preview cannot exfiltrate a supplied SP secret to a configurable host.
    if (config.apiBase !== "https://visionxixlabs.com")
        return { ok: false, error: "Azure enrollment requires the approved product API origin." };
    try {
        const response = await fetch(`${config.apiBase}/api/desktop/cloud/azure/${path}`, { method, credentials: "omit", headers: { Accept: "application/json", Authorization: `Bearer ${config.sessionToken}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
        const payload = await response.json().catch(() => null) as {
            ok?: unknown;
            data?: unknown;
            error?: unknown;
        } | null;
        if (desktopClient.config !== config)
            return { ok: false, error: "Workspace credentials changed. Refresh the Azure connection view." };
        if (response.ok && payload?.ok === true && payload.data !== undefined)
            return { ok: true, data: payload.data };
        return { ok: false, error: typeof payload?.error === "string" ? messages[payload.error] ?? unavailable : unavailable };
    }
    catch {
        return { ok: false, error: unavailable };
    }
}
const accountId = (value: string) => /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const azureEnrollmentClient = {
    async list(): Promise<ApiResult<{
        accounts: DesktopAzureAccount[];
    }>> { const result = await request("GET", "accounts"); if (!result.ok)
        return result; const value = result.data as {
        accounts?: unknown;
    }; return Array.isArray(value?.accounts) && value.accounts.length <= 100 && value.accounts.every(isDesktopAzureAccount) ? { ok: true, data: { accounts: value.accounts } } : { ok: false, error: unavailable }; },
    async enroll(input: AzureEnrollmentInput): Promise<ApiResult<{
        account: DesktopAzureAccount;
    }>> { const error = azureEnrollmentInputError(input); if (error)
        return { ok: false, error }; const normalized = { ...input, tenantId: input.tenantId.trim().toLowerCase(), subscriptionId: input.subscriptionId.trim().toLowerCase(), clientId: input.clientId.trim().toLowerCase() }; const result = await request("POST", "enrollment", normalized); if (!result.ok)
        return result; const value = result.data as {
        account?: unknown;
    }; return isDesktopAzureAccount(value?.account) && value.account.connected && value.account.subscriptionId === normalized.subscriptionId && value.account.connectionVersion === (input.expectedVersion ?? 0) + 1 ? { ok: true, data: { account: value.account } } : { ok: false, error: unavailable }; },
    async inventory(id: string): Promise<ApiResult<DesktopAzureInventory>> { if (!accountId(id))
        return { ok: false, error: unavailable }; const result = await request("GET", `accounts/${encodeURIComponent(id)}/inventory`); if (!result.ok)
        return result; return isDesktopAzureInventory(result.data) && result.data.accountId === id ? { ok: true, data: result.data } : { ok: false, error: unavailable }; },
    async disconnect(id: string, expectedVersion: number): Promise<ApiResult<{
        account: DesktopAzureAccount;
    }>> { if (!accountId(id) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
        return { ok: false, error: unavailable }; const result = await request("POST", `accounts/${encodeURIComponent(id)}/disconnect`, { expectedVersion }); if (!result.ok)
        return result; const value = result.data as {
        account?: unknown;
    }; return isDesktopAzureAccount(value?.account) && !value.account.connected && value.account.id === id && [expectedVersion, expectedVersion + 1].includes(value.account.connectionVersion) ? { ok: true, data: { account: value.account } } : { ok: false, error: unavailable }; },
};

import "server-only";
import { ClientSecretCredential } from "@azure/identity";
import { ResourceManagementClient } from "@azure/arm-resources";
import { createHttpHeaders, createPipelineRequest } from "@azure/core-rest-pipeline";
import { AzureEnrollmentError, isAzureUuid, type AzureCredentialInput, type AzureInventoryPage, type AzureResourceGroup } from "./policy";
import { createBoundedAzureHttpClient, type AzureRawSend } from "./boundedHttp";
/** Test transport dependency is never derived from a request or environment. */
export function createAzureProviderClient(deps: {
    send?: AzureRawSend;
} = {}) {
    async function session(input: AzureCredentialInput, operation: "validate" | "inventory") {
        const signal = AbortSignal.timeout(15000);
        const httpClient = createBoundedAzureHttpClient({ ...input, operation, signal, send: deps.send });
        const credential = new ClientSecretCredential(input.tenantId, input.clientId, input.clientSecret, { authorityHost: "https://login.microsoftonline.com", disableInstanceDiscovery: true, httpClient, retryOptions: { maxRetries: 0 }, redirectOptions: { maxRetries: 0 }, loggingOptions: { logger: () => { }, allowLoggingAccountIdentifiers: false, enableUnsafeSupportLogging: false } });
        const token = await credential.getToken("https://management.azure.com/.default", { abortSignal: signal });
        if (!token || !token.token || token.expiresOnTimestamp <= Date.now())
            throw new Error("azure_token_unavailable");
        return { httpClient, signal, token };
    }
    async function validate(input: AzureCredentialInput) {
        try {
            const { httpClient, signal, token } = await session(input, "validate");
            const response = await httpClient.sendRequest(createPipelineRequest({ url: `https://management.azure.com/subscriptions/${input.subscriptionId}?api-version=2022-12-01`, method: "GET", headers: createHttpHeaders({ authorization: `Bearer ${token.token}`, accept: "application/json" }), abortSignal: signal }));
            if (response.status !== 200)
                throw new Error("azure_subscription_unverified");
            const body = JSON.parse(response.bodyAsText ?? "") as {
                id?: unknown;
                subscriptionId?: unknown;
                tenantId?: unknown;
            };
            if (typeof body.id !== "string" || body.id.toLowerCase() !== `/subscriptions/${input.subscriptionId}` || typeof body.subscriptionId !== "string" || body.subscriptionId.toLowerCase() !== input.subscriptionId || typeof body.tenantId !== "string" || body.tenantId.toLowerCase() !== input.tenantId || !isAzureUuid(body.tenantId.toLowerCase()))
                throw new Error("azure_identity_mismatch");
            return { tenantId: input.tenantId, subscriptionId: input.subscriptionId };
        }
        catch {
            throw new AzureEnrollmentError("azure_identity_unverified");
        }
    }
    async function read(input: AzureCredentialInput): Promise<AzureInventoryPage> {
        try {
            const { httpClient, signal, token } = await session(input, "inventory");
            // Reuse only this operation's internally acquired token. No SDK reauthentication or token API.
            const resourceClient = new ResourceManagementClient({ getToken: async () => token }, input.subscriptionId, { endpoint: "https://management.azure.com", apiVersion: "2025-04-01", httpClient, retryOptions: { maxRetries: 0 }, redirectOptions: { maxRetries: 0 }, loggingOptions: { logger: () => { } } });
            const first = await resourceClient.resourceGroups.list({ top: 100, abortSignal: signal }).byPage().next();
            if (first.done || !Array.isArray(first.value))
                throw new Error("azure_page_invalid");
            const groups: AzureResourceGroup[] = [];
            for (const row of first.value) {
                const { id, name, location } = row;
                if (typeof id !== "string" || id.length > 512 || typeof name !== "string" || name.length < 1 || name.length > 90 || /[\u0000-\u001f\u007f/\\]/.test(name) || typeof location !== "string" || location.length < 1 || location.length > 64 || /[\u0000-\u001f\u007f]/.test(location) || id.toLowerCase() !== `/subscriptions/${input.subscriptionId}/resourcegroups/${name}`.toLowerCase())
                    throw new Error("azure_group_invalid");
                if ([id, name, location].some(value => value.includes(input.clientSecret) || value.includes(token.token)))
                    throw new Error("azure_secret_echo_denied");
                if (groups.length < 100)
                    groups.push({ id, name, location });
            }
            return { resourceGroups: groups, complete: false, scope: "first_resource_groups_page", limit: 100, limitations: ["First resource-group page only; this is not a complete subscription inventory."] };
        }
        catch (error) {
            if (error && typeof error === "object" && "statusCode" in error && [401, 403].includes(Number(error.statusCode)))
                throw new AzureEnrollmentError("azure_inventory_denied");
            throw new AzureEnrollmentError("azure_inventory_unavailable");
        }
    }
    return { validate, read };
}
export const validateAzureEnrollment = (input: AzureCredentialInput) => createAzureProviderClient().validate(input);
export const readAzureResourceGroups = (input: AzureCredentialInput) => createAzureProviderClient().read(input);

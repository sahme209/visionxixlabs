/** Compile-only fixture against the installed SDK's actual public option types. Never execute. */
import { ClientSecretCredential, type ClientSecretCredentialOptions } from "@azure/identity";
import { ResourceManagementClient, type ResourceManagementClientOptionalParams } from "@azure/arm-resources";
import type { Debugger } from "@azure/logger";
import { createAzureProviderClient, createSilentAzureLogger, removeAzureHttpLogPolicy } from "../../lib/cloud/azure/enrollment/providerClient";
const logger: Debugger = createSilentAzureLogger();
const identityOptions = {
    authorityHost: "https://login.microsoftonline.com",
    disableInstanceDiscovery: true,
    loggingOptions: { logger, allowLoggingAccountIdentifiers: false, enableUnsafeSupportLogging: false },
    retryOptions: { maxRetries: 0 },
    redirectOptions: { maxRetries: 0 },
} satisfies ClientSecretCredentialOptions;
const armOptions = {
    endpoint: "https://management.azure.com",
    apiVersion: "2025-04-01",
    retryOptions: { maxRetries: 0 },
    redirectOptions: { maxRetries: 0 },
} satisfies ResourceManagementClientOptionalParams;
const credential = new ClientSecretCredential("11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333", "compile-only-not-executed", identityOptions);
const arm = new ResourceManagementClient(credential, "22222222-2222-4222-8222-222222222222", armOptions);
removeAzureHttpLogPolicy(arm.pipeline);
void createAzureProviderClient;

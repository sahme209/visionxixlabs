/**
 * Azure connector — real Service Principal validation via @azure/identity.
 * Multi-tenant safe: uses customer-provided tenantId/clientId/clientSecret.
 * Validates by acquiring a token and listing subscriptions.
 */

import { ClientSecretCredential } from "@azure/identity";
import { SubscriptionClient } from "@azure/arm-subscriptions";
import type { ConnectorStatus } from "./types";
import { ENABLE_CLOUD_CONNECTORS_AZURE } from "@/lib/featureFlags";

export type AzureServicePrincipalInput = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId?: string;
};

export type ValidateAzureConnectionResult = {
  valid: boolean;
  status: ConnectorStatus;
  subscriptionId?: string;
  subscriptionName?: string;
  tenantId?: string;
  errorCode?: string;
};

const TENANT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateInput(input: AzureServicePrincipalInput): string | null {
  if (!input.tenantId?.trim()) return "Tenant ID is required";
  if (!TENANT_ID_REGEX.test(input.tenantId.trim())) return "Invalid Tenant ID format (expected UUID)";
  if (!input.clientId?.trim()) return "Client ID is required";
  if (!CLIENT_ID_REGEX.test(input.clientId.trim())) return "Invalid Client ID format (expected UUID)";
  if (!input.clientSecret?.trim()) return "Client Secret is required";
  return null;
}

/**
 * Validate Azure connection via Service Principal authentication.
 * Acquires a token and lists subscriptions to confirm access.
 */
export async function validateAzureConnection(
  input: AzureServicePrincipalInput,
  _context?: { userId?: string; leadId?: string }
): Promise<ValidateAzureConnectionResult> {
  if (!ENABLE_CLOUD_CONNECTORS_AZURE) {
    return { valid: false, status: "unavailable", errorCode: "FEATURE_DISABLED" };
  }

  const validationErr = validateInput(input);
  if (validationErr) {
    return { valid: false, status: "invalid", errorCode: "VALIDATION_FAILED" };
  }

  const tenantId = input.tenantId.trim();
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  const targetSubscriptionId = input.subscriptionId?.trim();

  try {
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const subscriptionClient = new SubscriptionClient(credential);

    if (targetSubscriptionId) {
      const sub = await subscriptionClient.subscriptions.get(targetSubscriptionId);
      return {
        valid: true,
        status: "linked",
        subscriptionId: sub.subscriptionId ?? targetSubscriptionId,
        subscriptionName: sub.displayName ?? undefined,
        tenantId,
      };
    }

    for await (const sub of subscriptionClient.subscriptions.list()) {
      return {
        valid: true,
        status: "linked",
        subscriptionId: sub.subscriptionId ?? undefined,
        subscriptionName: sub.displayName ?? undefined,
        tenantId,
      };
    }

    return { valid: false, status: "invalid", errorCode: "NO_SUBSCRIPTIONS" };
  } catch (e) {
    const err = e as { name?: string; code?: string; statusCode?: number };
    const code = err?.code ?? err?.name ?? "UNKNOWN";
    return { valid: false, status: "invalid", errorCode: code };
  }
}

/**
 * Create Azure SDK credential from stored Service Principal details.
 * Used by plugins to get authenticated clients.
 */
export function createAzureCredential(input: AzureServicePrincipalInput): ClientSecretCredential {
  return new ClientSecretCredential(
    input.tenantId.trim(),
    input.clientId.trim(),
    input.clientSecret.trim()
  );
}

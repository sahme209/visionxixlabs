/**
 * Azure connector — real Service Principal validation via @azure/identity.
 * Multi-tenant safe: uses customer-provided tenantId/clientId/clientSecret.
 * Validates by acquiring a token. If subscriptionId provided, verifies access via ARM REST API.
 */

import { ClientSecretCredential } from "@azure/identity";
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateInput(input: AzureServicePrincipalInput): string | null {
  if (!input.tenantId?.trim()) return "Tenant ID is required";
  if (!UUID_REGEX.test(input.tenantId.trim())) return "Invalid Tenant ID format (expected UUID)";
  if (!input.clientId?.trim()) return "Client ID is required";
  if (!UUID_REGEX.test(input.clientId.trim())) return "Invalid Client ID format (expected UUID)";
  if (!input.clientSecret?.trim()) return "Client Secret is required";
  return null;
}

/**
 * Validate Azure connection via Service Principal authentication.
 * Acquires a management token to confirm credentials work.
 * If subscriptionId is provided, verifies the SP has access to it via ARM REST.
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
    const token = await credential.getToken("https://management.azure.com/.default");
    if (!token) {
      return { valid: false, status: "invalid", errorCode: "TOKEN_ACQUISITION_FAILED" };
    }

    if (targetSubscriptionId) {
      const res = await fetch(
        `https://management.azure.com/subscriptions/${targetSubscriptionId}?api-version=2022-12-01`,
        { headers: { Authorization: `Bearer ${token.token}` } }
      );
      if (!res.ok) {
        return { valid: false, status: "invalid", errorCode: "SUBSCRIPTION_ACCESS_DENIED" };
      }
      const sub = await res.json();
      return {
        valid: true,
        status: "linked",
        subscriptionId: sub.subscriptionId ?? targetSubscriptionId,
        subscriptionName: sub.displayName ?? undefined,
        tenantId,
      };
    }

    const listRes = await fetch(
      "https://management.azure.com/subscriptions?api-version=2022-12-01",
      { headers: { Authorization: `Bearer ${token.token}` } }
    );
    if (listRes.ok) {
      const data = await listRes.json();
      const subs = data.value as Array<{ subscriptionId?: string; displayName?: string }>;
      if (subs && subs.length > 0) {
        return {
          valid: true,
          status: "linked",
          subscriptionId: subs[0].subscriptionId ?? undefined,
          subscriptionName: subs[0].displayName ?? undefined,
          tenantId,
        };
      }
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

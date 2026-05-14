/**
 * Azure connection contract. Mirrors the AWS shape so the multi-cloud
 * normalised pipeline can switch on provider without per-provider
 * code paths.
 */

import type { AccountId, ConnectorId, OrganizationId } from "@/lib/domain/ids";

export type AzureConnectionMode = "live" | "preview" | "expanding" | "disabled";
export type AzureConnectionStatus =
  | "not_configured"
  | "validating"
  | "connected"
  | "validation_failed"
  | "permission_denied"
  | "revoked";

export interface AzureConnectionInput {
  tenantId: string;         // Azure AD tenant id (UUID)
  subscriptionId: string;   // Azure subscription id (UUID)
  clientId?: string;        // Service principal client id (UUID) — optional for managed identity
  clientSecret?: string;    // Service principal secret — server-only
  location?: string;        // Default region e.g. "eastus"
  label?: string;
}

export interface AzureConnectionRecord {
  connectorId: ConnectorId;
  organizationId: OrganizationId;
  accountId?: AccountId;
  status: AzureConnectionStatus;
  mode: AzureConnectionMode;
  /** Tenant + subscription only — secrets never persisted in this record. */
  publicInput: Omit<AzureConnectionInput, "clientSecret">;
  lastValidatedAt?: string;
  validatedTenantId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/** Strip the secret before persisting/serializing. */
export function publicAzureInput(i: AzureConnectionInput): Omit<AzureConnectionInput, "clientSecret"> {
  const { clientSecret, ...rest } = i;
  void clientSecret;
  return rest;
}

/**
 * Practical AWS connection contract — what the AWS onboarding flow + the
 * scan pipeline both read.
 *
 * Pure types + a small builder. The actual STS validation lives in
 * `awsValidator.ts` (server-only). The preview scanner lives in
 * `awsPreviewScanner.ts` and is callable when live mode isn't available.
 */

import type { AccountId, ConnectorId, OrganizationId } from "@/lib/domain/ids";

export type AwsConnectionMode = "live" | "preview" | "disabled";
export type AwsConnectionStatus =
  | "not_configured"
  | "validating"
  | "connected"
  | "validation_failed"
  | "permission_denied"
  | "revoked";

export interface AwsConnectionInput {
  roleArn: string;
  externalId: string;
  region: string;
  /** Optional friendly label. */
  label?: string;
}

export interface AwsConnectionRecord {
  connectorId: ConnectorId;
  organizationId: OrganizationId;
  accountId?: AccountId;
  status: AwsConnectionStatus;
  mode: AwsConnectionMode;
  input: AwsConnectionInput;
  lastValidatedAt?: string;
  validatedArn?: string;
  errorCode?: string;
  errorMessage?: string;
}

/** Produce a fresh "not_configured" record from input. Used during onboarding
 *  before validation runs. */
export function buildConnectionRecord(opts: {
  connectorId: ConnectorId;
  organizationId: OrganizationId;
  input: AwsConnectionInput;
  mode: AwsConnectionMode;
}): AwsConnectionRecord {
  return {
    connectorId: opts.connectorId,
    organizationId: opts.organizationId,
    status: "not_configured",
    mode: opts.mode,
    input: opts.input,
  };
}

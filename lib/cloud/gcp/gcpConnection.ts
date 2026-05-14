/**
 * GCP connection contract. Mirrors AWS + Azure for the multi-cloud pipeline.
 */

import type { AccountId, ConnectorId, OrganizationId } from "@/lib/domain/ids";

export type GcpConnectionMode = "live" | "preview" | "expanding" | "disabled";
export type GcpConnectionStatus =
  | "not_configured"
  | "validating"
  | "connected"
  | "validation_failed"
  | "permission_denied"
  | "revoked";

export interface GcpConnectionInput {
  projectId: string;
  /** Service account email (server-only). When using Workload Identity Federation
   *  this field is unused. */
  serviceAccountEmail?: string;
  /** Service account JSON key. NEVER logged or sent to AI. */
  serviceAccountKeyJson?: string;
  region?: string;
  label?: string;
}

export interface GcpConnectionRecord {
  connectorId: ConnectorId;
  organizationId: OrganizationId;
  accountId?: AccountId;
  status: GcpConnectionStatus;
  mode: GcpConnectionMode;
  /** Project id + service account email only — JSON key never persisted in this record. */
  publicInput: Omit<GcpConnectionInput, "serviceAccountKeyJson">;
  lastValidatedAt?: string;
  validatedProjectId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export function publicGcpInput(i: GcpConnectionInput): Omit<GcpConnectionInput, "serviceAccountKeyJson"> {
  const { serviceAccountKeyJson, ...rest } = i;
  void serviceAccountKeyJson;
  return rest;
}

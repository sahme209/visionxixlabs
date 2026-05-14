/**
 * CloudConnectorInterface — unified abstraction for cloud providers.
 * Axiom calls these methods without knowing which cloud (AWS, Azure, GCP) is used.
 *
 * `CloudProvider` here is the canonical taxonomy from `lib/domain/provider`.
 * Older modules import it from this file — we re-export to keep that path
 * stable while consolidating new code on the domain layer.
 */

import type { ConnectorStatus } from "./types";
import type { CloudProvider } from "@/lib/domain/provider";

export type { CloudProvider };

export interface CloudConnectorContext {
  userId: string; // Required for execution context; use leadId when user not yet linked
  leadId?: string;
  credentialsKey?: string;
  dryRun?: boolean;
  userPlan?: string | null;
  userConfirmedApply?: boolean;
}

export interface ValidateConnectionResult {
  valid: boolean;
  status: ConnectorStatus;
  account?: string;
  arn?: string;
  errorCode?: string;
  /** User-facing error message for API responses */
  error?: string;
}

export interface CloudOperationResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  summary?: string;
  executionId?: string;
}

/**
 * Unified cloud connector interface.
 * Each provider (AWS, Azure, GCP) implements this so Axiom can operate cloud-agnostically.
 */
export interface CloudConnectorInterface {
  readonly provider: CloudProvider;
  validateConnection(input: Record<string, unknown>, context?: CloudConnectorContext): Promise<ValidateConnectionResult>;
  discoverInfrastructure(context: CloudConnectorContext): Promise<CloudOperationResult>;
  runSecurityScan(context: CloudConnectorContext): Promise<CloudOperationResult>;
  applyFix(input: Record<string, unknown>, context: CloudConnectorContext): Promise<CloudOperationResult>;
}

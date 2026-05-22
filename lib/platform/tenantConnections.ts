/**
 * Tenant Connection model — typed.
 *
 * Per-tenant binding between a workspace and a connector defined in the
 * connector registry. Holds the connection's lifecycle state, owner,
 * scopes granted, and validation telemetry — but NOT the secret values
 * themselves. Secrets live in the credential vault (kms-wrapped) and
 * are referenced by `credentialRef` only.
 *
 * Persistence lands in a follow-up Prisma migration. For now this typed
 * model is what the connector store + setup wizards bind to.
 */

import type { OrganizationId, UserId } from "@/lib/domain/ids";

export type ConnectionLifecycleState =
  | "not_started"
  | "awaiting_oauth"
  | "awaiting_credentials"
  | "validating"
  | "active"
  | "needs_attention"
  | "disabled"
  | "revoked";

export interface TenantConnection {
  organizationId: OrganizationId;
  /** Stable opaque id for this connection. */
  id: string;
  /** Matches a record id in lib/connectors/connectorRegistry.ts. */
  connectorId: string;
  /** Connection state machine. */
  state: ConnectionLifecycleState;
  /** Opaque reference into the credential vault. Never holds the secret itself. */
  credentialRef?: string;
  /** Per-tenant configuration (regions, project ids, repo lists). Never holds secrets. */
  configuration: Readonly<Record<string, string | number | boolean | string[]>>;
  /** Scopes / permissions the operator granted. */
  grantedScopes: readonly string[];
  /** Who initiated the connection. */
  ownerUserId?: UserId;
  /** ISO timestamp of the most recent successful validation. */
  lastValidatedAt?: string;
  /** ISO timestamp of the most recent failure, if any. */
  lastFailureAt?: string;
  /** Last failure reason (redacted) — only present when state === "needs_attention". */
  lastFailureReason?: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

/**
 * One-click setup descriptor — used by the connector-store UI to drive
 * the start of a connection. Every connector either supports OAuth-style
 * delegated auth (Connect button → redirect → callback) OR a paste-form
 * for credentials (PAT, service-account JSON, IAM role ARN).
 */
export type ConnectorOneClickFlow =
  | { kind: "oauth_redirect"; provider: "github_app" | "slack" | "google" | "microsoft" | "atlassian"; scopes: readonly string[] }
  | { kind: "paste_form"; fields: ReadonlyArray<{ name: string; label: string; secret: boolean; placeholder?: string }> }
  | { kind: "iam_role_setup"; provider: "aws" | "azure" | "gcp"; trustPolicyTemplate: string }
  | { kind: "desktop_pairing"; pairingCodeTtlSeconds: number }
  | { kind: "webhook_setup"; signedSecretRequired: boolean };

export interface ConnectorOneClickDescriptor {
  connectorId: string;
  /** Short label rendered on the Connect button. */
  buttonLabel: string;
  /** One-line "what happens when I click this" explainer. */
  buttonHelper: string;
  /** Closed-union flow kind. */
  flow: ConnectorOneClickFlow;
  /** Whether this connector is currently ready to set up (live in this workspace's plan). */
  ready: boolean;
  /** When ready === false, the reason — "planned", "requires_plan_upgrade", "operator_disabled". */
  notReadyReason?: "planned" | "requires_plan_upgrade" | "operator_disabled";
}

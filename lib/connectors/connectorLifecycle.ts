/**
 * Universal connector lifecycle — shared state machine for every connector
 * kind (cloud, repository, CI/CD, IaC, ticketing, messaging, desktop, audit).
 *
 * Distinct from `lib/cloud/connectorLifecycle.ts`, which models the
 * cloud-specific scan & reasoning lifecycle. This file is the broader,
 * connector-agnostic state machine that runs upstream of any scan.
 *
 * Each transition emits an event into the operational event stream so the
 * Command Center, workflows, and memory timeline reflect lifecycle state.
 */

export type ConnectorLifecycleState =
  | "not_configured"        // Connector exists in registry but no tenant config
  | "setup_started"         // User opened the setup wizard
  | "auth_required"         // Setup partway through; awaiting credentials
  | "credentials_submitted" // Credentials submitted; validation queued
  | "validating"            // Active validation request
  | "connected"             // Validation succeeded
  | "sync_ready"            // Connection valid; first sync queued
  | "syncing"               // Active data sync in progress
  | "synced"                // Last sync completed successfully
  | "degraded"              // Repeated failures but still functional
  | "failed"                // Latest sync failed
  | "revoked"               // Credentials revoked by user
  | "disabled";             // Disabled by tenant policy

const TRANSITIONS: Record<ConnectorLifecycleState, ConnectorLifecycleState[]> = {
  not_configured:        ["setup_started"],
  setup_started:         ["auth_required", "not_configured"],
  auth_required:         ["credentials_submitted", "not_configured"],
  credentials_submitted: ["validating"],
  validating:            ["connected", "failed", "auth_required"],
  connected:             ["sync_ready", "disabled", "revoked"],
  sync_ready:            ["syncing"],
  syncing:               ["synced", "failed", "degraded"],
  synced:                ["sync_ready", "disabled", "revoked"],
  degraded:              ["syncing", "failed", "synced", "disabled"],
  failed:                ["sync_ready", "auth_required", "disabled", "revoked"],
  revoked:               ["not_configured", "setup_started"],
  disabled:              ["sync_ready", "not_configured"],
};

export function canTransition(from: ConnectorLifecycleState, to: ConnectorLifecycleState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: ConnectorLifecycleState): ConnectorLifecycleState[] {
  return TRANSITIONS[from] ?? [];
}

export interface ConnectorLifecycleDisplay {
  label: string;
  detail: string;
  pill: string;
  semantic: "neutral" | "running" | "success" | "warning" | "error";
}

const DISPLAY: Record<ConnectorLifecycleState, ConnectorLifecycleDisplay> = {
  not_configured:        { label: "Not configured", detail: "Connector available but no tenant configuration yet.", pill: "Available",  semantic: "neutral" },
  setup_started:         { label: "Setup in progress", detail: "User opened the setup wizard; awaiting credentials.", pill: "Setup",      semantic: "running" },
  auth_required:         { label: "Auth required", detail: "Setup wizard waiting for credentials/token.", pill: "Auth",       semantic: "warning" },
  credentials_submitted: { label: "Credentials submitted", detail: "Validation queued.", pill: "Submitted",  semantic: "running" },
  validating:            { label: "Validating", detail: "Active validation request to the connector endpoint.", pill: "Validating", semantic: "running" },
  connected:             { label: "Connected", detail: "Validation succeeded.", pill: "Connected",  semantic: "success" },
  sync_ready:            { label: "Sync ready", detail: "First sync queued.", pill: "Ready",      semantic: "success" },
  syncing:               { label: "Syncing", detail: "Active data sync in progress.", pill: "Syncing",    semantic: "running" },
  synced:                { label: "Synced", detail: "Last sync completed successfully.", pill: "Synced",     semantic: "success" },
  degraded:              { label: "Degraded", detail: "Repeated failures detected — partial data available.", pill: "Degraded",   semantic: "warning" },
  failed:                { label: "Failed", detail: "Latest sync failed; see troubleshooting.", pill: "Failed",     semantic: "error" },
  revoked:               { label: "Revoked", detail: "Credentials revoked by the user.", pill: "Revoked",    semantic: "error" },
  disabled:              { label: "Disabled", detail: "Disabled by tenant policy.", pill: "Disabled",   semantic: "neutral" },
};

export function displayFor(state: ConnectorLifecycleState): ConnectorLifecycleDisplay {
  return DISPLAY[state];
}

export interface ConnectorLifecycleContext {
  connectorId: string;
  organizationId: string;
  state: ConnectorLifecycleState;
  /** Last error code if state is "failed". */
  errorCode?: string;
  /** Last error message. */
  errorMessage?: string;
  /** When this lifecycle context was last advanced. */
  updatedAt: string;
  history: { state: ConnectorLifecycleState; at: string; note?: string }[];
}

export function advance(ctx: ConnectorLifecycleContext, to: ConnectorLifecycleState, note?: string): ConnectorLifecycleContext {
  if (!canTransition(ctx.state, to)) {
    throw new Error(`Invalid connector lifecycle transition: ${ctx.state} → ${to}`);
  }
  const at = new Date().toISOString();
  return {
    ...ctx,
    state: to,
    updatedAt: at,
    history: [{ state: to, at, note }, ...ctx.history].slice(0, 100),
  };
}

export function createContext(connectorId: string, organizationId: string): ConnectorLifecycleContext {
  return {
    connectorId,
    organizationId,
    state: "not_configured",
    updatedAt: new Date().toISOString(),
    history: [{ state: "not_configured", at: new Date().toISOString() }],
  };
}

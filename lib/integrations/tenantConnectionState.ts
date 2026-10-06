/**
 * Presentation-safe state for tenant integration connections.
 *
 * A provider callback or stored credential alone is not proof that a
 * connection works. Only a successful server-side validation can make a
 * connection visible as active to a workspace.
 */

export type TenantConnectionStoredStatus = "pending" | "active" | "needs_attention" | "suspended" | "revoked";
export type TenantConnectionVisibleStatus = TenantConnectionStoredStatus | "not_connected" | "awaiting_validation";

export const CONNECTION_VALIDATION_FRESH_FOR_MS = 24 * 60 * 60 * 1000;

export function visibleTenantConnectionStatus(input: {
  status: string | null | undefined;
  lastValidatedAt: Date | null | undefined;
}, now = new Date()): TenantConnectionVisibleStatus {
  switch (input.status) {
    case "active":
      if (!input.lastValidatedAt) return "awaiting_validation";
      return now.getTime() - input.lastValidatedAt.getTime() <= CONNECTION_VALIDATION_FRESH_FOR_MS
        ? "active"
        : "needs_attention";
    case "pending":
    case "needs_attention":
    case "suspended":
    case "revoked":
      return input.status;
    default:
      return "not_connected";
  }
}

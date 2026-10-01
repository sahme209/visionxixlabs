/**
 * Presentation-safe state for tenant integration connections.
 *
 * A provider callback or stored credential alone is not proof that a
 * connection works. Only a successful server-side validation can make a
 * connection visible as active to a workspace.
 */

export type TenantConnectionStoredStatus = "pending" | "active" | "needs_attention" | "revoked";
export type TenantConnectionVisibleStatus = TenantConnectionStoredStatus | "not_connected" | "awaiting_validation";

export function visibleTenantConnectionStatus(input: {
  status: string | null | undefined;
  lastValidatedAt: Date | null | undefined;
}): TenantConnectionVisibleStatus {
  switch (input.status) {
    case "active":
      return input.lastValidatedAt ? "active" : "awaiting_validation";
    case "pending":
    case "needs_attention":
    case "revoked":
      return input.status;
    default:
      return "not_connected";
  }
}

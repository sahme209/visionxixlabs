import type { DesktopCommercialAccess, VerifiedDesktopIdentity } from "./desktopClient";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validAccess(value: unknown): value is DesktopCommercialAccess {
  if (!record(value) || typeof value.allowed !== "boolean") return false;
  if (typeof value.code !== "string" || !["active", "production_access_required", "payment_past_due", "access_canceled"].includes(value.code)) return false;
  if (!["title", "message", "planTier", "billingStatus", "accessRequestPath", "pricingPath"].every((key) => typeof value[key] === "string")) return false;
  return (value.currentPeriodEndsAt === undefined || typeof value.currentPeriodEndsAt === "string")
    && (value.cancelAtPeriodEnd === undefined || typeof value.cancelAtPeriodEnd === "boolean");
}

type Identity = Omit<VerifiedDesktopIdentity, "access" | "capabilities"> & { capabilities?: string[] };
function validIdentity(value: unknown): value is Identity {
  if (!record(value) || typeof value.kind !== "string" || !["api_key", "desktop_session"].includes(value.kind)) return false;
  if (typeof value.organizationId !== "string" || !value.organizationId.trim()) return false;
  if (!["email", "displayName"].every((key) => value[key] === undefined || typeof value[key] === "string")) return false;
  if (value.role !== undefined && (typeof value.role !== "string" || !["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"].includes(value.role))) return false;
  return value.capabilities === undefined || (Array.isArray(value.capabilities) && value.capabilities.every((item) => typeof item === "string"));
}

/** Parse the startup boundary without treating identity as operational authority. */
export function parseDesktopIdentityResponse(value: unknown): VerifiedDesktopIdentity | null {
  if (!record(value) || !validIdentity(value.identity) || !validAccess(value.access)) return null;
  return { ...value.identity, capabilities: [...(value.identity.capabilities ?? [])], access: { ...value.access } };
}

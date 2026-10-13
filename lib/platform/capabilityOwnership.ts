export type ProductSurface = "web" | "desktop" | "backend";

export type CapabilityOwnership = {
  capability: string;
  administration: ProductSurface;
  operation: ProductSurface;
  enforcement: "backend";
};

/**
 * The product boundary is data, not presentation: every client can display
 * status, but only the owning surface may administer or initiate a capability.
 * Protected decisions are always enforced again by the backend.
 */
export const CAPABILITY_OWNERSHIP = [
  { capability: "organization", administration: "web", operation: "web", enforcement: "backend" },
  { capability: "identity_and_sessions", administration: "web", operation: "web", enforcement: "backend" },
  { capability: "roles_and_permissions", administration: "web", operation: "web", enforcement: "backend" },
  { capability: "repository_access_policy", administration: "web", operation: "desktop", enforcement: "backend" },
  { capability: "integration_consent", administration: "web", operation: "desktop", enforcement: "backend" },
  { capability: "environment_policy", administration: "web", operation: "desktop", enforcement: "backend" },
  { capability: "ai_model_policy", administration: "web", operation: "desktop", enforcement: "backend" },
  { capability: "agent_identity_and_autonomy", administration: "web", operation: "desktop", enforcement: "backend" },
  { capability: "billing_and_ai_credits", administration: "web", operation: "web", enforcement: "backend" },
  { capability: "approval_inbox", administration: "web", operation: "desktop", enforcement: "backend" },
  { capability: "audit_and_security", administration: "web", operation: "web", enforcement: "backend" },
  { capability: "repository_engineering", administration: "web", operation: "desktop", enforcement: "backend" },
  { capability: "deployment_execution", administration: "web", operation: "desktop", enforcement: "backend" },
  { capability: "autonomous_execution", administration: "web", operation: "backend", enforcement: "backend" },
] as const satisfies readonly CapabilityOwnership[];

export type PlatformCapability = (typeof CAPABILITY_OWNERSHIP)[number]["capability"];

export function ownershipFor(capability: PlatformCapability): CapabilityOwnership {
  const ownership = CAPABILITY_OWNERSHIP.find((entry) => entry.capability === capability);
  if (!ownership) throw new Error(`Unknown platform capability: ${capability}`);
  return ownership;
}

import "server-only";

export const DESKTOP_CAPABILITIES = [
  "workspace:read",
  "github:read",
  "github:write",
  "agent:approve",
  "deploy:execute",
  "deploy:production_bypass",
  "policy:manage",
  "members:manage",
  "connections:manage",
] as const;

export type DesktopCapability = (typeof DESKTOP_CAPABILITIES)[number];
export type DesktopWorkspaceRole = "owner" | "admin" | "operator" | "security_reviewer" | "finance_viewer" | "read_only";

const READ_CAPABILITIES: DesktopCapability[] = ["workspace:read", "github:read"];

const ROLE_CAPABILITIES: Record<DesktopWorkspaceRole, readonly DesktopCapability[]> = {
  owner: DESKTOP_CAPABILITIES,
  admin: DESKTOP_CAPABILITIES,
  operator: [...READ_CAPABILITIES, "github:write", "deploy:execute"],
  security_reviewer: [...READ_CAPABILITIES, "agent:approve"],
  finance_viewer: ["workspace:read"],
  read_only: READ_CAPABILITIES,
};

export function capabilitiesForRole(role: DesktopWorkspaceRole): DesktopCapability[] {
  return [...ROLE_CAPABILITIES[role]];
}

export function hasDesktopCapability(
  role: DesktopWorkspaceRole | null | undefined,
  capability: DesktopCapability,
): boolean {
  return role ? ROLE_CAPABILITIES[role].includes(capability) : false;
}

export function isWorkspaceAdminRole(role: DesktopWorkspaceRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

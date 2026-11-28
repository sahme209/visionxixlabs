/**
 * Custom roles (pure, client-safe). A custom role removes capabilities from a member's built-in
 * role and can never add any. The capability list mirrors DESKTOP_CAPABILITIES (checked in tests).
 */
export const CAPABILITY_CATALOG = [
  { id: "workspace:read", label: "See the workspace", help: "Read environments, releases, checks and history." },
  { id: "github:read", label: "Read repositories", help: "Read connected GitHub repositories and pull requests." },
  { id: "github:write", label: "Change repositories", help: "Create branches, commit files and open pull requests." },
  { id: "agent:approve", label: "Approve agent actions", help: "Approve or reject actions agents propose." },
  { id: "deploy:execute", label: "Deploy", help: "Start deployments that pass the environment's gates." },
  { id: "deploy:production_bypass", label: "Emergency production bypass", help: "Use the audited emergency bypass of production gates." },
  { id: "policy:manage", label: "Manage policies", help: "Change approval rules, rings, windows and checks." },
  { id: "members:manage", label: "Manage members", help: "Invite, remove and change members." },
  { id: "connections:manage", label: "Manage connections", help: "Connect and disconnect integrations." },
] as const;
export type CatalogCapability = (typeof CAPABILITY_CATALOG)[number]["id"];
const KNOWN: ReadonlySet<string> = new Set(CAPABILITY_CATALOG.map((c) => c.id));

/** The base role's capabilities minus the removed ones, in catalog order. */
export function restrictCapabilities<T extends string>(base: readonly T[], removed: readonly string[]): T[] {
  const drop = new Set(removed);
  return base.filter((c) => !drop.has(c));
}

/** Validates a custom role definition: a name and a list of known capabilities to remove. */
export function validateCustomRole(input: unknown): { ok: true; role: { name: string; description: string; removedCapabilities: CatalogCapability[] } } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "invalid_payload" };
  const r = input as { name?: unknown; description?: unknown; removedCapabilities?: unknown };
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name || name.length > 60 || /[\u0000-\u001f]/.test(name)) return { ok: false, error: "name_invalid" };
  const description = typeof r.description === "string" ? r.description.trim().slice(0, 300) : "";
  if (!Array.isArray(r.removedCapabilities) || r.removedCapabilities.some((c) => typeof c !== "string" || !KNOWN.has(c))) return { ok: false, error: "capability_unknown" };
  const removed = [...new Set(r.removedCapabilities as CatalogCapability[])];
  if (removed.length === 0) return { ok: false, error: "nothing_removed" };
  return { ok: true, role: { name, description, removedCapabilities: CAPABILITY_CATALOG.map((c) => c.id).filter((c) => removed.includes(c)) } };
}

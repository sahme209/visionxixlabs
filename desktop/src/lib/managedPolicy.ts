/**
 * Organization-managed policy (pure). IT deploys one small JSON file; the app reads it at start-up:
 *   { "managedBy": "Example Health IT", "allowedWorkspaceIds": ["org_..."], "updateNotices": false, "serverUrl": "https://v19.example.com" }
 * Every field is optional. A file that exists but cannot be read or parsed locks the app (fail closed),
 * because a broken file must not silently drop a company's restriction.
 */
export interface ManagedPolicy { managedBy: string | null; allowedWorkspaceIds: string[] | null; updateNotices: boolean; serverUrl: string | null }
export type ManagedPolicyState =
  | { kind: "none" }
  | { kind: "ok"; path: string; policy: ManagedPolicy }
  | { kind: "invalid"; path: string; reason: string };

export type ManagedPolicyFile = { status: "none" } | { status: "found"; path: string; contents: string } | { status: "invalid"; path: string; reason: string };

const KEYS = new Set(["managedBy", "allowedWorkspaceIds", "updateNotices", "serverUrl"]);

/** A plain HTTPS origin, the same rule the native side applies (server_origin.rs). */
export function managedServerOrigin(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 255) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && !u.username && !u.password && (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash ? u.origin : null;
  } catch { return null; }
}

export function parseManagedPolicy(file: ManagedPolicyFile): ManagedPolicyState {
  if (file.status === "none") return { kind: "none" };
  if (file.status === "invalid") return { kind: "invalid", path: file.path, reason: file.reason };
  let raw: unknown;
  try { raw = JSON.parse(file.contents); } catch { return { kind: "invalid", path: file.path, reason: "not_json" }; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { kind: "invalid", path: file.path, reason: "not_an_object" };
  const r = raw as Record<string, unknown>;
  const unknown = Object.keys(r).find((k) => !KEYS.has(k));
  if (unknown) return { kind: "invalid", path: file.path, reason: `unknown_setting:${unknown.slice(0, 40)}` };
  if (r.managedBy !== undefined && (typeof r.managedBy !== "string" || !r.managedBy.trim() || r.managedBy.length > 80 || /[\u0000-\u001f]/.test(r.managedBy))) return { kind: "invalid", path: file.path, reason: "managedBy" };
  if (r.updateNotices !== undefined && typeof r.updateNotices !== "boolean") return { kind: "invalid", path: file.path, reason: "updateNotices" };
  if (r.serverUrl !== undefined && !managedServerOrigin(r.serverUrl)) return { kind: "invalid", path: file.path, reason: "serverUrl" };
  let allowed: string[] | null = null;
  if (r.allowedWorkspaceIds !== undefined) {
    if (!Array.isArray(r.allowedWorkspaceIds) || r.allowedWorkspaceIds.length === 0 || r.allowedWorkspaceIds.length > 50 || !r.allowedWorkspaceIds.every((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id))) return { kind: "invalid", path: file.path, reason: "allowedWorkspaceIds" };
    allowed = [...new Set(r.allowedWorkspaceIds as string[])];
  }
  return { kind: "ok", path: file.path, policy: { managedBy: typeof r.managedBy === "string" ? r.managedBy.trim() : null, allowedWorkspaceIds: allowed, updateNotices: r.updateNotices !== false, serverUrl: r.serverUrl === undefined ? null : managedServerOrigin(r.serverUrl) } };
}

/** Whether the signed-in workspace may be used under the organization's policy. */
export function workspaceAllowed(state: ManagedPolicyState, organizationId: string): "allowed" | "not_allowed" | "policy_invalid" {
  if (state.kind === "invalid") return "policy_invalid";
  if (state.kind === "none" || !state.policy.allowedWorkspaceIds) return "allowed";
  return state.policy.allowedWorkspaceIds.includes(organizationId) ? "allowed" : "not_allowed";
}

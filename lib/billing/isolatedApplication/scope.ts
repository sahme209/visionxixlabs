import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { isolatedRuntimeRequested } from "./runtime";
import { validatedIsolatedRuntime } from "./databaseTarget";
type Scope = { organizationId: string; userId: string; kind: "read" | "admission" };
const scopes = new AsyncLocalStorage<Scope>();
export function withIsolatedWorkspaceScope<T>(context: { isAuthenticated: boolean; organizationId?: unknown; userId?: unknown; roles: string[] }, kind: Scope["kind"], operation: () => T): T {
  if (!isolatedRuntimeRequested()) return operation();
  const config = validatedIsolatedRuntime();
  const organizationId = String(context.organizationId ?? ""), userId = String(context.userId ?? "");
  if (!context.isAuthenticated || !userId || !config.organizations.includes(organizationId) || !context.roles.length || kind === "admission" && !context.roles.some(r => r === "owner" || r === "admin")) throw new Error("isolated_workspace_authority_required");
  return scopes.run({ organizationId, userId, kind }, operation);
}
export function requireIsolatedWorkspaceScope(organizationId: string, kind: Scope["kind"]) {
  const config = validatedIsolatedRuntime();
  const scope = scopes.getStore();
  if (!scope || scope.organizationId !== organizationId || !config.organizations.includes(organizationId) || kind === "admission" && scope.kind !== "admission") throw new Error("isolated_entrypoint_unsupported");
  return { ...config, scope };
}

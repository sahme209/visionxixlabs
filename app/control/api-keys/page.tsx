import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { ApiKeysManager } from "@/components/cockpit/ApiKeysManager";

export const dynamic = "force-dynamic";

/** /control/api-keys — workspace owners/admins mint and revoke scoped, expiring API keys (agent gateway, CI). */
export default async function ApiKeysPage() {
  const ctx = await currentContext();
  if (ctx.isAuthenticated && !ctx.organizationId) redirect("/control/workspaces");
  if (!ctx.isAuthenticated || !ctx.organizationId) redirect("/auth/signin?callbackUrl=%2Fcontrol%2Fapi-keys");
  const canManage = ctx.sessionUserId ? await authorizedForOrganization(String(ctx.sessionUserId), String(ctx.organizationId), true) : false;
  return (
    <div>
      <h1>API keys</h1>
      <p className="mt-1 max-w-2xl text-[13px] leading-5 text-zinc-400">Keys let AI agents (through the MCP gateway) and CI pipelines (through <code className="font-mono">vxl ask</code>) ask Axiom before acting. Keys are limited to governance and read scopes and always expire. Whoever creates a key cannot approve requests made with it.</p>
      {canManage ? <ApiKeysManager /> : <p role="alert" className="mt-4 text-sm text-zinc-400">Only workspace owners and admins can manage API keys.</p>}
    </div>
  );
}

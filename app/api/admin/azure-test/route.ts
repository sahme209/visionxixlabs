/**
 * GET /api/admin/azure-test — admin only.
 *
 * Proves the Azure service-principal works by:
 *   1. ClientSecretCredential token mint (auth chain)
 *   2. SubscriptionClient.subscriptions.get (subscription is reachable)
 *   3. ResourceManagementClient.resourceGroups.list (Reader RBAC verified)
 *
 * Returns subscription metadata + resource-group count. Never echoes the
 * client secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ClientSecretCredential } from "@azure/identity";
import { SubscriptionClient } from "@azure/arm-subscriptions";
import { ResourceManagementClient } from "@azure/arm-resources";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const tenantId = process.env.AZURE_TENANT_ID?.trim();
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID?.trim();

  const envDebug = {
    tenantIdSet: !!tenantId,
    clientIdSet: !!clientId,
    clientSecretSet: !!clientSecret,
    subscriptionIdSet: !!subscriptionId,
    tenantIdLooksLikeGuid: tenantId ? /^[0-9a-f-]{36}$/i.test(tenantId) : false,
    clientIdLooksLikeGuid: clientId ? /^[0-9a-f-]{36}$/i.test(clientId) : false,
    subscriptionIdLooksLikeGuid: subscriptionId ? /^[0-9a-f-]{36}$/i.test(subscriptionId) : false,
    clientSecretLength: clientSecret?.length ?? 0,
  };

  if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
    return NextResponse.json({
      ok: false,
      stage: "env_check",
      reason: "Missing one of AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_SUBSCRIPTION_ID.",
      envDebug,
    });
  }

  try {
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

    // Step 1: subscription metadata
    const subClient = new SubscriptionClient(credential);
    const sub = await subClient.subscription.get(subscriptionId);

    // Step 2: resource-group read (proves Reader RBAC)
    const resClient = new ResourceManagementClient(credential, subscriptionId);
    const groups: { name?: string; location?: string }[] = [];
    for await (const g of resClient.resourceGroups.list()) {
      groups.push({ name: g.name, location: g.location });
      if (groups.length >= 10) break;
    }

    return NextResponse.json({
      ok: true,
      stage: "azure_subscription_read",
      subscription: {
        id: sub.subscriptionId ?? subscriptionId,
        displayName: sub.displayName ?? "",
        state: sub.state ?? "",
        tenantId: sub.tenantId ?? "",
      },
      resourceGroupCount: groups.length,
      resourceGroupSample: groups,
      envDebug,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      stage: "azure_call",
      reason: msg.slice(0, 500),
      envDebug,
    });
  }
}

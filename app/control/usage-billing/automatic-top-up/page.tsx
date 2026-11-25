import { redirect } from "next/navigation";
import { AutomaticTopUpSetupPanel } from "@/components/billing/AutomaticTopUpSetupPanel";
import { currentContext } from "@/lib/auth/currentContext";
import { isTenantAdmin } from "@/lib/auth/platformAdmin";
import { ADD_ON_CATALOG, isOfferedAddOn } from "@/lib/billing/addOnCatalog";
import { automaticTopUpSetupPublishableKey } from "@/lib/billing/automaticTopUpSetupPage";
import { automaticTopUpSetupRuntime } from "@/lib/billing/automaticAICreditTopUpSetupRuntime";

export const dynamic = "force-dynamic";

export default async function AutomaticTopUpPage() {
  const context = await currentContext();
  const key = automaticTopUpSetupPublishableKey();
  if (!key || !context.isAuthenticated || !context.organizationId || !isTenantAdmin(context.roles)) redirect("/control/usage-billing");
  const runtime = (() => {
    try { return automaticTopUpSetupRuntime(); } catch { return null; }
  })();
  if (!runtime) redirect("/control/usage-billing");
  const packs = ADD_ON_CATALOG.filter(isOfferedAddOn).map(({ sku, priceCents }) => ({ sku, priceCents }));
  const organizationId = String(context.organizationId);
  return (
    <div className="max-w-3xl">
      <a href="/control/usage-billing" className="text-sm text-zinc-300 underline underline-offset-4">Back to Usage &amp; billing</a>
      <AutomaticTopUpSetupPanel key={organizationId} organizationId={organizationId}
        publishableKey={key} packs={packs} providerConfigured={runtime.providerConfigured} />
    </div>
  );
}

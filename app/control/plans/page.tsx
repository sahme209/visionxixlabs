import { currentContext } from "@/lib/auth/currentContext";
import { redirect } from "next/navigation";
import { PublicPlansCatalog, type PublicCheckoutWorkspace } from "@/components/billing/PublicPlansCatalog";
import { parsePublicPlanSelection } from "@/lib/billing/planSelection";
import { isSelfServiceBillingEnabled } from "@/lib/billing/publicPlanCatalog";
export const dynamic = "force-dynamic";
export default async function CockpitPlansPage({searchParams}: {searchParams?: Promise<{plan?: string | string[]; interval?: string | string[]}>}) {
  const params = await searchParams ?? {};
  const selection = parsePublicPlanSelection(params);
  const context = await currentContext();
  if (!context.isAuthenticated) {
    const target = selection ? `/control/plans?plan=${selection.planId}&interval=${selection.billingInterval}` : "/control/plans";
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(target)}`);
  }
  const workspace: PublicCheckoutWorkspace = context.organizationId && context.roles.length ? {status:"ready",organizationId:String(context.organizationId),label:context.workspaceLabel ?? "Current workspace"} : {status:"unavailable"};
  return <div className="[&_section]:px-0 [&_section]:pb-0 [&_article]:min-h-0 [&_article]:rounded-xl [&_article]:p-5"><h1>Choose your plan</h1><p className="mb-8 mt-3 max-w-xl text-sm leading-6 text-zinc-400">Review your plan, billing interval, and workspace before continuing to secure checkout. Your access changes only after verified payment.</p><PublicPlansCatalog checkoutEnabled={isSelfServiceBillingEnabled()} initialSelection={selection} workspace={workspace}/></div>;
}

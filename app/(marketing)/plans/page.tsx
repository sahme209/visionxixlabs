import { ownedPlansBinding, ownedPlansIntentState } from "@/lib/billing/ownedCheckoutBridge/http";
import { isolatedRuntimeRequested } from "@/lib/billing/isolatedApplication/runtime";
import type { Metadata } from "next";
import Link from "next/link";
import { COUNTED_DEPLOYMENT_DEFINITION, isSelfServiceBillingEnabled } from "@/lib/billing/publicPlanCatalog";
import { currentContext } from "@/lib/auth/currentContext";
import { parsePublicPlanSelection } from "@/lib/billing/planSelection";
import type { PublicCheckoutWorkspace, OwnedCheckoutIntentState } from "@/components/billing/PublicPlansCatalog";
import { PublicPlansCatalog } from "@/components/billing/PublicPlansCatalog";

export const metadata: Metadata = {
  title: "Axiom pricing",
  alternates: { canonical: "/plans" },
  description:
    "Transparent Free, Pro, and Enterprise plans for governed deployments, with activation protected until billing authority and quota enforcement are validated.",
};

export default async function PlansPage({ searchParams }: { searchParams?: Promise<{ plan?: string | string[]; interval?: string | string[]; checkout?: string | string[] }> }) {
  const ownedBinding = isolatedRuntimeRequested() ? await ownedPlansBinding() : null;
  const ownedTestCheckout = !!ownedBinding;
  const checkoutEnabled = isolatedRuntimeRequested() ? ownedTestCheckout : isSelfServiceBillingEnabled();
  const params = await searchParams ?? {};
  const initialSelection = parsePublicPlanSelection(params);
  const cancellationReturnContext = params.checkout === "canceled";
  let ownedIntentState: OwnedCheckoutIntentState = "unavailable";
  let workspace: PublicCheckoutWorkspace = { status: "unavailable" };
  if (checkoutEnabled) {
    try {
      const context = await currentContext();
      workspace = !context.isAuthenticated ? { status: "signed_out" }
        : context.organizationId && context.roles.length > 0 && (!ownedBinding || ownedBinding.organizationId === String(context.organizationId)) ? { status: "ready", organizationId: String(context.organizationId), label: context.workspaceLabel ?? "Current workspace" }
          : { status: "unavailable" };
      if (ownedTestCheckout && workspace.status === "ready" && context.userId) ownedIntentState = await ownedPlansIntentState(String(context.userId), workspace.organizationId);
    } catch { /* A public price page remains readable without billing authority. */ }
  }
  return (
    <main className="public-pricing-page relative isolate overflow-hidden [&_article]:min-h-0 [&_article]:rounded-xl [&_article]:p-6 [&_article]:shadow-none">
      {cancellationReturnContext && <p role="status" className="mx-auto mt-6 max-w-[1280px] px-5 text-sm leading-6 text-zinc-400 sm:px-8 lg:px-12">Back from checkout. This page makes no subscription changes and the URL does not confirm a payment outcome. Review your selection to try again, or <Link href="/control/usage-billing" className="text-orange-300 underline underline-offset-4">Review workspace billing</Link>.</p>}
      <section className="mx-auto max-w-[1280px] px-5 pb-12 pt-16 sm:px-8 sm:pt-24 lg:px-12 lg:pb-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">Pricing</p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-end lg:gap-16">
          <h1 className="max-w-2xl text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.04] tracking-[-0.05em] text-zinc-100">
            Start useful.<br /><span className="text-zinc-400">Grow deliberately.</span>
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-400">
            Security, approval gates, and audit protection stay in every plan. Choose monthly or annual billing; activation remains locked until organization billing and quotas complete review.
          </p>
        </div>
        <div className="mt-8 inline-flex items-start gap-2 border-l-2 border-orange-400/70 pl-3 text-xs leading-5 text-zinc-400">
          {ownedTestCheckout ? "Owned TEST checkout rehearsal · no live billing" : checkoutEnabled ? "Secure self-service checkout available" : "Pricing preview · no charges can be started from this page"}
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] [&>section]:pb-12 lg:[&>section]:pb-16">
        <PublicPlansCatalog ownedIntentState={ownedIntentState} ownedTestCheckout={ownedTestCheckout} checkoutEnabled={checkoutEnabled} initialSelection={initialSelection} workspace={workspace} />
      </div>

      <section className="border-y border-white/[0.07] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="mx-auto grid max-w-[1184px] gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Clear usage accounting</p>
            <h2 className="mt-3 max-w-sm text-2xl font-medium leading-tight tracking-[-0.035em] text-zinc-100 sm:text-3xl">What counts as a deployment?</h2>
          </div>
          <div>
            <p className="text-base leading-7 text-zinc-200">{COUNTED_DEPLOYMENT_DEFINITION}</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
              Validation retries, polling, and automatic rollback for the same dispatch do not count again. Rejected, canceled, or failed-to-dispatch proposals do not count at all.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-20">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">No billing decision required</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-medium tracking-[-0.035em] text-zinc-100 sm:text-3xl">See the workflow before choosing a plan.</h2>
        </div>
        <Link href="/demo" className="inline-flex min-h-11 shrink-0 items-center justify-center self-start rounded-lg border border-white/15 px-5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.04] lg:self-auto">
          Explore the interactive demo
        </Link>
      </section>
    </main>
  );
}

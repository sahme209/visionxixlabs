import type { Metadata } from "next";
import Link from "next/link";
import { COUNTED_DEPLOYMENT_DEFINITION, isSelfServiceBillingEnabled } from "@/lib/billing/publicPlanCatalog";
import { currentContext } from "@/lib/auth/currentContext";
import { parsePublicPlanSelection } from "@/lib/billing/planSelection";
import type { PublicCheckoutWorkspace } from "@/components/billing/PublicPlansCatalog";
import { PublicPlansCatalog } from "@/components/billing/PublicPlansCatalog";

export const metadata: Metadata = {
  title: "Axiom pricing",
  alternates: { canonical: "/plans" },
  description:
    "Transparent Free, Pro, and Enterprise plans for governed deployments, with activation protected until billing authority and quota enforcement are validated.",
};

export default async function PlansPage({ searchParams }: { searchParams?: Promise<{ plan?: string | string[]; interval?: string | string[] }> } = {}) {
  const checkoutEnabled = isSelfServiceBillingEnabled();
  const initialSelection = parsePublicPlanSelection(await searchParams ?? {});
  let workspace: PublicCheckoutWorkspace = { status: "unavailable" };
  if (checkoutEnabled) {
    try {
      const context = await currentContext();
      workspace = !context.isAuthenticated ? { status: "signed_out" }
        : context.organizationId && context.roles.length > 0 ? { status: "ready", organizationId: String(context.organizationId), label: context.workspaceLabel ?? "Current workspace" }
          : { status: "unavailable" };
    } catch { /* A public price page remains readable without billing authority. */ }
  }
  return (
    <main className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_50%_0%,rgba(245,78,0,0.10),transparent_62%)]"
      />

      <section className="mx-auto max-w-[1400px] px-5 pb-16 pt-20 text-center sm:px-8 sm:pt-28 lg:px-12 lg:pb-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#ff783d]">
          Simple, organization-first pricing
        </p>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-medium leading-[0.98] tracking-[-0.055em] text-zinc-100 sm:text-6xl lg:text-7xl">
          Start useful. Upgrade when the workflow earns it.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
          Security, approval gates, and audit protection stay in every plan. Choose monthly or annual billing; activation remains locked until organization billing and quotas complete review.
        </p>
        <div className="mx-auto mt-8 inline-flex rounded-full border border-[#f54e00]/25 bg-[#f54e00]/[0.07] px-4 py-2 text-xs text-[#ff9a72]">
          {checkoutEnabled ? "Secure self-service checkout available" : "Pricing preview · no charges can be started from this page"}
        </div>
      </section>

      <PublicPlansCatalog checkoutEnabled={checkoutEnabled} initialSelection={initialSelection} workspace={workspace} />

      <section className="border-y border-white/[0.07] bg-[#171717] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#ff783d]">Clear usage accounting</p>
            <h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] text-zinc-100">What counts as a deployment?</h2>
          </div>
          <div className="rounded-2xl border border-white/[0.09] bg-[#1a1a1a] p-6 sm:p-8">
            <p className="text-base leading-7 text-zinc-200">{COUNTED_DEPLOYMENT_DEFINITION}</p>
            <p className="mt-4 text-sm leading-6 text-zinc-500">
              Validation retries, polling, and automatic rollback for the same dispatch do not count again. Rejected, canceled, or failed-to-dispatch proposals do not count at all.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="rounded-3xl border border-white/[0.09] bg-[#1a1a1a] p-7 sm:p-10 lg:flex lg:items-end lg:justify-between lg:gap-12">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">No billing decision required</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-5xl">See the workflow before choosing a plan.</h2>
          </div>
          <Link href="/demo" className="mt-8 inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 px-6 text-sm font-semibold text-zinc-950 hover:bg-white lg:mt-0">
            Explore the interactive demo
          </Link>
        </div>
      </section>
    </main>
  );
}

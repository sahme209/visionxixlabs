import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon } from "@heroicons/react/24/outline";
import {
  COUNTED_DEPLOYMENT_DEFINITION,
  PUBLIC_PLAN_CATALOG,
} from "@/lib/billing/publicPlanCatalog";

export const metadata: Metadata = {
  title: "Axiom pricing",
  description:
    "Proposed Free, Pro, and Enterprise plans for governed deployments. Checkout remains disabled while billing authority and quota enforcement are validated.",
};

function priceLabel(price: number) {
  if (price === 0) return "$0";
  return `$${(price / 100).toFixed(0)}`;
}

export default function PlansPage() {
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
          Security, approval gates, and audit protection stay in every plan. Paid checkout is intentionally off while organization billing, quotas, and webhook authority complete review.
        </p>
        <div className="mx-auto mt-8 inline-flex rounded-full border border-[#f54e00]/25 bg-[#f54e00]/[0.07] px-4 py-2 text-xs text-[#ff9a72]">
          Pricing preview · no charges can be started from this page
        </div>
      </section>

      <section className="mx-auto grid max-w-[1400px] gap-4 px-5 pb-20 sm:px-8 lg:grid-cols-3 lg:px-12 lg:pb-28">
        {PUBLIC_PLAN_CATALOG.map((plan) => {
          const featured = plan.id === "pro";
          return (
            <article
              key={plan.id}
              className={`flex min-h-[520px] flex-col rounded-3xl border p-7 sm:p-8 ${
                featured
                  ? "border-[#f54e00]/40 bg-[#1a1a1a] shadow-[0_24px_80px_-42px_rgba(245,78,0,0.55)]"
                  : "border-white/[0.09] bg-[#181818]"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-medium tracking-[-0.03em] text-zinc-100">{plan.name}</h2>
                {featured ? (
                  <span className="rounded-full bg-[#f54e00] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-400">{plan.description}</p>

              <div className="mt-8 border-y border-white/[0.08] py-6">
                <span className="text-4xl font-medium tracking-[-0.05em] text-zinc-100">
                  {priceLabel(plan.monthlyPricePerUserCents)}
                </span>
                {plan.monthlyPricePerUserCents > 0 ? (
                  <span className="ml-2 text-sm text-zinc-500">per user / month</span>
                ) : null}
                {plan.monthlyPricePerUserCents > 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    ${(plan.annualPricePerUserCents / 100).toFixed(2)} per user/month equivalent, billed annually
                  </p>
                ) : null}
              </div>

              <ul className="mt-7 space-y-4">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-3 text-sm leading-6 text-zinc-300">
                    <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-[#ff783d]" aria-hidden />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-9">
                <Link
                  href="/download"
                  className={`flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
                    featured
                      ? "bg-[#f54e00] text-white hover:bg-[#ff641f]"
                      : "border border-white/[0.14] bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"
                  }`}
                >
                  Start with Axiom
                </Link>
              </div>
            </article>
          );
        })}
      </section>

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

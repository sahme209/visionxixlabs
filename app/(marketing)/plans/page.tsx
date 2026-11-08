import { ownedPlansBinding, ownedPlansIntentState } from "@/lib/billing/ownedCheckoutBridge/http";
import { isolatedRuntimeRequested } from "@/lib/billing/isolatedApplication/runtime";
import type { Metadata } from "next";
import Link from "next/link";
import { COUNTED_DEPLOYMENT_DEFINITION, isSelfServiceBillingEnabled } from "@/lib/billing/publicPlanCatalog";
import { AI_RATE_CARD, customerPriceCents, customerUsdPerMTok, providerCostBudgetCentsForPrice } from "@/lib/billing/aiRateCard";
import { ADD_ON_CATALOG } from "@/lib/billing/addOnCatalog";
import { currentContext } from "@/lib/auth/currentContext";
import { parsePublicPlanSelection } from "@/lib/billing/planSelection";
import type { PublicCheckoutWorkspace, OwnedCheckoutIntentState } from "@/components/billing/PublicPlansCatalog";
import { PublicPlansCatalog } from "@/components/billing/PublicPlansCatalog";

export const metadata: Metadata = {
  title: "Get started with Axiom",
  alternates: { canonical: "/plans" },
  description:
    "Axiom is free to explore. Optional prepaid AI credits are the only paid part: exact per-model rates, the cost shown before each action, and never a charge beyond what you prepaid.",
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const perMTok = (value: number) => `$${value.toFixed(2)}`;

// Worked example from the rate card: 20,000 input tokens and 4,096 output
// tokens on the paid-lane model. Provider cost is rounded up to whole cents.
const EXAMPLE_INPUT_TOKENS = 20_000;
const EXAMPLE_OUTPUT_TOKENS = 4_096;
const exampleRate = AI_RATE_CARD.perModelRates[0];
const exampleProviderCents = Math.ceil(
  (EXAMPLE_INPUT_TOKENS * exampleRate.providerUsdPerMTok.input + EXAMPLE_OUTPUT_TOKENS * exampleRate.providerUsdPerMTok.output) / 10_000,
);
const exampleCustomerCents = customerPriceCents(exampleProviderCents);

const CREDIT_PACKS = ADD_ON_CATALOG.filter((pack) => pack.category === "ai_credits");

export default async function PlansPage({ searchParams }: { searchParams?: Promise<{ plan?: string | string[]; interval?: string | string[]; checkout?: string | string[] }> }) {
  const params = await searchParams ?? {};
  const cancellationReturnContext = params.checkout === "canceled";
  // Prepaid AI credits are bought with the existing one-time Stripe Checkout
  // from workspace billing, behind the existing self-service gate.
  const isolated = isolatedRuntimeRequested();
  const creditPurchasesOpen = !isolated && isSelfServiceBillingEnabled();

  // Owned TEST checkout rehearsal: only inside the isolated synthetic test
  // runtime (never in production). Seat plans are not offered publicly.
  const ownedBinding = isolated ? await ownedPlansBinding() : null;
  let ownedIntentState: OwnedCheckoutIntentState = "unavailable";
  let workspace: PublicCheckoutWorkspace = { status: "unavailable" };
  if (ownedBinding) {
    try {
      const context = await currentContext();
      workspace = !context.isAuthenticated ? { status: "signed_out" }
        : context.organizationId && context.roles.length > 0 && ownedBinding.organizationId === String(context.organizationId) ? { status: "ready", organizationId: String(context.organizationId), label: context.workspaceLabel ?? "Current workspace" }
          : { status: "unavailable" };
      if (workspace.status === "ready" && context.userId) ownedIntentState = await ownedPlansIntentState(String(context.userId), workspace.organizationId);
    } catch { /* The public page stays readable without billing authority. */ }
  }

  return (
    <main className="public-pricing-page relative isolate overflow-hidden">
      {cancellationReturnContext && <p role="status" className="mx-auto mt-6 max-w-[1280px] px-5 text-sm leading-6 text-zinc-400 sm:px-8 lg:px-12">Back from checkout. This page makes no billing changes and the URL does not confirm a payment outcome. <Link href="/control/usage-billing" className="text-orange-300 underline underline-offset-4">Review workspace billing</Link>.</p>}

      <section className="mx-auto max-w-[1280px] px-5 pb-12 pt-16 sm:px-8 sm:pt-24 lg:px-12 lg:pb-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">Get started</p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-end lg:gap-16">
          <h1 className="max-w-2xl text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.04] tracking-[-0.05em] text-zinc-100">
            Free to explore.<br /><span className="text-zinc-400">Prepay only for the AI you use.</span>
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-400">
            Approvals, audit history and recovery are part of Axiom for every workspace. AI usage is the only paid part. It is prepaid, its cost is shown before each action, and you are never charged more than you prepaid.
          </p>
        </div>
      </section>

      <section aria-label="How Axiom is offered" className="mx-auto grid max-w-[1280px] gap-4 px-5 pb-12 sm:px-8 lg:grid-cols-3 lg:px-12 lg:pb-16">
        <article className="flex flex-col rounded-xl border border-white/[0.09] bg-[#181818] p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Axiom</p>
          <h2 className="mt-2 text-xl font-medium tracking-[-0.03em] text-zinc-100">Free to explore</h2>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
            <li>{AI_RATE_CARD.freeMonthlyDeployments} counted deployments per organization each month</li>
            <li>Approval gates, audit history and recovery included</li>
            <li>No card required to create a workspace</li>
          </ul>
          <div className="mt-auto pt-8">
            <Link href={`/auth/signin?callbackUrl=${encodeURIComponent("/control")}`} className="flex min-h-11 items-center justify-center rounded-lg bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white">Create workspace</Link>
          </div>
        </article>

        <article className="flex flex-col rounded-xl border border-[#f54e00]/40 bg-[#1a1a1a] p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">AI usage</p>
          <h2 className="mt-2 text-xl font-medium tracking-[-0.03em] text-zinc-100">Prepaid credits, the only paid part</h2>
          <figure className="mt-5 rounded-lg border border-white/[0.08] bg-black/30 p-4" aria-label="Example credit meter">
            <figcaption className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Example credit meter</figcaption>
            <div className="mt-3 flex items-baseline justify-between text-sm text-zinc-300"><span>Prepaid balance</span><span className="tabular-nums text-zinc-100">{usd(AI_RATE_CARD.minimumTopUpCents)}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden><div className="h-full w-full rounded-full bg-[#ff783d]" /></div>
            <p className="mt-3 text-xs leading-5 text-zinc-400">Shown before you run it: a typical code analysis costs about {usd(exampleCustomerCents)}.</p>
          </figure>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
            <li>Cost shown before each action</li>
            <li>Never charged more than you prepaid</li>
            <li>Minimum top-up {usd(AI_RATE_CARD.minimumTopUpCents)}; credits never expire</li>
          </ul>
          <div className="mt-auto flex flex-col gap-3 pt-8">
            <a href="#ai-rates" className="flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.04]">See AI rates</a>
            {creditPurchasesOpen
              ? <Link href="/dashboard/billing/add-ons" className="flex min-h-11 items-center justify-center rounded-lg bg-[#f54e00] px-5 text-sm font-semibold text-white transition hover:bg-[#ff641f]">Buy prepaid credits</Link>
              : <p className="text-xs leading-5 text-zinc-500">Credit purchases are not open yet. No charge can be started from this page.</p>}
          </div>
        </article>

        <article className="flex flex-col rounded-xl border border-white/[0.09] bg-[#181818] p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Enterprise</p>
          <h2 className="mt-2 text-xl font-medium tracking-[-0.03em] text-zinc-100">Scoped evaluation</h2>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
            <li>Free, time-boxed evaluation of {AI_RATE_CARD.enterpriseEvaluation.minDays}–{AI_RATE_CARD.enterpriseEvaluation.maxDays} days</li>
            <li>Capped AI credit grant agreed for the evaluation</li>
            <li>Bring your own key (BYOK) {AI_RATE_CARD.byok}</li>
          </ul>
          <div className="mt-auto pt-8">
            <Link href="/contact" className="flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.04]">Talk to us</Link>
          </div>
        </article>
      </section>

      <section id="ai-rates" aria-labelledby="ai-rates-heading" className="border-y border-white/[0.07] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-[1184px]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Before any charge</p>
          <h2 id="ai-rates-heading" className="mt-3 text-2xl font-medium tracking-[-0.035em] text-zinc-100 sm:text-3xl">AI rates, limits and refunds</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Rate card <span className="text-zinc-200">{AI_RATE_CARD.version}</span>, effective {AI_RATE_CARD.effectiveDate}. Customer price is {AI_RATE_CARD.marginMultiplier}× the provider&apos;s published token cost.
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Per-model AI rates in USD per million tokens</caption>
              <thead className="text-xs text-zinc-500">
                <tr><th scope="col" className="py-2 pr-4 font-medium">Model</th><th scope="col" className="py-2 pr-4 font-medium">Input</th><th scope="col" className="py-2 pr-4 font-medium">Cached input</th><th scope="col" className="py-2 pr-4 font-medium">Output</th></tr>
              </thead>
              <tbody className="text-zinc-200">
                {AI_RATE_CARD.perModelRates.map((rate) => (
                  <tr key={rate.model} className="border-t border-white/[0.07]">
                    <th scope="row" className="py-3 pr-4 font-medium">{rate.displayName}</th>
                    <td className="py-3 pr-4 tabular-nums">{perMTok(customerUsdPerMTok(rate, "input"))} / 1M tokens</td>
                    <td className="py-3 pr-4 tabular-nums">{perMTok(customerUsdPerMTok(rate, "cachedInput"))} / 1M tokens</td>
                    <td className="py-3 pr-4 tabular-nums">{perMTok(customerUsdPerMTok(rate, "output"))} / 1M tokens</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Example: {EXAMPLE_INPUT_TOKENS.toLocaleString("en-US")} input and {EXAMPLE_OUTPUT_TOKENS.toLocaleString("en-US")} output tokens on {exampleRate.displayName} cost {usd(exampleProviderCents)} at provider rates, so you pay {usd(exampleCustomerCents)}. Provider rates: {AI_RATE_CARD.providerRateSource}.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-medium text-zinc-100">Prepaid credit</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
                {CREDIT_PACKS.map((pack) => <li key={pack.sku}>{usd(pack.priceCents)} prepaid: {usd(pack.deliveredAICreditsCents)} of AI usage ({usd(providerCostBudgetCentsForPrice(pack.priceCents))} of provider cost)</li>)}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-100">Limits</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
                <li>{AI_RATE_CARD.freeMonthlyDeployments} counted deployments per organization each month. Design partners may receive a higher agreed limit.</li>
                <li>{COUNTED_DEPLOYMENT_DEFINITION} Retries, polling and automatic rollback of the same dispatch do not count again.</li>
                <li>Before an action runs, a conservative hold larger than the expected price is placed on your balance. You pay only the final price; the rest of the hold is released.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-100">Refunds</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
                {AI_RATE_CARD.refundRules.map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
            </div>
          </div>

          <div className="mt-10">
            <h3 className="text-sm font-medium text-zinc-100">Billing disclosures</h3>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-zinc-400 lg:grid-cols-2">
              {AI_RATE_CARD.disclosures.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {ownedBinding && (
        <section aria-label="Owned TEST checkout rehearsal" className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:px-12">
          <p className="border-l-2 border-orange-400/70 pl-3 text-xs leading-5 text-zinc-400">Owned TEST checkout rehearsal · synthetic test runtime only · no live billing</p>
          <PublicPlansCatalog ownedIntentState={ownedIntentState} ownedTestCheckout checkoutEnabled initialSelection={parsePublicPlanSelection(params)} workspace={workspace} />
        </section>
      )}

      <section className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-20">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">No billing decision required</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-medium tracking-[-0.035em] text-zinc-100 sm:text-3xl">See the workflow before you prepay anything.</h2>
        </div>
        <Link href="/demo" className="inline-flex min-h-11 shrink-0 items-center justify-center self-start rounded-lg border border-white/15 px-5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.04] lg:self-auto">
          Explore the interactive demo
        </Link>
      </section>
    </main>
  );
}

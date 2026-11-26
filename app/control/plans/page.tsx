import Link from "next/link";
import { currentContext } from "@/lib/auth/currentContext";
import { redirect } from "next/navigation";
import { PublicPlansCatalog, type PublicCheckoutWorkspace } from "@/components/billing/PublicPlansCatalog";
import { parsePublicPlanSelection } from "@/lib/billing/planSelection";
import { isSelfServiceBillingEnabled } from "@/lib/billing/publicPlanCatalog";
import { isolatedRuntimeRequested } from "@/lib/billing/isolatedApplication/runtime";
import { AI_RATE_CARD } from "@/lib/billing/aiRateCard";
export const dynamic = "force-dynamic";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * The cockpit's plan page follows the public offer on /plans: V19 is free to explore, prepaid AI credits
 * are the only paid part, and enterprises get a scoped evaluation. Seat-based plans are not offered; the
 * seat catalog appears only inside the isolated synthetic TEST runtime for checkout rehearsal.
 */
export default async function CockpitPlansPage({searchParams}: {searchParams?: Promise<{plan?: string | string[]; interval?: string | string[]}>}) {
  const params = await searchParams ?? {};
  const selection = parsePublicPlanSelection(params);
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated) {
    const target = selection ? `/control/plans?plan=${selection.planId}&interval=${selection.billingInterval}` : "/control/plans";
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(target)}`);
  }
  const isolated = isolatedRuntimeRequested();
  const creditPurchasesOpen = !isolated && isSelfServiceBillingEnabled();
  const workspace: PublicCheckoutWorkspace = context.organizationId && context.roles.length ? {status:"ready",organizationId:String(context.organizationId),label:context.workspaceLabel ?? "Current workspace"} : {status:"unavailable"};
  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight">Plan and credits</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">V19 is free to explore. Approvals, audit history and recovery are included for every workspace. AI usage is the only paid part: it is prepaid, its cost is shown before each action, and you are never charged more than you prepaid.</p>
      <section aria-label="How V19 is offered" className="mt-8 grid gap-4 lg:grid-cols-3">
        <article className="flex flex-col rounded-xl border border-white/15 bg-[#111111] p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Your workspace</p>
          <h2 className="mt-2 text-lg font-medium text-zinc-100">Free to explore</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-300">
            <li>No V19 monthly cap on deployments through your own runner</li>
            <li>Approval gates, audit history and recovery included</li>
            <li>No card required</li>
          </ul>
          <p className="mt-auto pt-6 text-xs text-zinc-400">{workspace.status === "ready" ? `${workspace.label} is on this plan.` : "Choose a workspace to see its plan."}</p>
        </article>
        <article className="flex flex-col rounded-xl border border-white/9 bg-[#111111] p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">AI usage</p>
          <h2 className="mt-2 text-lg font-medium text-zinc-100">Prepaid credits</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-300">
            <li>Cost shown before each action</li>
            <li>Never charged more than you prepaid</li>
            <li>Minimum top-up {usd(AI_RATE_CARD.minimumTopUpCents)}; credits never expire</li>
          </ul>
          <div className="mt-auto flex flex-col gap-2 pt-6">
            {creditPurchasesOpen
              ? <Link href="/control/usage-billing" className="flex min-h-10 items-center justify-center rounded-lg bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 hover:bg-white">Buy prepaid credits</Link>
              : <p className="text-xs leading-5 text-zinc-400">Credit purchases are not open yet. No charge can be started from this page.</p>}
            <Link href="/plans#ai-rates" className="text-center text-xs text-zinc-300 underline underline-offset-4">See AI rates</Link>
          </div>
        </article>
        <article className="flex flex-col rounded-xl border border-white/9 bg-[#111111] p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Enterprise</p>
          <h2 className="mt-2 text-lg font-medium text-zinc-100">Scoped evaluation</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-300">
            <li>Free, time-boxed evaluation of {AI_RATE_CARD.enterpriseEvaluation.minDays} to {AI_RATE_CARD.enterpriseEvaluation.maxDays} days</li>
            <li>Capped AI credit grant agreed for the evaluation</li>
            <li>Bring your own key (BYOK) {AI_RATE_CARD.byok}</li>
          </ul>
          <div className="mt-auto pt-6"><Link href="/contact" className="flex min-h-10 items-center justify-center rounded-lg border border-white/15 px-4 text-sm text-zinc-200 hover:bg-white/5">Talk to us</Link></div>
        </article>
      </section>
      <p className="mt-6 text-xs text-zinc-400">Balance, holds and credit transactions are on <Link href="/control/usage-billing" className="underline underline-offset-4">Usage &amp; billing</Link>.</p>
      {isolated && (
        <section aria-label="Owned TEST checkout rehearsal" className="mt-10 [&_section]:px-0 [&_section]:pb-0 [&_article]:min-h-0 [&_article]:rounded-xl [&_article]:p-5">
          <p className="border-l-2 border-orange-400/70 pl-3 text-xs leading-5 text-zinc-400">Owned TEST checkout rehearsal · synthetic test runtime only · no live billing</p>
          <PublicPlansCatalog checkoutEnabled={isSelfServiceBillingEnabled()} initialSelection={selection} workspace={workspace}/>
        </section>
      )}
    </div>
  );
}

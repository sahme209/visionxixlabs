import Link from "next/link";
import { CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/db";
import { createBadgeToken, recordedSupporterStatus } from "@/lib/supporters/core";

export const dynamic = "force-dynamic";

function describePurchase(status?: string) {
  switch (status) {
    case "paid":
      return { title: "Your support is confirmed.", detail: "Thank you for helping Vision XIX Labs advance V19 Agent.", badgeAvailable: true };
    case "partially_refunded":
      return { title: "Your payment was partially refunded.", detail: "A partial refund is recorded for this purchase.", badgeAvailable: true };
    case "refunded":
      return { title: "Your payment was refunded.", detail: "A full refund is recorded for this purchase. The supporter badge is no longer available.", badgeAvailable: false };
    case "failed":
      return { title: "Your payment did not complete.", detail: "This purchase has no confirmed payment. If you would like to try again, return to the Founding Supporters page.", badgeAvailable: false };
    case "expired":
      return { title: "This checkout expired.", detail: "To try again, start a new checkout from the Founding Supporters page.", badgeAvailable: false };
    case "pending":
      return { title: "Your payment is being confirmed.", detail: "Refresh this page shortly or check your email for a receipt. A checkout return alone does not confirm a payment.", badgeAvailable: false };
    default:
      return { title: "Payment status is unavailable.", detail: "If you received a receipt, use its reference when contacting support.", badgeAvailable: false };
  }
}

export default async function SupportConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string | string[] }> }) {
  const { session_id: sessionId } = await searchParams;
  const purchase = typeof sessionId === "string" && sessionId
    ? await prisma.foundingSupporterPurchase.findUnique({
        where: { stripeCheckoutSessionId: sessionId },
        select: { id: true, status: true, amountCents: true, refundedAmountCents: true },
      })
    : null;
  const state = describePurchase(purchase ? recordedSupporterStatus(purchase) : undefined);
  const secret = process.env.SUPPORTER_BADGE_SIGNING_SECRET;
  const badgeHref = state.badgeAvailable && purchase && secret
    ? `/api/support/badge/${purchase.id}?token=${encodeURIComponent(createBadgeToken(purchase.id, secret))}`
    : null;

  return (
    <section className="mx-auto flex min-h-[72vh] max-w-3xl items-center px-5 py-24 sm:px-8">
      <div className="w-full rounded-3xl border border-white/10 bg-[#1a1a18] p-7 sm:p-12">
        {state.badgeAvailable
          ? <CheckCircleIcon aria-hidden="true" className="h-10 w-10 text-emerald-300" />
          : <ClockIcon aria-hidden="true" className="h-10 w-10 text-orange-300" />}
        <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-orange-300">Founding Supporters</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tighter text-zinc-50 sm:text-5xl">{state.title}</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">{state.detail}</p>
        {state.badgeAvailable && !badgeHref && (
          <p className="mt-8 text-sm text-zinc-400">To get your digital badge, contact support with your reference.</p>
        )}
        {badgeHref && (
          <a href={badgeHref} className="mt-8 inline-flex min-h-12 items-center rounded-full bg-zinc-100 px-6 text-sm font-semibold text-zinc-950">
            Download your digital badge
          </a>
        )}
        <div className="mt-10 border-t border-white/8 pt-6 text-sm text-zinc-400">
          {purchase && <p>Reference: {purchase.id}</p>}
          <p className="mt-2">Questions? <a href="mailto:support@visionxixlabs.com" className="text-orange-300 underline underline-offset-2">support@visionxixlabs.com</a></p>
          <Link href="/support#join" className="mt-5 inline-block text-zinc-300 underline underline-offset-2 hover:text-white">Return to the Founding Supporters page</Link>
        </div>
      </div>
    </section>
  );
}

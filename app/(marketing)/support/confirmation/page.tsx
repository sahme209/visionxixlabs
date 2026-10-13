import Link from "next/link";
import { CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/db";
import { createBadgeToken } from "@/lib/supporters/core";

export const dynamic = "force-dynamic";

export default async function SupportConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams;
  const purchase = sessionId ? await prisma.foundingSupporterPurchase.findUnique({ where: { stripeCheckoutSessionId: sessionId } }) : null;
  const paid = Boolean(purchase && ["paid", "partially_refunded"].includes(purchase.status));
  const secret = process.env.SUPPORTER_BADGE_SIGNING_SECRET;
  const badgeHref = paid && purchase && secret ? `/api/support/badge/${purchase.id}?token=${encodeURIComponent(createBadgeToken(purchase.id, secret))}` : null;

  return <section className="mx-auto flex min-h-[72vh] max-w-3xl items-center px-5 py-24 sm:px-8"><div className="w-full rounded-3xl border border-white/[0.1] bg-[#1a1a18] p-7 sm:p-12">{paid ? <CheckCircleIcon className="h-10 w-10 text-emerald-300" /> : <ClockIcon className="h-10 w-10 text-orange-300" />}<p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-orange-300">Founding Supporters</p><h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] text-zinc-50 sm:text-5xl">{paid ? "Your support is confirmed." : "Your payment is being confirmed."}</h1><p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">{paid ? "Thank you for helping Vision XIX Labs advance Axiom Agent. Your receipt and supporter details will be sent to the email used at checkout." : "Stripe may still be processing the payment. Refresh this page shortly or check your email for confirmation. A redirect alone never marks a purchase as paid."}</p>{badgeHref && <a href={badgeHref} className="mt-8 inline-flex min-h-12 items-center rounded-full bg-zinc-100 px-6 text-sm font-semibold text-zinc-950">Download your digital badge</a>}<div className="mt-10 border-t border-white/[0.08] pt-6 text-sm text-zinc-500"><p>Reference: {purchase?.id || "Not available"}</p><p className="mt-2">Questions? <a href="mailto:support@visionxixlabs.com" className="text-orange-300">support@visionxixlabs.com</a></p><Link href="/support" className="mt-5 inline-block text-zinc-300 hover:text-white">Return to the Founding Supporters page</Link></div></div></section>;
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckBadgeIcon, LockClosedIcon } from "@heroicons/react/24/outline";

const suggestedAmounts = [25, 100, 500, 2500];

export function SupporterCheckout({ enabled, unavailableReason }: { enabled: boolean; unavailableReason: string | null }) {
  const [amount, setAmount] = useState("100");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [publicName, setPublicName] = useState("");
  const [recognitionConsent, setRecognitionConsent] = useState(false);
  const [updatesOptIn, setUpdatesOptIn] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [amount]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!enabled || pending) return;
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/support/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ amountCents, email, displayName, publicName, recognitionConsent, updatesOptIn, acceptedTerms, website: "" }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Unable to start checkout.");
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start checkout.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-white/[0.1] bg-[#1b1b19] p-5 shadow-2xl shadow-black/30 sm:p-8" aria-describedby="supporter-terms">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-orange-300">One-time purchase</p>
          <h3 className="mt-2 text-2xl font-medium tracking-[-0.035em] text-zinc-50">Choose your level of support.</h3>
        </div>
        <LockClosedIcon className="h-5 w-5 shrink-0 text-zinc-500" aria-label="Stripe-hosted payment" />
      </div>

      <fieldset className="mt-7">
        <legend className="text-sm text-zinc-400">Suggested amount (USD)</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {suggestedAmounts.map((value) => (
            <button key={value} type="button" onClick={() => setAmount(String(value))} aria-pressed={amount === String(value)} className={`min-h-12 rounded-xl border text-sm font-medium transition ${amount === String(value) ? "border-orange-300/60 bg-orange-400/10 text-orange-200" : "border-white/10 text-zinc-300 hover:bg-white/[0.04]"}`}>
              ${value.toLocaleString()}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-sm text-zinc-400">
        Custom amount — $1 minimum
        <span className="mt-2 flex min-h-12 items-center rounded-xl border border-white/10 bg-black/20 px-4 focus-within:border-orange-300/50">
          <span className="text-zinc-500">$</span>
          <input required min="1" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 text-zinc-100 outline-none" aria-label="Custom support amount in US dollars" />
          <span className="text-xs text-zinc-600">USD</span>
        </span>
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-zinc-400">Email for receipt<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-zinc-100 outline-none focus:border-orange-300/50" /></label>
        <label className="text-sm text-zinc-400">Name for your badge <span className="text-zinc-600">(optional)</span><input autoComplete="name" maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-zinc-100 outline-none focus:border-orange-300/50" /></label>
      </div>

      <div className="mt-5 space-y-3 rounded-2xl border border-white/[0.08] bg-black/15 p-4 text-sm text-zinc-400">
        <label className="flex items-start gap-3"><input type="checkbox" checked={updatesOptIn} onChange={(event) => setUpdatesOptIn(event.target.checked)} className="mt-1 accent-orange-400" /><span>Send me occasional Axiom development updates. I can unsubscribe at any time.</span></label>
        <label className="flex items-start gap-3"><input type="checkbox" checked={recognitionConsent} onChange={(event) => setRecognitionConsent(event.target.checked)} className="mt-1 accent-orange-400" /><span>Recognize me publicly as a Founding Supporter. This is optional and requires my consent.</span></label>
        {recognitionConsent && <label className="block pl-6">Public recognition name<input required maxLength={120} value={publicName} onChange={(event) => setPublicName(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-[#141414] px-3 text-zinc-100 outline-none focus:border-orange-300/50" /></label>}
        <label className="flex items-start gap-3"><input required type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 accent-orange-400" /><span>I understand this is a one-time digital supporter purchase from a for-profit company—not a charitable donation, investment, equity purchase, or promise of financial return.</span></label>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}
      {!enabled && <p role="status" className="mt-4 rounded-xl border border-orange-300/20 bg-orange-400/[0.06] p-3 text-sm leading-6 text-orange-100">{unavailableReason || "Checkout is awaiting final approval."}</p>}

      <button disabled={!enabled || pending || amountCents < 100} className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
        {pending ? "Opening secure checkout…" : "Continue to secure checkout"}<ArrowRightIcon className="h-4 w-4" />
      </button>
      <p id="supporter-terms" className="mt-4 text-xs leading-5 text-zinc-600">Payment is completed on Stripe’s hosted checkout. Vision XIX Labs never receives or stores your card number. See our <Link href="/privacy" className="text-zinc-400 underline underline-offset-2">privacy policy</Link> and <Link href="/terms" className="text-zinc-400 underline underline-offset-2">terms</Link>. Refund requests are reviewed at support@visionxixlabs.com; approved refunds return to the original payment method.</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500"><CheckBadgeIcon className="h-4 w-4 text-orange-300" /> Includes a downloadable digital badge after verified payment.</div>
    </form>
  );
}

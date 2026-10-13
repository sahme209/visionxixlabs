"use client";

import { FormEvent, useState } from "react";

export function SponsorInquiryForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/support/sponsorship", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to record your inquiry.");
      setState("sent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record your inquiry.");
      setState("idle");
    }
  }

  if (state === "sent") return <div role="status" className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] p-6"><p className="font-medium text-emerald-200">Your sponsorship inquiry was recorded.</p><p className="mt-2 text-sm leading-6 text-zinc-400">Vision XIX Labs will review the proposed fit and contact you through the business email you provided.</p></div>;

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label="Strategic sponsorship inquiry">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-zinc-400">Name<input name="name" required maxLength={120} autoComplete="name" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-zinc-100 outline-none focus:border-orange-300/50" /></label>
        <label className="text-sm text-zinc-400">Business email<input name="email" required type="email" autoComplete="email" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-zinc-100 outline-none focus:border-orange-300/50" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-zinc-400">Organization <span className="text-zinc-600">(optional)</span><input name="organization" maxLength={160} autoComplete="organization" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-zinc-100 outline-none focus:border-orange-300/50" /></label>
        <label className="text-sm text-zinc-400">Potential commitment<select name="range" required defaultValue="" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#171715] px-4 text-zinc-100 outline-none focus:border-orange-300/50"><option value="" disabled>Select a range</option><option>$5,000–$24,999</option><option>$25,000–$99,999</option><option>$100,000+</option><option>Prefer to discuss</option></select></label>
      </div>
      <label className="text-sm text-zinc-400">What would you like to advance?<textarea name="message" required minLength={20} maxLength={5000} rows={5} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-zinc-100 outline-none focus:border-orange-300/50" /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={state === "sending"} className="min-h-12 rounded-full bg-orange-400 px-6 text-sm font-semibold text-[#241006] transition hover:bg-orange-300 disabled:opacity-50">{state === "sending" ? "Recording inquiry…" : "Start a sponsorship conversation"}</button>
      <p className="text-xs leading-5 text-zinc-600">An inquiry creates no obligation and offers no equity, financial return, charitable deduction, or guaranteed commercial benefit. No payment is collected through this form.</p>
    </form>
  );
}

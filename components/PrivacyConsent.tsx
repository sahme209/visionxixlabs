"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";

type Consent = "accepted" | "essential";
const STORAGE_KEY = "axiom_privacy_consent_v1";

export function PrivacyConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "accepted" || stored === "essential") setConsent(stored);
      else setOpen(true);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  function choose(value: Consent) {
    window.localStorage.setItem(STORAGE_KEY, value);
    document.cookie = `${STORAGE_KEY}=${value}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
    setConsent(value);
    setOpen(false);
  }

  if (!ready) return null;

  return (
    <>
      {consent === "accepted" && <Analytics />}
      {open && (
        <section role="dialog" aria-modal="false" aria-labelledby="privacy-consent-title" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#111114]/95 p-5 text-white shadow-2xl backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p id="privacy-consent-title" className="text-base font-semibold tracking-tight">Your privacy choices</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Essential cookies keep account and desktop-pairing flows working. With your permission, privacy-conscious site measurement helps us improve downloads and documentation. We do not use advertising cookies.</p>
              <p className="mt-2 text-xs text-zinc-500"><Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-300">Privacy policy</Link> · You can change this choice at any time.</p>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 min-[420px]:flex-row">
              <button type="button" onClick={() => choose("essential")} className="min-h-11 rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.06]">Essential only</button>
              <button type="button" onClick={() => choose("accepted")} className="min-h-11 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-100">Accept optional</button>
            </div>
          </div>
        </section>
      )}
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="fixed bottom-3 left-3 z-[90] rounded-full border border-white/[0.08] bg-[#111114]/90 px-3 py-2 text-[11px] text-zinc-500 shadow-lg backdrop-blur hover:text-zinc-200 sm:bottom-5 sm:left-5">
          Privacy choices
        </button>
      )}
    </>
  );
}

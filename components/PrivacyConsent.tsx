"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { filterPrivacyEvent, persistPrivacyChoice, PRIVACY_CONSENT_KEY, readPrivacyChoice, type PrivacyChoice } from "@/lib/privacy/browserConsent";

export function PrivacyConsent() {
  const [consent, setConsent] = useState<PrivacyChoice | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const currentChoice = useRef<PrivacyChoice | null>(null);
  function beforeSend(event: BeforeSendEvent) {
    const choice = currentChoice.current;
    // Cookie-only withdrawal does not emit a storage event in another tab.
    return filterPrivacyEvent(choice === "accepted" && readPrivacyChoice() === "essential" ? "essential" : choice, event);
  }

  useEffect(() => {
    let cancelled = false;
    function synchronize() {
      if (cancelled) return;
      const stored = readPrivacyChoice();
      currentChoice.current = stored;
      setConsent(stored);
      setOpen(stored === null);
      setSaveFailed(false);
      setReady(true);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === PRIVACY_CONSENT_KEY || event.key === null) synchronize();
    }
    queueMicrotask(synchronize);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      currentChoice.current = null;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function choose(value: PrivacyChoice) {
    // Apply withdrawal synchronously, before persistence or React re-rendering.
    currentChoice.current = value;
    setConsent(value);
    const saved = persistPrivacyChoice(value);
    setSaveFailed(!saved);
    setOpen(!saved);
  }

  if (!ready) return null;

  return (
    <>
      {consent === "accepted" && <Analytics beforeSend={beforeSend} />}
      {open && (
        <section role="dialog" aria-modal="false" aria-labelledby="privacy-consent-title" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#111114]/95 p-5 text-white shadow-2xl backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p id="privacy-consent-title" className="text-base font-semibold tracking-tight">Your privacy choices</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Essential cookies keep account and desktop-pairing flows working. With your permission, privacy-conscious site measurement helps us improve downloads and documentation. We do not use advertising cookies.</p>
              {saveFailed && <p role="status" className="mt-2 text-sm text-orange-200">Your browser could not save this preference. Essential features remain available in this tab.</p>}
              <p className="mt-2 text-xs text-zinc-500"><Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-300">Privacy policy</Link> · You can change this choice at any time.</p>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 min-[420px]:flex-row">
              <button type="button" onClick={() => choose("essential")} className="min-h-11 rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.06]">Essential only</button>
              <button type="button" onClick={() => choose("accepted")} className="min-h-11 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-100">Accept optional</button>
              {saveFailed && <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-3 text-sm text-zinc-300 underline underline-offset-4 hover:text-white">Continue in this tab</button>}
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

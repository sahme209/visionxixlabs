"use client";

import { useEffect } from "react";

const NATIVE_RETURN = "axiom-agent://billing/complete";

export default function DesktopBillingReturnPage() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.assign(NATIVE_RETURN), 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101014] p-8 text-center shadow-2xl">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-violet-300">Axiom Agent billing</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Return to the application</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Your billing portal session is complete. Axiom Agent will refresh entitlement from the service; this browser return does not grant access by itself.</p>
        <a href={NATIVE_RETURN} className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-100">
          Open Axiom Agent
        </a>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

export function AccountBillingPanel({
  planLabel,
  status,
  billingEnabled,
  canManage,
  hasStripeCustomer,
}: {
  planLabel: string;
  status: string;
  billingEnabled: boolean;
  canManage: boolean;
  hasStripeCustomer: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal-session", { method: "POST" });
      const payload = await response.json() as {
        data?: { ok?: boolean; url?: string; reason?: string };
        error?: { userMessage?: string };
      };
      if (payload.data?.ok && payload.data.url) {
        window.location.assign(payload.data.url);
        return;
      }
      setError(payload.data?.reason || payload.error?.userMessage || "Billing management could not be opened.");
    } catch {
      setError("Billing management could not be reached. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7">
      <p className="text-[10px] uppercase tracking-[0.18em] text-orange-300">Workspace plan</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-medium tracking-[-0.03em] text-zinc-100">{planLabel}</h2>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-zinc-400">{status.replaceAll("_", " ")}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-500">
        {billingEnabled ? "Plan state comes from the signed organization subscription lifecycle. Checkout redirects never grant access by themselves." : "Self-service billing is still in review. The signed organization plan remains authoritative, and no charge can be started while billing is disabled."}
      </p>
      <div className="mt-6 border-t border-white/[0.07] pt-5">
        {billingEnabled && canManage && hasStripeCustomer ? (
          <button type="button" disabled={busy} onClick={() => void openPortal()} className="inline-flex min-h-10 items-center justify-center rounded-full bg-zinc-100 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-60">
            {busy ? "Opening secure portal…" : "Manage billing"}
          </button>
        ) : canManage ? (
          <Link href="/plans" className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/[0.1] px-4 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.05]">Review plans</Link>
        ) : (
          <p className="text-xs leading-5 text-zinc-500">A workspace owner or admin manages billing.</p>
        )}
        {error ? <p role="alert" className="mt-3 text-xs leading-5 text-red-300">{error}</p> : null}
      </div>
    </aside>
  );
}

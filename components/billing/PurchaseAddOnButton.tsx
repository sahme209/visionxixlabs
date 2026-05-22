"use client";

/**
 * Initiate add-on purchase — Phase 386 client component.
 *
 * POSTs to /api/billing/add-ons/purchase and redirects to the
 * checkoutUrl returned by the server. Stub Stripe path today;
 * real Checkout when the price IDs land.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BoltIcon, ArrowPathIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Props {
  sku: string;
  label?: string;
}

type State =
  | { kind: "idle" }
  | { kind: "initiating" }
  | { kind: "error"; message: string };

export function PurchaseAddOnButton({ sku, label = "Buy" }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function buy() {
    if (state.kind === "initiating") return;
    setState({ kind: "initiating" });
    try {
      const res = await fetch("/api/billing/add-ons/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sku }),
      });
      const json = await res.json() as { ok?: boolean; checkoutUrl?: string; reason?: string; detail?: string };
      if (!res.ok || !json.ok || !json.checkoutUrl) {
        setState({ kind: "error", message: json.detail ?? json.reason ?? `HTTP ${res.status}` });
        return;
      }
      router.push(json.checkoutUrl);
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={buy}
        disabled={state.kind === "initiating"}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-100 border border-violet-500/40 hover:bg-violet-500/30 transition disabled:opacity-50"
      >
        {state.kind === "initiating" ? (
          <>
            <ArrowPathIcon className="h-3 w-3 animate-spin" />
            Starting…
          </>
        ) : (
          <>
            <BoltIcon className="h-3 w-3" />
            {label}
          </>
        )}
      </button>
      {state.kind === "error" && (
        <span className="text-[10.5px] text-rose-300 inline-flex items-center gap-1">
          <ExclamationTriangleIcon className="h-3 w-3" />
          {state.message}
        </span>
      )}
    </div>
  );
}

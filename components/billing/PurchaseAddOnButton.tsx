"use client";

/**
 * Initiate add-on purchase — Phase 386 client component.
 *
 * POSTs to /api/billing/add-ons/purchase and redirects to the
 * url returned by the server. A non-secret per-SKU intent key survives reloads;
 * uncertain outcomes never silently create a new purchase.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BoltIcon, ArrowPathIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Props {
  sku: string;
  organizationId: string;
  label?: string;
}

type State =
  | { kind: "idle" }
  | { kind: "initiating" }
  | { kind: "error"; message: string; finalized?: boolean };

export function PurchaseAddOnButton({ sku, organizationId, label = "Buy" }: Props) {
  const router = useRouter();
  const scope = `${organizationId}:${sku}`;
  const latestScope = useRef(scope);
  latestScope.current = scope;
  const [storedState, setStoredState] = useState<{ scope: string; value: State }>({ scope, value: { kind: "idle" } });
  const state: State = storedState.scope === scope ? storedState.value : { kind: "idle" };
  function setState(value: State) { setStoredState({ scope, value }); }

  async function buy() {
    if (state.kind === "initiating") return;
    setState({ kind: "initiating" });
    try {
      const storageKey = `axiom:credit-checkout:${organizationId}:${sku}`;
      let intentKey = sessionStorage.getItem(storageKey);
      if (!intentKey) {
        intentKey = `credit_${crypto.randomUUID()}`;
        sessionStorage.setItem(storageKey, intentKey);
        if (sessionStorage.getItem(storageKey) !== intentKey) throw new Error("intent_storage_unavailable");
      }
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(intentKey)) throw new Error("intent_storage_unavailable");
      const res = await fetch("/api/billing/add-ons/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": intentKey },
        credentials: "include",
        body: JSON.stringify({ sku, organizationId }),
      });
      const json = await res.json() as { ok?: boolean; url?: string; error?: string; message?: string; purchaseStatus?: string };
      if (latestScope.current !== scope) return;
      if (!res.ok || !json.ok || !json.url) {
        const finalized = json.error === "purchase_already_finalized" && ["paid", "failed", "expired", "refunded", "partially_refunded"].includes(json.purchaseStatus ?? "");
        setState({ kind: "error", finalized, message: finalized
          ? "This purchase is already finalized. You can explicitly start a separate purchase."
          : json.error === "checkout_reconciliation_required"
            ? "This purchase needs reconciliation. Contact support before starting another purchase."
            : json.message ?? "Checkout could not be confirmed. Keep this purchase reference and contact support before starting another purchase." });
        return;
      }
      router.push(json.url);
    } catch {
      if (latestScope.current !== scope) return;
      setState({ kind: "error", message: "Checkout could not be confirmed. Keep this purchase reference and contact support before starting another purchase." });
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={buy}
        disabled={state.kind === "initiating"}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-100 border border-orange-500/40 hover:bg-orange-500/30 transition disabled:opacity-50"
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
      {state.kind === "error" && state.finalized && (
        <button onClick={() => {
          try {
            sessionStorage.removeItem(`axiom:credit-checkout:${organizationId}:${sku}`);
            setState({ kind: "idle" });
          } catch {
            setState({ kind: "error", message: "Purchase reference storage is unavailable. Contact support." });
          }
        }} className="text-xs underline">Start a new purchase</button>
      )}
      {state.kind === "error" && (
        <span role="alert" className="text-[10.5px] text-rose-300 inline-flex items-center gap-1">
          <ExclamationTriangleIcon className="h-3 w-3" />
          {state.message}
        </span>
      )}
    </div>
  );
}

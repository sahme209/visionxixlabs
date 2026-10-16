"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@heroicons/react/24/outline";
import { PUBLIC_PLAN_CATALOG, isPaidPublicPlanId, type BillingInterval, type PaidPublicPlanId } from "@/lib/billing/publicPlanCatalog";

import { publicPlanSignInPath, type PublicPlanSelection } from "@/lib/billing/planSelection";

export type PublicCheckoutWorkspace =
  | { status: "signed_out" }
  | { status: "unavailable" }
  | { status: "ready"; organizationId: string; label: string };

export function PublicPlansCatalog({ checkoutEnabled, initialSelection = null, workspace = { status: "unavailable" } }: {
  checkoutEnabled: boolean;
  initialSelection?: PublicPlanSelection | null;
  workspace?: PublicCheckoutWorkspace;
}) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>(initialSelection?.billingInterval ?? "monthly");
  const [busyPlan, setBusyPlan] = useState<PaidPublicPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const pending = useRef(false);
  const scope = `${checkoutEnabled}:${workspace.status}:${workspace.status === "ready" ? workspace.organizationId : ""}`;
  const latestScope = useRef(scope);
  latestScope.current = scope;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setInterval(initialSelection?.billingInterval ?? "monthly"); }, [initialSelection?.billingInterval]);

  async function startCheckout(planId: PaidPublicPlanId) {
    if (!checkoutEnabled || pending.current) return;
    const selection = { planId, billingInterval: interval };
    if (workspace.status === "signed_out") { router.push(publicPlanSignInPath(selection)); return; }
    if (workspace.status !== "ready") { setError("Your workspace could not be verified. Refresh this page before choosing a plan."); return; }
    pending.current = true;
    const requestScope = scope;
    const isCurrent = () => mounted.current && latestScope.current === requestScope;
    setBusyPlan(planId);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ planId, billingInterval: interval, expectedOrganizationId: workspace.organizationId }),
      });
      if (!isCurrent()) return;
      if (response.status === 401) {
        router.push(publicPlanSignInPath(selection));
        return;
      }
      const payload = await response.json() as {
        data?: { ok?: boolean; url?: string; reason?: string };
        error?: { userMessage?: string };
      };
      if (!isCurrent()) return;
      if (payload.data?.ok && payload.data.url) {
        window.location.assign(payload.data.url);
        return;
      }
      setError(payload.data?.reason || payload.error?.userMessage || "Checkout could not be started.");
    } catch {
      if (!isCurrent()) return;
      setError("Checkout could not be reached. Try again without refreshing your plan selection.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusyPlan(null);
    }
  }

  return (
    <section className="mx-auto max-w-[1400px] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="inline-flex rounded-full border border-white/[0.1] bg-[#1a1a1a] p-1" aria-label="Billing interval">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              disabled={busyPlan !== null}
              onClick={() => setInterval(value)}
              className={`min-h-10 rounded-full px-5 text-sm transition ${interval === value ? "bg-zinc-100 text-zinc-950" : "text-zinc-500 hover:text-zinc-200"}`}
            >
              {value === "monthly" ? "Monthly" : "Annual · save 20%"}
            </button>
          ))}
        </div>
        {initialSelection && <p className="max-w-xl text-center text-xs text-zinc-400">Restored {initialSelection.planId === "pro" ? "Pro" : "Enterprise"} selection. Review the interval and workspace, then choose a plan explicitly. No checkout has started.</p>}
        {checkoutEnabled && workspace.status === "ready" && <p className="max-w-xl text-center text-sm text-zinc-400">Billing workspace: {workspace.label}. A workspace owner or admin must confirm the purchase.</p>}
        {checkoutEnabled && workspace.status === "unavailable" && <p role="status" className="max-w-xl text-center text-sm text-amber-300">Workspace verification unavailable. Refresh before purchasing.</p>}
        {error ? <p role="alert" className="max-w-xl text-center text-sm text-red-300">{error}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PUBLIC_PLAN_CATALOG.map((plan) => {
          const featured = plan.id === "pro";
          const paidPlanId = isPaidPublicPlanId(plan.id) ? plan.id : null;
          const price = interval === "annual" ? plan.annualPricePerUserCents : plan.monthlyPricePerUserCents;
          return (
            <article
              key={plan.id}
              className={`flex min-h-[520px] flex-col rounded-3xl border p-7 sm:p-8 ${featured ? "border-[#f54e00]/40 bg-[#1a1a1a] shadow-[0_24px_80px_-42px_rgba(245,78,0,0.55)]" : "border-white/[0.09] bg-[#181818]"}`}
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-medium tracking-[-0.03em] text-zinc-100">{plan.name}</h2>
                {featured ? <span className="rounded-full bg-[#f54e00] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Recommended</span> : null}
              </div>
              <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-400">{plan.description}</p>
              <div className="mt-8 border-y border-white/[0.08] py-6">
                <span className="text-4xl font-medium tracking-[-0.05em] text-zinc-100">{price === 0 ? "$0" : `$${(price / 100).toFixed(2).replace(".00", "")}`}</span>
                {price > 0 ? <span className="ml-2 text-sm text-zinc-500">per user / month</span> : null}
                <p className="mt-2 min-h-4 text-xs text-zinc-500">{price > 0 && interval === "annual" ? "Billed annually" : price > 0 ? "Billed monthly" : "No card required"}</p>
              </div>
              <ul className="mt-7 space-y-4">
                {plan.highlights.map((highlight) => <li key={highlight} className="flex gap-3 text-sm leading-6 text-zinc-300"><CheckIcon className="mt-1 h-4 w-4 shrink-0 text-[#ff783d]" aria-hidden /><span>{highlight}</span></li>)}
              </ul>
              <div className="mt-auto pt-9">
                {!paidPlanId || !checkoutEnabled ? (
                  <Link href="/download" className={`flex min-h-12 items-center justify-center rounded-full px-5 text-center text-sm font-semibold transition ${featured ? "bg-[#f54e00] text-white hover:bg-[#ff641f]" : "border border-white/[0.14] bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"}`}>
                    {plan.id === "free" ? "Start free" : "Try Axiom before billing opens"}
                  </Link>
                ) : (
                  <button type="button" disabled={busyPlan !== null || workspace.status === "unavailable"} onClick={() => void startCheckout(paidPlanId)} className={`flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${featured ? "bg-[#f54e00] text-white hover:bg-[#ff641f]" : "border border-white/[0.14] bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"}`}>
                    {busyPlan === plan.id ? "Opening secure checkout…" : `Choose ${plan.name}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

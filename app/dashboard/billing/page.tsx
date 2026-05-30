"use client";

/**
 * /dashboard/billing — tenant billing + plan management.
 *
 * Shows current plan + caps, available tiers with upgrade buttons,
 * and an honest Stripe-status panel. When Stripe isn't fully
 * configured, the upgrade buttons surface the exact env var that's
 * still missing — operators see why instead of getting a vague 500.
 */

import { useEffect, useState } from "react";
import {
  CreditCardIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface TierCap {
  autonomyCyclesPerDay: number;
  stagedRunbooks: number;
  outboundPerDay: number;
  cloudConnectors: number;
}
interface TierSpec {
  tier: string;
  label: string;
  description: string;
  caps: TierCap;
  requiresStripe: boolean;
}
interface PlanRecord {
  organizationId: string;
  tier: string;
  status: string;
  trialDaysRemaining: number;
  trialEndsAt?: string;
  currentPeriodEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  spec: TierSpec;
}
interface StripeStatus {
  configured: boolean;
  webhookConfigured: boolean;
  pricedTiers: Record<string, string>;
  hint: string;
}

const PRICEABLE: Array<{ tier: "starter" | "growth" | "enterprise"; spec: TierSpec }> = [
  {
    tier: "starter",
    spec: {
      tier: "starter",
      label: "Starter",
      description: "One cloud · daily autonomy ticks · Slack-only outbound.",
      caps: { autonomyCyclesPerDay: 96, stagedRunbooks: 50, outboundPerDay: 1000, cloudConnectors: 1 },
      requiresStripe: true,
    },
  },
  {
    tier: "growth",
    spec: {
      tier: "growth",
      label: "Growth",
      description: "Three clouds · 15-min ticks · multi-channel · policy + terraform.",
      caps: { autonomyCyclesPerDay: 480, stagedRunbooks: 250, outboundPerDay: 5000, cloudConnectors: 5 },
      requiresStripe: true,
    },
  },
  {
    tier: "enterprise",
    spec: {
      tier: "enterprise",
      label: "Enterprise",
      description: "Unlimited cycles + connectors + outbound. Cross-tenant admin.",
      caps: { autonomyCyclesPerDay: -1, stagedRunbooks: -1, outboundPerDay: -1, cloudConnectors: -1 },
      requiresStripe: true,
    },
  },
];

function formatCap(n: number): string {
  return n < 0 ? "unlimited" : n.toLocaleString();
}

export default function BillingPage() {
  const [plan, setPlan] = useState<PlanRecord | null>(null);
  const [stripe, setStripe] = useState<StripeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/plan", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: { plan: PlanRecord; stripe: StripeStatus }; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) {
          setPlan(j.data.plan);
          setStripe(j.data.stripe);
        } else {
          setError(j.error?.userMessage ?? "Billing unavailable.");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."));
  }, []);

  async function upgrade(tier: "starter" | "growth" | "enterprise") {
    setBusy(tier);
    setError(null);
    try {
      const r = await fetch("/api/billing/checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const j = (await r.json()) as { ok?: boolean; data?: { ok: boolean; url?: string; reason?: string } };
      const result = j.data;
      if (result?.ok && result.url) {
        window.location.href = result.url;
        return;
      }
      setError(result?.reason ?? "Checkout failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <PageIntro
        kicker="Workspace · billing"
        title={<>Plans &amp; <span className="text-zinc-500">billing.</span></>}
        description="Pick a plan that matches your cloud footprint. Cancel anytime, VAT handled at checkout, invoices on every charge."
        helps="See your current usage against the plan you're on, upgrade or downgrade in a click, and download invoices for accounting."
        connectFirst={<>Already covered — your workspace is linked to a Stripe customer automatically.</>}
        requiresApproval="Workspace owner. Plan changes apply immediately; the next invoice is pro-rated."
        actions={[
          { label: "Compare plans", href: "/plans" },
          { label: "Talk to sales", href: "/contact" },
        ]}
        safetyNote="No fake unlimited claims · Concrete monthly + annual numbers · Honest overage rates on /plans"
      />

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-amber-100">
          {error}
        </div>
      )}

      {plan && plan.status !== "no_plan" && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 mb-6">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border bg-violet-500/15 text-white border-white/[0.12]">
              current plan
            </span>
            <p className="text-[15px] font-semibold text-white">{plan.spec.label}</p>
            <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              plan.status === "active" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30"
            }`}>{plan.status}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            <Cap label="Autonomy/day" value={formatCap(plan.spec.caps.autonomyCyclesPerDay)} />
            <Cap label="Staged runbooks" value={formatCap(plan.spec.caps.stagedRunbooks)} />
            <Cap label="Outbound/day" value={formatCap(plan.spec.caps.outboundPerDay)} />
            <Cap label="Cloud connectors" value={formatCap(plan.spec.caps.cloudConnectors)} />
          </div>
        </div>
      )}

      {plan && plan.status === "no_plan" && (
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.03] p-6 mb-6">
          <p className="text-[10px] font-mono uppercase tracking-wider text-violet-300 mb-2">
            no plan selected
          </p>
          <p className="text-[15px] font-semibold text-white mb-1">
            Pick a plan to activate your workspace.
          </p>
          <p className="text-[13px] text-zinc-400 leading-relaxed">
            Choose Starter, Growth, or Enterprise below. Stripe handles checkout, VAT, and invoicing. You can change tier anytime.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {PRICEABLE.map((p) => {
          const stripeReady = stripe?.configured && stripe.webhookConfigured && p.tier in (stripe?.pricedTiers ?? {});
          const isCurrent = plan?.tier === p.tier;
          return (
            <div key={p.tier} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col">
              <p className="text-[14px] font-semibold text-white">{p.spec.label}</p>
              <p className="text-[11px] text-zinc-400 leading-snug mt-1 flex-1">{p.spec.description}</p>
              <div className="grid grid-cols-2 gap-1.5 mt-3 text-[10px] font-mono">
                <Cap small label="Autonomy/day" value={formatCap(p.spec.caps.autonomyCyclesPerDay)} />
                <Cap small label="Runbooks" value={formatCap(p.spec.caps.stagedRunbooks)} />
                <Cap small label="Outbound/day" value={formatCap(p.spec.caps.outboundPerDay)} />
                <Cap small label="Clouds" value={formatCap(p.spec.caps.cloudConnectors)} />
              </div>
              <button
                onClick={() => upgrade(p.tier)}
                disabled={busy === p.tier || isCurrent || !stripeReady}
                className={`mt-3 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border ${
                  isCurrent
                    ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30 cursor-default"
                    : stripeReady
                      ? "bg-violet-500/15 text-white border-white/[0.12] hover:bg-violet-500/20"
                      : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20 cursor-not-allowed"
                } disabled:opacity-70`}
              >
                {isCurrent ? (
                  <>
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    current plan
                  </>
                ) : !stripeReady ? "Stripe not configured" : (
                  <>
                    {busy === p.tier ? "Loading…" : "Upgrade"}
                    {busy !== p.tier && <ArrowRightIcon className="h-3 w-3" />}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Client-facing trust strip. The Stripe configuration debug panel
          previously shown here (secret_key / webhook_secret status) is
          operator-only and was moved to /admin/billing-ops. */}
      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
        <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-emerald-100 leading-snug">
            Secure checkout via Stripe
          </p>
          <p className="text-[11.5px] text-emerald-100/80 mt-1">
            Cancel anytime · no setup fee · VAT handled at checkout · invoices emailed on every charge.
          </p>
        </div>
      </div>
    </div>
  );
}

function Cap({ label, value, small }: { label: string; value: string; small?: boolean }) {
  const padding = small ? "px-1.5 py-1" : "p-3";
  const valueCls = small ? "text-[12px] font-bold" : "text-[18px] font-bold";
  return (
    <div className={`rounded-lg border border-white/[0.06] bg-black/20 ${padding}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`${valueCls} text-zinc-100 mt-0.5`}>{value}</p>
    </div>
  );
}

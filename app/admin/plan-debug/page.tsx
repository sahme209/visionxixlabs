"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";

type PlanDebugData = {
  plan: string | null;
  entitlements: {
    axiomScan: boolean;
    axiomExecution: boolean;
    cloudConnectors: boolean;
    operatorTier: string;
  };
  lastStripeWebhookEventId: string | null;
  lastStripeWebhookAt: string | null;
  stripePriceIdsConfigured: {
    STRIPE_PRICES_STARTER: boolean;
    STRIPE_PRICES_GROWTH: boolean;
    STRIPE_PRICES_SCALE: boolean;
    STRIPE_PRICES_ENTERPRISE: boolean;
  };
};

export default function AdminPlanDebugPage() {
  const [data, setData] = useState<PlanDebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/plan-debug")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="glass-card rounded-lg p-4 text-red-400 border-red-500/20">
        {error ?? "Failed to load plan debug"}
      </div>
    );
  }

  const missingEnterprise = !data.stripePriceIdsConfigured.STRIPE_PRICES_ENTERPRISE;

  return (
    <div className="space-y-6">
      <Reveal direction="up" blur delay={0.05}>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/leads"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-violet-400 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Admin
          </Link>
        </div>
      </Reveal>

      <Reveal direction="up" blur delay={0.1}>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-6 w-6 text-violet-400" />
          <h1 className="text-xl font-bold text-white tracking-[-0.04em]">
            Plan & Stripe <span className="text-gradient">Lifecycle Debug</span>
          </h1>
        </div>
      </Reveal>

      <Reveal direction="up" blur delay={0.15}>
        <div className="glass-card animated-border card-inner-glow rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 tracking-[-0.04em]">
            Current user
          </h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Plan</dt>
              <dd className="font-mono font-medium text-violet-400">
                {data.plan ?? "—"}
              </dd>
            </div>
          </dl>

          <div className="section-divider" />

          <h2 className="text-sm font-semibold text-zinc-300 pt-2 tracking-[-0.04em]">
            Derived entitlements
          </h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Operator tier</dt>
              <dd className="font-medium text-zinc-200">
                {data.entitlements.operatorTier}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Axiom scan</dt>
              <dd className={data.entitlements.axiomScan ? "text-emerald-400" : "text-zinc-500"}>{data.entitlements.axiomScan ? "Active" : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Axiom execution</dt>
              <dd className={data.entitlements.axiomExecution ? "text-emerald-400" : "text-zinc-500"}>{data.entitlements.axiomExecution ? "Active" : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Cloud connectors</dt>
              <dd className={data.entitlements.cloudConnectors ? "text-emerald-400" : "text-zinc-500"}>{data.entitlements.cloudConnectors ? "Active" : "—"}</dd>
            </div>
          </dl>

          <div className="section-divider" />

          <h2 className="text-sm font-semibold text-zinc-300 pt-2 tracking-[-0.04em]">
            Stripe webhook
          </h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Last event ID</dt>
              <dd className="font-mono text-zinc-200 break-all">
                {data.lastStripeWebhookEventId ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Last processed at</dt>
              <dd className="text-zinc-200">
                {data.lastStripeWebhookAt ?? "—"}
              </dd>
            </div>
          </dl>

          <div className="section-divider" />

          <h2 className="text-sm font-semibold text-zinc-300 pt-2 tracking-[-0.04em]">
            Stripe price ID env vars
          </h2>
          <dl className="grid gap-2 text-sm">
            {Object.entries(data.stripePriceIdsConfigured).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-zinc-500 font-mono text-xs">{k}</dt>
                <dd className={v ? "text-emerald-400" : "text-zinc-500"}>{v ? "Active" : "—"}</dd>
              </div>
            ))}
          </dl>
          {missingEnterprise && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-400">
              Enterprise price IDs not configured. Add STRIPE_PRICES_ENTERPRISE for enterprise plan
              mapping.
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}

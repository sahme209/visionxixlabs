"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

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
      <div className="text-zinc-400">Loading plan debug...</div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 border-red-500/20 bg-red-50 bg-red-500/10 p-4 text-red-800 text-red-400">
        {error ?? "Failed to load plan debug"}
      </div>
    );
  }

  const missingEnterprise = !data.stripePriceIdsConfigured.STRIPE_PRICES_ENTERPRISE;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/leads"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-indigo-600"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Admin
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
        <h1 className="text-xl font-bold text-white">
          Plan & Stripe Lifecycle Debug
        </h1>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">
          Current user
        </h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Plan</dt>
            <dd className="font-mono font-medium text-zinc-200">
              {data.plan ?? "—"}
            </dd>
          </div>
        </dl>

        <h2 className="text-sm font-semibold text-zinc-300 pt-2">
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
            <dd>{data.entitlements.axiomScan ? "✓" : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Axiom execution</dt>
            <dd>{data.entitlements.axiomExecution ? "✓" : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Cloud connectors</dt>
            <dd>{data.entitlements.cloudConnectors ? "✓" : "—"}</dd>
          </div>
        </dl>

        <h2 className="text-sm font-semibold text-zinc-300 pt-2">
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

        <h2 className="text-sm font-semibold text-zinc-300 pt-2">
          Stripe price ID env vars
        </h2>
        <dl className="grid gap-2 text-sm">
          {Object.entries(data.stripePriceIdsConfigured).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-zinc-500">{k}</dt>
              <dd>{v ? "✓" : "—"}</dd>
            </div>
          ))}
        </dl>
        {missingEnterprise && (
          <div className="rounded-lg border border-amber-200 border-amber-500/20 bg-amber-50 bg-amber-500/10 p-3 text-sm text-amber-800 text-amber-400">
            Enterprise price IDs not configured. Add STRIPE_PRICES_ENTERPRISE for enterprise plan
            mapping.
          </div>
        )}
      </div>
    </div>
  );
}

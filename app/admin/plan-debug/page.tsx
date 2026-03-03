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
      <div className="text-slate-600 dark:text-slate-400">Loading plan debug...</div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-200">
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
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Admin
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Plan & Stripe Lifecycle Debug
        </h1>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Current user
        </h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Plan</dt>
            <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">
              {data.plan ?? "—"}
            </dd>
          </div>
        </dl>

        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 pt-2">
          Derived entitlements
        </h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Operator tier</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {data.entitlements.operatorTier}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Axiom scan</dt>
            <dd>{data.entitlements.axiomScan ? "✓" : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Axiom execution</dt>
            <dd>{data.entitlements.axiomExecution ? "✓" : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Cloud connectors</dt>
            <dd>{data.entitlements.cloudConnectors ? "✓" : "—"}</dd>
          </div>
        </dl>

        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 pt-2">
          Stripe webhook
        </h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Last event ID</dt>
            <dd className="font-mono text-slate-800 dark:text-slate-200 break-all">
              {data.lastStripeWebhookEventId ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Last processed at</dt>
            <dd className="text-slate-800 dark:text-slate-200">
              {data.lastStripeWebhookAt ?? "—"}
            </dd>
          </div>
        </dl>

        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 pt-2">
          Stripe price ID env vars
        </h2>
        <dl className="grid gap-2 text-sm">
          {Object.entries(data.stripePriceIdsConfigured).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
              <dd>{v ? "✓" : "—"}</dd>
            </div>
          ))}
        </dl>
        {missingEnterprise && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
            Enterprise price IDs not configured. Add STRIPE_PRICES_ENTERPRISE for enterprise plan
            mapping.
          </div>
        )}
      </div>
    </div>
  );
}

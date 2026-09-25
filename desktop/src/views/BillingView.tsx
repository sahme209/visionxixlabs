/**
 * BillingView — Phase 406-desktop.
 *
 * Shows plan tier + monthly v1 API quota from /api/v1/whoami. Phase 398's
 * nearLimit flag drives a clear amber warning when usage ≥ 90%.
 */

import { useEffect, useState } from "react";
import { desktopClient } from "../lib/desktopClient";
import { Badge, Card, DataSourceBanner, LoadingState, ViewShell } from "../components/Primitives";

interface BillingState {
  organizationId: string;
  planTier: string;
  monthlyLimit: number | null;
  currentCalls: number;
  remaining: number | null;
  ratio: number | null;
  nearLimit: boolean;
}

export function BillingView() {
  const [state, setState] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!desktopClient.hasAuth()) { setLoading(false); return; }
    let cancelled = false;
    desktopClient.v1Whoami().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        const d = res.data as {
          organization: { id: string; planTier: string };
          quota: { monthlyLimit: number | null; currentCalls: number; remaining: number | null; ratio: number | null; nearLimit: boolean };
        };
        setState({
          organizationId: d.organization.id,
          planTier: d.organization.planTier,
          monthlyLimit: d.quota.monthlyLimit,
          currentCalls: d.quota.currentCalls,
          remaining: d.quota.remaining,
          ratio: d.quota.ratio,
          nearLimit: d.quota.nearLimit,
        });
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <ViewShell>
      <DataSourceBanner
        mode={!desktopClient.hasAuth() ? "preview" : state ? "live" : "authenticated_no_data"}
        surfaceName="billing + usage"
        webPath="/dashboard/billing"
      />

      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">business · billing</p>
        <h1 className="text-2xl font-bold tracking-tight">Billing &amp; usage</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          Plan tier, monthly v1 API quota, and quota-status indicator for the authenticated workspace.
        </p>
      </div>

      {loading && <LoadingState label="Loading billing…" />}

      {!loading && error && (
        <Card className="p-4">
          <p className="text-[12px] text-red-300">✗ {error}</p>
        </Card>
      )}

      {!loading && state && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">workspace</p>
              <p className="text-[14px] font-mono text-violet-200">{state.organizationId}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">plan tier</p>
              <p className="text-[14px] font-mono text-zinc-200">{state.planTier}</p>
            </Card>
            <Card className={`p-4 border ${state.nearLimit ? "border-amber-500/30" : "border-emerald-500/20"}`}>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">quota status</p>
              <Badge tone={state.nearLimit ? "warning" : "success"}>
                {state.nearLimit ? `${((state.ratio ?? 0) * 100).toFixed(0)}% — near limit` : state.monthlyLimit === null ? "unlimited" : "healthy"}
              </Badge>
            </Card>
          </div>

          <Card className="p-5">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">monthly v1 API calls</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-2xl font-bold text-white tabular-nums">{state.currentCalls.toLocaleString()}</span>
              <span className="text-sm text-zinc-500">/</span>
              <span className="text-sm font-mono text-zinc-400">
                {state.monthlyLimit !== null ? state.monthlyLimit.toLocaleString() : "unlimited"}
              </span>
            </div>
            {state.monthlyLimit !== null && (
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${state.nearLimit ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (state.ratio ?? 0) * 100)}%` }}
                />
              </div>
            )}
            {state.nearLimit && (
              <p className="text-[11px] text-amber-300 mt-2">
                You&apos;re near the monthly cap. Contact your workspace administrator to review plan limits.
              </p>
            )}
          </Card>
        </>
      )}
    </ViewShell>
  );
}

"use client";

/**
 * useTenantFreshness — small client hook that asks /api/tenant/freshness
 * once on mount and tells the caller whether this tenant is fresh
 * (no connectors, no agent runs). Dashboard pages use the answer to
 * switch between showing live data and showing a calm empty-state CTA.
 *
 * The type comes from a pure types module so this hook never pulls
 * server-only deps (prisma, next/server) into the client bundle.
 */

import { useEffect, useState } from "react";
import type { TenantFreshnessSnapshot } from "@/lib/platform/tenantFreshnessTypes";

export interface TenantFreshnessState {
  loaded: boolean;
  snapshot: TenantFreshnessSnapshot | null;
  /** Convenience: true while loading or when the tenant is fresh. */
  isFreshOrLoading: boolean;
}

export function useTenantFreshness(): TenantFreshnessState {
  const [snapshot, setSnapshot] = useState<TenantFreshnessSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tenant/freshness", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: TenantFreshnessSnapshot }) => {
        if (cancelled) return;
        if (j.ok && j.data) setSnapshot(j.data);
      })
      .catch(() => { /* swallow — render fresh-tenant by default */ })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const isFreshOrLoading = !loaded || !snapshot || snapshot.freshTenant;
  return { loaded, snapshot, isFreshOrLoading };
}

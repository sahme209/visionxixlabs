import { useCallback, useEffect, useState } from "react";
import { parseDesktopUsageSummary, type DesktopUsageSummary } from "../../../lib/desktop/desktopBillingSummary";
import { desktopClient } from "./desktopClient";

const freshnessMs = 5 * 60 * 1000;

export function useDesktopUsage(
  organizationId: string,
  context: typeof desktopClient.config,
  revision: number,
  enabled = true,
) {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{
    context: typeof context;
    revision: number;
    organizationId: string;
    attempt: number;
    data: DesktopUsageSummary | null;
    verifiedAt?: number;
  }>();
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  const ownsContext = enabled && context === desktopClient.config && revision === desktopClient.getContextRevision();
  const current = ownsContext && read && read.context === context && read.revision === revision
    && read.organizationId === organizationId && read.attempt === attempt ? read : undefined;

  useEffect(() => {
    if (!ownsContext) return;
    let alive = true;
    let expiry: number | undefined;
    const timeout = window.setTimeout(() => {
      alive = false;
      setRead({ context, revision, organizationId, attempt, data: null });
    }, 15_000);
    async function load() {
      let data: DesktopUsageSummary | null = null;
      try {
        const result = await desktopClient.usageSummary();
        if (result.ok) data = parseDesktopUsageSummary(result.data);
      } catch {
        // A transport failure leaves the balance unavailable.
      }
      if (!alive || context !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
      window.clearTimeout(timeout);
      setRead({ context, revision, organizationId, attempt, data, verifiedAt: data ? Date.now() : undefined });
      if (data) expiry = window.setTimeout(() => {
        setRead(value => value && value.context === context && value.revision === revision
          && value.organizationId === organizationId && value.attempt === attempt ? { ...value, data: null } : value);
      }, freshnessMs);
    }
    void load();
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.clearTimeout(timeout);
      window.clearTimeout(expiry);
      window.removeEventListener("focus", refresh);
    };
  }, [attempt, context, organizationId, ownsContext, refresh, revision]);

  return {
    usage: current?.data ?? null,
    verifiedAt: current?.data ? current.verifiedAt : undefined,
    loading: ownsContext && !current,
    error: ownsContext && !current ? null : current?.data ? null : "Plan and usage could not be verified. Refresh or review billing in the cockpit.",
    refresh,
  };
}

export type DesktopUsageRead = ReturnType<typeof useDesktopUsage>;

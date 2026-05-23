/**
 * Shared store for connector health — Phase 408.
 *
 * Mirrors approvalsStore.ts: one ambient producer (the new
 * useConnectorHealth hook below) writes the snapshot; any view can
 * subscribe via useConnectorHealthSnapshot() without each running its
 * own poll. Lets TopBar render a "stale connector" pill alongside the
 * pending-approval pill without a second network call.
 */

import { useEffect, useSyncExternalStore } from "react";
import { desktopClient } from "./desktopClient";

export type ConnectorHealthStatus =
  | "healthy" | "degraded" | "stale" | "auth_failed" | "rate_limited";

export interface ConnectorHealthEntry {
  name: string;
  category: "cloud" | "vcs" | "db" | "monitoring" | "ide";
  status: ConnectorHealthStatus;
  stage: "auth" | "rate_limit" | "staleness" | "ratio" | "ok";
  reason: string;
  successRatio: number | null;
  ageMs: number | null;
  recentSuccessCount: number;
  recentErrorCount: number;
}

export interface ConnectorHealthSnapshot {
  hasPolled: boolean;
  generatedAt: string | null;
  summary: {
    healthy: number;
    degraded: number;
    stale: number;
    auth_failed: number;
    rate_limited: number;
  };
  connectors: ReadonlyArray<ConnectorHealthEntry>;
  /** Count of connectors whose status is anything other than healthy. */
  alertCount: number;
}

const EMPTY: ConnectorHealthSnapshot = {
  hasPolled: false,
  generatedAt: null,
  summary: { healthy: 0, degraded: 0, stale: 0, auth_failed: 0, rate_limited: 0 },
  connectors: [],
  alertCount: 0,
};

let snapshot: ConnectorHealthSnapshot = EMPTY;
const listeners = new Set<() => void>();

function publish(next: ConnectorHealthSnapshot) {
  snapshot = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function getSnapshot() { return snapshot; }

export function useConnectorHealthSnapshot(): ConnectorHealthSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Ambient producer — polls /api/v1/connectors/health every 30s
 * (slower than the approvals poll because connector health changes on
 * the minute scale, not the second). Lives at App level so the data
 * is fresh on every view.
 */
const POLL_MS = 30_000;

export function useConnectorHealthAmbientPoll(): void {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      if (!desktopClient.hasAuth()) {
        if (snapshot !== EMPTY) publish(EMPTY);
        schedule();
        return;
      }
      const res = await desktopClient.v1ConnectorsHealth();
      if (cancelled) return;
      if (res.ok) {
        const next: ConnectorHealthSnapshot = {
          hasPolled: true,
          generatedAt: res.data.generatedAt,
          summary: res.data.summary,
          connectors: res.data.connectors,
          alertCount:
            res.data.summary.degraded +
            res.data.summary.stale +
            res.data.summary.auth_failed +
            res.data.summary.rate_limited,
        };
        publish(next);
      }
      schedule();
    };
    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);
}

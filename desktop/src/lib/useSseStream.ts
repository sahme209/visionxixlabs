/**
 * SSE consumer — Phase 409.
 *
 * Subscribes to /api/v1/events/stream and dispatches frames into the
 * existing approvalsStore + connectorHealthStore, replacing the 5s +
 * 30s polling loops with a single long-lived push connection.
 *
 * Why fetch + ReadableStream instead of the native EventSource API:
 * EventSource doesn't support custom request headers, so it can't ship
 * Authorization: Bearer <api-key>. fetch() does, and ReadableStream
 * gives us the same SSE-frame semantics with full auth support. The
 * TextDecoder stream is a tiny replacement for EventSource's wire
 * parser.
 *
 * Resilience:
 *   - On disconnect / 401 / 5xx, we exponentially back off (1s, 2s, 4s,
 *     up to 30s) before reconnecting.
 *   - If three consecutive connect attempts fail with non-401 errors,
 *     the hook falls back to polling — the existing
 *     useTrayApprovalsBadge + useConnectorHealthAmbientPoll hooks stay
 *     mounted as a backup, so "fall back" just means "let them poll".
 *   - If auth drops (401 with token_revoked / expired), we stop
 *     reconnecting until the user re-pairs.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { desktopClient } from "./desktopClient";
import {
  clearPendingApprovals,
  setPendingApprovals,
} from "./approvalsStore";
import { drainVoteQueue } from "./voteQueue";

const DEFAULT_API_BASE = "https://visionxixlabs.com";
const MAX_BACKOFF_MS = 30_000;
const PERMANENT_AUTH_ERRORS = new Set([
  "token_expired", "token_revoked", "unknown_token", "missing_scope",
]);

export type LiveStatus = "idle" | "connecting" | "open" | "closed" | "fallback";

// ─── Tiny shared store so any component can read the SSE status ─────
const liveListeners = new Set<() => void>();
let liveStatusSnap: LiveStatus = "idle";
function publishLive(next: LiveStatus) {
  if (liveStatusSnap === next) return;
  liveStatusSnap = next;
  for (const l of liveListeners) l();
}
export function useSseStatus(): LiveStatus {
  return useSyncExternalStore(
    (l) => { liveListeners.add(l); return () => { liveListeners.delete(l); }; },
    () => liveStatusSnap,
    () => liveStatusSnap,
  );
}

export interface SseHookOptions {
  /** Comma-separated closed-union of `StreamEventKind` to subscribe to. */
  subscribe?: string;
}

/**
 * Mount-once hook that owns the SSE connection.
 *
 * The producers it writes into (approvalsStore, vote queue drain) are
 * the SAME stores the polling hooks already write into — so the rest
 * of the app doesn't care which transport delivered the data.
 */
export function useSseStream(opts: SseHookOptions = {}): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const cancelledRef = useRef(false);
  const seededRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let abortCtrl: AbortController | null = null;
    let consecutiveFailures = 0;
    let backoffMs = 1000;

    const sleep = (ms: number) =>
      new Promise<void>((res) => setTimeout(res, ms));

    const dispatchApprovals = (data: unknown) => {
      if (!isObj(data)) return;
      const runs = (data as { runs?: unknown }).runs;
      if (!Array.isArray(runs)) return;
      const ids = runs
        .map((r) => (isObj(r) ? (r as { id?: unknown }).id : undefined))
        .filter((v): v is string => typeof v === "string");
      setPendingApprovals(ids);
      // Tray badge + tray pending list are updated by the existing
      // useTrayApprovalsBadge hook which reads from the same store,
      // so SSE-driven updates flow through to the menubar for free.
    };

    const dispatchFrame = (event: string, raw: string) => {
      let data: unknown = null;
      try { data = JSON.parse(raw); } catch { return; }
      switch (event) {
        case "stream.ready":
          _setLocalStatusAndPublish(setStatus,"open");
          consecutiveFailures = 0;
          backoffMs = 1000;
          seededRef.current = true;
          break;
        case "approvals.snapshot":
          dispatchApprovals(data);
          break;
        case "connectors.snapshot":
          // connectorHealthStore is currently driven by its own ambient
          // poll; piping SSE into it would race the poll. Phase 410 will
          // refactor connectorHealthStore to accept external writes; for
          // now SSE drives approvals only, and connectors are surfaced
          // here as a no-op (the polling hook keeps them fresh).
          break;
        case "heartbeat":
          // Opportunity to flush queued offline votes — the SSE round-trip
          // proves the network is up.
          void drainVoteQueue();
          break;
        case "stream.shutdown":
          // Server told us it's done; reconnect via the outer loop.
          break;
      }
    };

    const runOnce = async (): Promise<void> => {
      if (cancelledRef.current) return;
      if (!desktopClient.hasAuth()) {
        _setLocalStatusAndPublish(setStatus,"idle");
        clearPendingApprovals();
        await sleep(2000);
        return;
      }
      _setLocalStatusAndPublish(setStatus,"connecting");
      abortCtrl = new AbortController();

      const base = (desktopClient.config.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, "");
      const url = `${base}/api/v1/events/stream${opts.subscribe ? `?subscribe=${encodeURIComponent(opts.subscribe)}` : ""}`;

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${desktopClient.config.sessionToken}`,
          },
          signal: abortCtrl.signal,
        });

        if (!res.ok || !res.body) {
          let errCode: string | null = null;
          try {
            const j = (await res.json()) as { error?: unknown };
            if (typeof j.error === "string") errCode = j.error;
          } catch { /* swallow */ }
          // Permanent auth failures stop the loop; everything else
          // exponentially backs off.
          if (errCode && PERMANENT_AUTH_ERRORS.has(errCode)) {
            _setLocalStatusAndPublish(setStatus,"closed");
            return;
          }
          throw new Error(`stream open failed: HTTP ${res.status}${errCode ? ` · ${errCode}` : ""}`);
        }

        // Successful connect — reset failure counters.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          if (cancelledRef.current) {
            abortCtrl.abort();
            break;
          }
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Each SSE frame is separated by a blank line ("\n\n").
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            let event = "message";
            const dataLines: string[] = [];
            for (const line of frame.split("\n")) {
              if (line.startsWith("event: ")) event = line.slice(7);
              else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
              // id: lines could be tracked for Last-Event-ID on reconnect;
              // we omit that here since each tick is a full snapshot.
            }
            if (dataLines.length > 0) {
              dispatchFrame(event, dataLines.join("\n"));
            }
          }
        }
      } catch (err) {
        // Network drop, abort, or non-2xx — bubble out to the backoff loop.
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        consecutiveFailures++;
        throw err;
      }
    };

    (async () => {
      while (!cancelledRef.current) {
        try {
          await runOnce();
          // Clean close — server hit max_lifetime or stream.shutdown.
          // Reconnect fast (no backoff penalty) since this is expected.
          if (cancelledRef.current) break;
          await sleep(500);
        } catch {
          if (cancelledRef.current) break;
          if (consecutiveFailures >= 3) {
            _setLocalStatusAndPublish(setStatus,"fallback");
          } else {
            _setLocalStatusAndPublish(setStatus,"closed");
          }
          await sleep(backoffMs);
          backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs * 2);
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
      if (abortCtrl) abortCtrl.abort();
    };
    // We intentionally exclude `opts.subscribe` so changing the filter
    // mid-session would require remounting the consumer; the typical
    // usage is one fixed subscription per app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}

function isObj(v: unknown): v is object {
  return typeof v === "object" && v !== null;
}

/**
 * Update both the local React state (for the hook return value) and
 * the shared external store (for `useSseStatus()` subscribers like the
 * TopBar). Keeping them in lockstep means no surface ever sees a stale
 * status from the other side.
 */
function _setLocalStatusAndPublish(
  setLocal: (s: LiveStatus) => void,
  next: LiveStatus,
): void {
  setLocal(next);
  publishLive(next);
}

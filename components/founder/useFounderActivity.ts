"use client";
import { useEffect, useRef, useState } from "react";
import { mergeActivity, type ActivityEvent } from "@/lib/founder/activity";
import type { SignalKey } from "@/lib/founder/blueprint";

export type LiveSignals = Partial<Record<SignalKey, number | null>>;
export interface FounderLive {
  events: ActivityEvent[];
  signals: LiveSignals | null;
  /** Sources that could not be read on the last poll. */
  unavailable: string[];
  /** Time of the last successful read, or null before the first one. */
  readAt: number | null;
  state: "loading" | "live" | "paused" | "error";
  /** Ticks every few seconds so relative times and pulses age. */
  now: number;
}

const POLL_MS = 15_000;

/**
 * Polls the founder activity feed while the page is visible: the first read loads the last 7 days,
 * later reads ask only for events since shortly before the previous read. Paused while the tab is hidden; a failed read keeps what is
 * already shown and says so.
 */
export function useFounderActivity(enabled: boolean): FounderLive {
  const [live, setLive] = useState<FounderLive>({ events: [], signals: null, unavailable: [], readAt: null, state: "loading", now: Date.now() });
  const newest = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function poll() {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") { setLive((l) => ({ ...l, state: "paused" })); timer = setTimeout(poll, POLL_MS); return; }
      try {
        const q = newest.current ? `?since=${encodeURIComponent(newest.current)}` : "";
        const res = await fetch(`/api/founder/activity${q}`, { cache: "no-store" });
        const body = await res.json() as { ok?: boolean; data?: { events: ActivityEvent[]; unavailable: string[]; readAt: string; signals: LiveSignals } };
        if (!res.ok || !body.ok || !body.data) throw new Error();
        const data = body.data;
        // Ask from a minute before this read next time; overlapping events are merged by id.
        newest.current = new Date((Date.parse(data.readAt) || Date.now()) - 60_000).toISOString();
        if (!stopped) setLive((l) => ({ events: mergeActivity(l.events, data.events), signals: data.signals, unavailable: data.unavailable, readAt: Date.parse(data.readAt) || Date.now(), state: "live", now: Date.now() }));
      } catch {
        if (!stopped) setLive((l) => ({ ...l, state: "error", now: Date.now() }));
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }
    void poll();
    const tick = setInterval(() => setLive((l) => ({ ...l, now: Date.now() })), 5_000);
    const onVisible = () => { if (document.visibilityState === "visible") { if (timer) clearTimeout(timer); void poll(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; if (timer) clearTimeout(timer); clearInterval(tick); document.removeEventListener("visibilitychange", onVisible); };
  }, [enabled]);

  return live;
}

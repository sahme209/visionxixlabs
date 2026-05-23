/**
 * Quick-approve / quick-reject from the tray submenu.
 *
 * The Rust tray emits `tray://decide` with { runId, decision } when the
 * user picks Approve or Reject under a pending run. This hook:
 *
 *   1. Validates the payload (closed-union decision).
 *   2. Skips when no API key is paired (silent — the tray UI itself
 *      shouldn't have shown the entry, but be defensive).
 *   3. Calls v1DecideApproval with `approverUserId = "desktop_tray"` so
 *      the audit trail records the actor distinctly from the in-app
 *      vote (`api_key:<keyId>`).
 *   4. Fires a native notification with a human-readable outcome:
 *        - "Vote recorded — 1/2 approved" (terminal=false)
 *        - "Approved — run advanced" (terminal=true, status=approved)
 *        - "Rejected — run halted" (terminal=true, status=rejected)
 *      Errors surface as a "Vote failed" notification with the error code.
 *
 * Lives at App level so quick-approve works regardless of which view is
 * mounted (or whether the window is even visible).
 */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { desktopClient } from "./desktopClient";
import { notifyResult } from "./notifications";
import { recordVote } from "./voteHistory";
import { enqueueVote } from "./voteQueue";

type Decision = "approved" | "rejected";

interface TrayDecidePayload {
  runId: string;
  decision: Decision;
}

function isPayload(v: unknown): v is TrayDecidePayload {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.runId === "string"
    && (o.decision === "approved" || o.decision === "rejected");
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useTrayDecisions(): void {
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const fn = await listen<TrayDecidePayload>("tray://decide", async (event) => {
          if (!isPayload(event.payload)) return;
          const { runId, decision } = event.payload;

          if (!desktopClient.hasAuth()) {
            void notifyResult({
              title: "Tray vote skipped",
              body: "No API key paired — open Settings to add one.",
            });
            return;
          }

          const res = await desktopClient.v1DecideApproval({
            runId,
            decision,
            approverUserId: "desktop_tray",
            reason: "Voted from menubar tray",
          });

          if (!res.ok) {
            // Transport-ish failures (no closed-union v1 error name) are
            // queued for retry on the next ambient tick. A typed v1 error
            // (missing_scope, run_not_found, etc.) is reported as-is and
            // not retried — replaying won't help.
            if (looksLikeTransportError(res.error)) {
              await enqueueVote({
                runId,
                decision,
                approverUserId: "desktop_tray",
                reason: "Voted from menubar tray",
                source: "tray",
              });
              void notifyResult({
                title: `Vote queued · ${decision}`,
                body: `Network looks offline — will retry automatically (${res.error}).`,
              });
            } else {
              void notifyResult({
                title: `${decision === "approved" ? "Approve" : "Reject"} failed`,
                body: res.error,
              });
            }
            return;
          }

          const d = res.data;
          // Local audit log — append before notifying so the Settings
          // panel reflects the new vote immediately on next render.
          void recordVote({
            runId,
            decision,
            castAt: new Date().toISOString(),
            isTerminal: d.isTerminal,
            snapshotStatus: d.snapshotStatus,
            approvedCount: d.approvedCount,
            rejectedCount: d.rejectedCount,
            requiredApprovers: d.requiredApprovers,
            source: "tray",
          });
          if (d.isTerminal && d.snapshotStatus === "approved") {
            void notifyResult({
              title: "Gate approved",
              body: `Run ${shortId(runId)} advanced (${d.approvedCount}/${d.requiredApprovers}).`,
            });
          } else if (d.isTerminal && d.snapshotStatus === "rejected") {
            void notifyResult({
              title: "Gate rejected",
              body: `Run ${shortId(runId)} halted.`,
            });
          } else {
            void notifyResult({
              title: decision === "approved" ? "Vote recorded — approve" : "Vote recorded — reject",
              body: `${d.approvedCount}/${d.requiredApprovers} approved · awaiting next reviewer.`,
            });
          }
        });
        if (cancelled) fn(); else unlisten = fn;
      } catch {
        /* event API unavailable — no-op */
      }
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);
}

function shortId(s: string): string {
  return s.length <= 10 ? s : `${s.slice(0, 10)}…`;
}

/**
 * Distinguish a transport blip (DNS, ETIMEDOUT, ECONNREFUSED, "Failed to
 * fetch") from a structured v1 error (closed-union snake_case string).
 * The desktopClient surfaces network errors as the raw thrown message,
 * which is never a v1 snake_case code, so a `_`-less / multi-word string
 * is our heuristic.
 */
function looksLikeTransportError(err: string): boolean {
  const lower = err.toLowerCase();
  return lower.includes("fetch")
      || lower.includes("network")
      || lower.includes("timeout")
      || lower.includes("offline")
      || lower.includes("dns")
      || lower.includes("connection")
      || lower.includes("econn")
      || lower.includes("etimedout")
      // HTTP 5xx surfacing as "HTTP 502"/"HTTP 503"/etc — retryable.
      || /^http\s*5\d\d/.test(lower);
}

/**
 * Ambient menubar badge poller.
 *
 * Lives at App level so the tray icon's pending-approval count stays
 * accurate even when the user is on a non-Approvals view. Independent of
 * the per-view poll in ApprovalsView — both target the same endpoint,
 * which is fine: the call is small, cached cheaply server-side, and we
 * use a 15s cadence here (vs. 5s for the live view) since ambient
 * awareness doesn't need to be sub-poll-interval fresh.
 *
 * Resets the badge to 0 when auth drops (so a paused/unpaired session
 * doesn't leave a stale "3 pending" count in the menubar).
 */

import { useEffect, useRef } from "react";
import { desktopClient } from "./desktopClient";
import { ensureNotificationPermission, notifyNewApproval, setTrayApprovalBadge, setTrayPendingList } from "./notifications";
import { clearPendingApprovals, setPendingApprovals } from "./approvalsStore";
import { drainVoteQueue } from "./voteQueue";

const AMBIENT_POLL_MS = 15_000;

/**
 * Ambient approvals watcher.
 *
 * Owns the menubar/tray pending-approval badge AND the native
 * notification fire-on-arrival behavior. Lives at App level so both
 * surfaces work regardless of which view is mounted — opening the
 * Approvals view is no longer required to be alerted.
 *
 * Two safeguards against noise:
 *   - `seededRef` swallows notifications on the very first poll so the
 *     OS isn't spammed with one banner per pre-existing row.
 *   - `lastCountRef` skips redundant `set_tray_badge` IPC calls when the
 *     count hasn't changed.
 *
 * The Approvals view itself keeps its own faster (5s) poll for the
 * table data — different concern, different cadence. Notifications
 * fire only from this hook to avoid duplicates.
 */
export function useTrayApprovalsBadge(): void {
  const lastCountRef = useRef<number | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);

  useEffect(() => {
    // Request notification permission once on app boot so the OS prompt
    // appears the first time we have something to say, not at the first
    // arrival mid-session.
    void ensureNotificationPermission();

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;

      if (!desktopClient.hasAuth()) {
        // Auth dropped — clear both the badge and the seeded set so a
        // re-pair starts fresh without instantly notifying for every
        // pre-existing row.
        if (lastCountRef.current !== 0) {
          lastCountRef.current = 0;
          void setTrayApprovalBadge(0);
          void setTrayPendingList([]);
        }
        clearPendingApprovals();
        seededRef.current = false;
        notifiedIdsRef.current.clear();
        schedule();
        return;
      }

      // Drain any queued-for-retry votes from prior offline ticks. Runs
      // BEFORE the list fetch so a freshly-cleared queue is reflected in
      // the same poll cycle.
      void drainVoteQueue();

      const res = await desktopClient.v1ListPipelineRuns({
        limit: 100,
        status: "awaiting_approval",
      });
      if (!cancelled && res.ok) {
        const runs = res.data.runs;
        const count = runs.length;
        // Publish to the shared store so TopBar / Sidebar / any future
        // surface can read the count without their own poll.
        setPendingApprovals(runs.map((r) => r.id));

        if (!seededRef.current) {
          for (const r of runs) notifiedIdsRef.current.add(r.id);
          seededRef.current = true;
        } else {
          for (const r of runs) {
            if (!notifiedIdsRef.current.has(r.id)) {
              notifiedIdsRef.current.add(r.id);
              void notifyNewApproval({
                runId: r.id,
                pipelineId: r.pipelineId,
                triggeredBy: r.triggeredBy,
                stageCount: r.stageCount,
              });
            }
          }
          // GC notified ids that are no longer in the queue so the set
          // doesn't grow unbounded over a long-running session.
          const alive = new Set(runs.map((r) => r.id));
          for (const id of notifiedIdsRef.current) {
            if (!alive.has(id)) notifiedIdsRef.current.delete(id);
          }
        }

        if (lastCountRef.current !== count) {
          lastCountRef.current = count;
          void setTrayApprovalBadge(count);
        }
        // Refresh the tray's "Pending approvals" submenu so the user
        // can click directly into a specific run from the menubar even
        // when the main window is hidden.
        void setTrayPendingList(
          runs.map((r) => ({
            id: r.id,
            pipeline_id: r.pipelineId,
            triggered_by: r.triggeredBy,
          })),
        );
      }
      schedule();
    };

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(tick, AMBIENT_POLL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
}

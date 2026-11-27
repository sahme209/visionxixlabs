/**
 * One state palette for the cockpit, so every page reads the same way at a glance:
 * blue running, green succeeded or healthy, amber waiting or needs attention, red failed, grey idle or unknown.
 * Colour is never the only signal: every dot carries a text label.
 */
export type StatusTone = "running" | "success" | "attention" | "failed" | "idle";

export const TONE_DOT: Record<StatusTone, string> = {
  running: "bg-sky-400",
  success: "bg-emerald-400",
  attention: "bg-amber-300",
  failed: "bg-rose-400",
  idle: "bg-zinc-600",
};
export const TONE_TEXT: Record<StatusTone, string> = {
  running: "text-sky-200",
  success: "text-emerald-200",
  attention: "text-amber-200",
  failed: "text-rose-200",
  idle: "text-zinc-400",
};

const SUCCESS = new Set(["success", "succeeded", "active", "connected", "validated_read_only", "healthy", "passed", "delivered", "completed"]);
const RUNNING = new Set(["running", "in_progress", "queued_running", "delivering", "restarting"]);
const ATTENTION = new Set(["queued", "scheduled", "pending", "deferred", "up_for_retry", "up_for_reschedule", "retry", "waiting", "validation_overdue", "installation_recorded", "consent_recorded", "investigate", "warning", "skipped"]);
const FAILED = new Set(["failed", "failure", "error", "upstream_failed", "revoked", "suspended", "deadletter", "unhealthy", "timed_out", "cancelled_with_error"]);

/** Maps a recorded state string (Airflow, deployments, connections, checks, webhooks) to a tone. */
export function toneFor(state: string | null | undefined): StatusTone {
  const s = (state ?? "").toLowerCase();
  if (SUCCESS.has(s)) return "success";
  if (RUNNING.has(s)) return "running";
  if (FAILED.has(s)) return "failed";
  if (ATTENTION.has(s)) return "attention";
  return "idle";
}

/** Human label for a recorded state string. */
export function stateLabel(state: string | null | undefined): string {
  if (!state) return "Unknown";
  const s = state.replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Cron health catalog — the closed list of every cron name the
 * platform schedules. Lets /dashboard/cron-health enumerate
 * everything without grepping vercel.json at runtime.
 *
 * Adding a new cron: register it here AND in vercel.json. The
 * dashboard reads this list; the cron self-heal tracker writes to
 * whichever key the route uses.
 */

export interface CronSpec {
  /** Unique identifier — must match the cronName passed to recordTickOutcome. */
  id: string;
  /** Operator-readable label. */
  label: string;
  /** Cron schedule (informational; vercel.json is the source of truth). */
  schedule: string;
  /** What this cron does in plain English. */
  description: string;
  /** Path to the route handler (informational). */
  routePath: string;
}

export const CRON_CATALOG: CronSpec[] = [
  {
    id: "autonomy-scheduler",
    label: "Autonomy scheduler",
    schedule: "*/15 * * * *",
    description: "Runs one autonomy cycle per registered tenant every 15 minutes. Records decisions to the rationale table.",
    routePath: "/api/autonomy/scheduler",
  },
  {
    id: "cron-dispatch-telemetry",
    label: "Critical telemetry dispatcher",
    schedule: "*/10 * * * *",
    description: "Pulls Datadog/Sentry/Dynatrace/NR/CW/Azure Monitor/Cloud Monitoring signals and pages humans on severity ≥ high.",
    routePath: "/api/notifications/cron-dispatch-telemetry",
  },
  {
    id: "cron-weekly-digest",
    label: "Weekly digest",
    schedule: "0 14 * * 1",
    description: "Monday 14:00 UTC summary of last 7 days of autonomy + runbook + notification activity.",
    routePath: "/api/notifications/cron-weekly-digest",
  },
  {
    id: "cron-onboarding-reminder",
    label: "Onboarding reminder",
    schedule: "0 15 * * 1",
    description: "Monday 15:00 UTC reminder to tenants whose onboarding completion ratio is below 100%.",
    routePath: "/api/onboarding/cron-reminder",
  },
  {
    id: "cron-drain-retries",
    label: "Outbound retry drain",
    schedule: "*/5 * * * *",
    description: "Every 5 minutes, attempts one final send on each pending OutboundNotificationRetry row older than 5 minutes. Rows resolve to 'succeeded' or 'failed_terminal' — never re-queued.",
    routePath: "/api/notifications/cron-drain-retries",
  },
];

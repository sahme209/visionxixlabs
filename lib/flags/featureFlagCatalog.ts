/**
 * Feature flag catalog — the closed-union of every flag key Axiom
 * recognises. Keeping it a typed catalog (vs free-form strings) means:
 *
 *   • Adding a flag is a deliberate edit.
 *   • Renaming or removing a flag breaks every consumer in the TS
 *     exhaustiveness check.
 *   • The dashboard lists exactly the flags we ship, with the same
 *     label + default the autonomy loop reads.
 *
 * Pure data — safe to import anywhere (client or server).
 */

export type FeatureFlagKey =
  | "autonomy.shadow_mode"
  | "autonomy.dry_run_runbooks"
  | "notifications.weekly_digest"
  | "notifications.dispatch_critical_telemetry"
  | "audit.persist_rationale"
  | "ui.contextual_help_bubble";

export interface FeatureFlagSpec {
  key: FeatureFlagKey;
  /** Operator-readable label. */
  label: string;
  /** One-paragraph description of what the flag controls. */
  description: string;
  /** Default value when no per-tenant override exists. */
  default: boolean;
  /** Free-form category for grouping in the UI. */
  group: "autonomy" | "notifications" | "audit" | "ui";
}

export const FEATURE_FLAG_CATALOG: FeatureFlagSpec[] = [
  {
    key: "autonomy.shadow_mode",
    label: "Autonomy shadow mode",
    description: "When enabled, the autonomy loop still runs every stage but its outcome is recorded only — no approval packets, no handoffs, no notifications. Useful for warming up production tenants.",
    default: false,
    group: "autonomy",
  },
  {
    key: "autonomy.dry_run_runbooks",
    label: "Dry-run runbooks",
    description: "When enabled, /api/autonomy/runbooks returns the runbook list without persisting any candidate evidence refs. Pure preview.",
    default: false,
    group: "autonomy",
  },
  {
    key: "notifications.weekly_digest",
    label: "Weekly Slack/Teams digest",
    description: "When enabled, the Monday 14:00 UTC cron posts the weekly autonomy + runbook + notification rollup to the tenant's configured outbound channels.",
    default: true,
    group: "notifications",
  },
  {
    key: "notifications.dispatch_critical_telemetry",
    label: "Dispatch critical telemetry",
    description: "When enabled, the */10 telemetry cron fans high+critical signals out to Slack/Teams. Disable when running a noisy backfill.",
    default: true,
    group: "notifications",
  },
  {
    key: "audit.persist_rationale",
    label: "Persist decision rationale",
    description: "When enabled, every autonomy candidate decision is durably persisted to AutonomyDecisionRationale. Required for /dashboard/rationale + CSV export. Defaults on; only disable when storage is the bottleneck.",
    default: true,
    group: "audit",
  },
  {
    key: "ui.contextual_help_bubble",
    label: "Contextual help bubble",
    description: "When enabled, the floating '?' bubble renders on every dashboard page. Disable to hide help for embedded-iframe deployments.",
    default: true,
    group: "ui",
  },
];

const KEY_SET = new Set<string>(FEATURE_FLAG_CATALOG.map((f) => f.key));

/** Type-safe predicate — narrows arbitrary strings into the union. */
export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return KEY_SET.has(value);
}

/** Default value lookup. Throws on unknown keys (closed-union safety). */
export function defaultFlagValue(key: FeatureFlagKey): boolean {
  const spec = FEATURE_FLAG_CATALOG.find((f) => f.key === key);
  if (!spec) {
    throw new Error(`Unknown feature flag key: ${key}`);
  }
  return spec.default;
}

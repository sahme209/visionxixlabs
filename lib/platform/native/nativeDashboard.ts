/**
 * Native Dashboard Builder — typed model.
 *
 * Operators compose dashboards from widgets. Each widget binds to a
 * data source (native telemetry source, connector, or service-catalog
 * view) and renders a typed visual (chart, table, log panel, alert
 * panel, incident panel, etc).
 *
 * Persistence lands in a follow-up Prisma migration. Pure types here.
 */

import type { OrganizationId, UserId } from "@/lib/domain/ids";

export type WidgetKind =
  | "metric_chart"
  | "metric_stat"
  | "log_table"
  | "trace_waterfall"
  | "service_health_grid"
  | "alert_list"
  | "incident_list"
  | "connector_health"
  | "agent_activity"
  | "approval_queue"
  | "static_markdown";

export type WidgetTimeRange =
  | "last_15m"
  | "last_1h"
  | "last_24h"
  | "last_7d"
  | "last_30d"
  | "custom";

export interface DashboardWidget {
  organizationId: OrganizationId;
  id: string;
  dashboardId: string;
  kind: WidgetKind;
  title: string;
  description?: string;
  /** Grid position. */
  layout: { x: number; y: number; w: number; h: number };
  /** Closed-union data source binding. */
  dataSource:
    | { kind: "metric_series"; sourceId: string; name: string; labels?: Record<string, string> }
    | { kind: "log_query"; sourceId: string; query: string }
    | { kind: "service_catalog"; tier?: string }
    | { kind: "alert_rule_set"; ruleIds: string[] }
    | { kind: "incident_filter"; severity?: string[]; serviceIds?: string[] }
    | { kind: "connector"; connectorId: string }
    | { kind: "static"; markdown: string };
  timeRange: WidgetTimeRange;
  /** Auto-refresh interval in seconds. 0 = manual refresh only. */
  refreshSeconds: number;
  /** Optional alert threshold rendered as a guide line. */
  alertThreshold?: { value: number; severity: "warning" | "critical" };
}

export interface Dashboard {
  organizationId: OrganizationId;
  id: string;
  /** Slug for /dashboard/observability/dashboards/[slug]. */
  slug: string;
  name: string;
  description?: string;
  /** Owner. */
  createdByUserId?: UserId;
  /** Visibility — private to creator vs visible to whole workspace. */
  visibility: "private" | "workspace";
  /** Suggested category for the dashboards index page. */
  category: "service" | "cloud" | "security" | "devops" | "database" | "executive" | "custom";
  /** Whether this is a system-provided default that operators can fork but not edit. */
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

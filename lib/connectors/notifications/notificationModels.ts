/**
 * Notification connector models — typed contracts for Slack / Teams / email /
 * webhook outbound notification destinations.
 */

export type NotificationSystem = "slack" | "msteams" | "email" | "webhook";

export type NotificationCategory =
  | "approval_required"
  | "approval_granted"
  | "scan_completed"
  | "scan_failed"
  | "deployment_blocker"
  | "rollback_alert"
  | "drift_alert"
  | "cost_anomaly"
  | "release_readiness_dropped"
  | "weekly_executive_summary"
  | "audit_export_completed"
  | "system_status";

export type Severity = "info" | "warning" | "critical";

export interface NotificationDestination {
  id: string;
  system: NotificationSystem;
  /** Slack webhook URL, Teams webhook URL, email address, generic webhook URL. */
  target: string;
  /** Display name. */
  name: string;
  /** Subscription rules — which categories + severities go here. */
  subscriptions: NotificationSubscription[];
  /** Whether the destination is healthy. */
  health: "healthy" | "degraded" | "failed";
  createdAt: string;
}

export interface NotificationSubscription {
  category: NotificationCategory;
  minSeverity: Severity;
  /** Provider filter — empty means all providers. */
  providers?: ("aws" | "azure" | "gcp")[];
  /** Environment filter — empty means all. */
  environments?: ("production" | "staging" | "development" | "qa")[];
  enabled: boolean;
}

export interface NotificationEvent {
  id: string;
  category: NotificationCategory;
  severity: Severity;
  title: string;
  body: string;
  /** Deep link into the platform for the user to take action. */
  href?: string;
  /** Provider / environment context. */
  provider?: "aws" | "azure" | "gcp";
  environment?: "production" | "staging" | "development" | "qa";
  /** When the event happened. */
  timestamp: string;
}

export interface DeliveryResult {
  destinationId: string;
  eventId: string;
  delivered: boolean;
  deliveredAt?: string;
  error?: string;
  /** HTTP status from the destination. */
  statusCode?: number;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/**
 * Given a notification event + a list of destinations, return the destinations
 * that should receive this event based on their subscription rules. Pure function.
 */
export function routeEvent(event: NotificationEvent, destinations: NotificationDestination[]): NotificationDestination[] {
  const severityRank: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };
  return destinations.filter((dest) => {
    if (dest.health === "failed") return false;
    return dest.subscriptions.some((sub) => {
      if (!sub.enabled) return false;
      if (sub.category !== event.category) return false;
      if (severityRank[event.severity] < severityRank[sub.minSeverity]) return false;
      if (sub.providers && sub.providers.length > 0 && event.provider && !sub.providers.includes(event.provider)) return false;
      if (sub.environments && sub.environments.length > 0 && event.environment && !sub.environments.includes(event.environment)) return false;
      return true;
    });
  });
}

/**
 * Format a notification event for a target system. Pure function — no I/O.
 */
export function formatForSystem(event: NotificationEvent, system: NotificationSystem): { payload: string; contentType: string } {
  if (system === "slack") {
    const payload = JSON.stringify({
      text: `*${event.title}*`,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `*${event.title}*\n${event.body}` } },
        ...(event.href ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open in Axiom" }, url: event.href }] }] : []),
      ],
    });
    return { payload, contentType: "application/json" };
  }
  if (system === "msteams") {
    const payload = JSON.stringify({
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: event.title,
      themeColor: event.severity === "critical" ? "f87171" : event.severity === "warning" ? "fbbf24" : "60a5fa",
      title: event.title,
      text: event.body,
      potentialAction: event.href ? [{ "@type": "OpenUri", name: "Open in Axiom", targets: [{ os: "default", uri: event.href }] }] : undefined,
    });
    return { payload, contentType: "application/json" };
  }
  if (system === "email") {
    return { payload: `Subject: [${event.severity.toUpperCase()}] ${event.title}\n\n${event.body}\n\n${event.href ?? ""}`, contentType: "text/plain" };
  }
  // webhook — pass through structured event
  return { payload: JSON.stringify(event), contentType: "application/json" };
}

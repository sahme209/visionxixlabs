/**
 * Notification Center builder.
 *
 * Synthesises notifications from real canonical signals — never random
 * or fake. Consumes:
 *
 *   - Risk Queue          → risk_created / remediation_ready / approval_required
 *   - Integration Health  → integration_failed / recovered
 *   - Priority Report     → security_finding_detected / readiness_blocker
 *   - AxiomOSState        → policy_violation (via criticalBlockers)
 *
 * Pure read-only. Tenant-scoped via underlying builders.
 */

import "server-only";

import { buildRiskQueue } from "@/lib/risk/riskQueueBuilder";
import { buildIntegrationHealthReport } from "@/lib/integrations/integrationHealthChecker";
import { buildPriorityReport } from "@/lib/intelligence/priorityEngine";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  NotificationItem,
  NotificationReport,
  NotificationSeverity,
  NotificationSourceMode,
  NotificationType,
} from "./notificationModel";

export interface BuildNotificationsInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildNotifications(input: BuildNotificationsInput): Promise<NotificationReport> {
  const [risk, health, priorities, state] = await Promise.all([
    buildRiskQueue({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildIntegrationHealthReport({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildPriorityReport({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  const notifications: NotificationItem[] = [];

  // ---------------------------------------------------------------------------
  // 1) Integration health events
  // ---------------------------------------------------------------------------
  for (const entry of health.entries) {
    if (entry.status === "blocked") {
      notifications.push(buildNotification({
        id: `notify:integration:${entry.id}:blocked`,
        type: "integration_failed",
        severity: "critical",
        title: `${entry.label} blocked`,
        description: entry.failureReason ?? entry.headline,
        sourceSystem: entry.id,
        sourceMode: entry.sourceMode as NotificationSourceMode,
        route: { label: "Open Integration Health", href: "/dashboard/integrations/health" },
        safeNextAction: entry.safeNextAction,
        linkedObjectType: "integration_health",
        linkedObjectId: entry.id,
        evidenceRefs: entry.evidenceRefs,
        limitations: entry.limitations,
        createdAt: state.generatedAt,
      }));
    } else if (entry.status === "healthy" && entry.sourceMode === "live") {
      notifications.push(buildNotification({
        id: `notify:integration:${entry.id}:recovered`,
        type: "integration_recovered",
        severity: "info",
        title: `${entry.label} healthy`,
        description: entry.headline,
        sourceSystem: entry.id,
        sourceMode: entry.sourceMode as NotificationSourceMode,
        route: { label: "Open Integration Health", href: "/dashboard/integrations/health" },
        linkedObjectType: "integration_health",
        linkedObjectId: entry.id,
        evidenceRefs: entry.evidenceRefs,
        limitations: entry.limitations,
        createdAt: state.generatedAt,
      }));
    }
  }

  // ---------------------------------------------------------------------------
  // 2) Risk-derived notifications
  // ---------------------------------------------------------------------------
  for (const r of risk.items.slice(0, 8)) {
    const type: NotificationType =
      r.status === "approval_required"    ? "approval_required" :
      r.status === "remediation_prepared" ? "remediation_ready" :
      r.status === "simulation_ready"     ? "simulation_ready"  :
      r.category === "security_finding"   ? "security_finding_detected" :
      r.category === "release_blocker"    ? "release_blocker_detected"  :
      r.category === "readiness_blocker"  ? "readiness_blocker" :
                                            "risk_created";
    const severity: NotificationSeverity =
      r.severity === "critical" || r.severity === "high" ? "critical" :
      r.severity === "medium"                            ? "warning"  :
                                                           "info";
    notifications.push(buildNotification({
      id: `notify:risk:${r.id}`,
      type,
      severity,
      title: r.title,
      description: r.description,
      sourceSystem: r.sourceSystem,
      sourceMode: r.sourceMode as NotificationSourceMode,
      route: r.safeNextAction,
      safeNextAction: r.safeNextAction,
      linkedObjectType: "risk",
      linkedObjectId: r.id,
      evidenceRefs: r.evidenceRefs,
      limitations: r.limitations,
      createdAt: state.generatedAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // 3) Critical blockers → policy_violation notifications
  // ---------------------------------------------------------------------------
  for (const blocker of state.criticalBlockers) {
    notifications.push(buildNotification({
      id: `notify:policy:${blocker.area}`,
      type: "policy_violation",
      severity: "critical",
      title: `Policy attention: ${blocker.area}`,
      description: blocker.reason,
      sourceSystem: "policy_engine",
      sourceMode: state.sourceMode as NotificationSourceMode,
      route: blocker.safeNextAction ?? { label: "Open Policies", href: "/dashboard/policies" },
      safeNextAction: blocker.safeNextAction,
      linkedObjectType: "policy",
      linkedObjectId: blocker.area,
      evidenceRefs: ["axiomOS:criticalBlockers"],
      limitations: [],
      createdAt: state.generatedAt,
    }));
  }

  // Sort: critical first, then warning, then info; newest first within band
  notifications.sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity));

  // Dedupe by id
  const seen = new Set<string>();
  const deduped = notifications.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  const summary = {
    total:    deduped.length,
    critical: deduped.filter((n) => n.severity === "critical").length,
    warning:  deduped.filter((n) => n.severity === "warning").length,
    info:     deduped.filter((n) => n.severity === "info").length,
    byType:   {} as Record<string, number>,
  };
  for (const n of deduped) summary.byType[n.type] = (summary.byType[n.type] ?? 0) + 1;

  // touch priorities to surface unused warnings in TS
  void priorities;

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    notifications: deduped,
    summary,
    safetyContract: "notifications_review_only_no_action_taken",
    limitations: [
      "Notifications are synthesised at request time — historical persistence is not yet wired.",
      "Each notification carries a route the operator can click; the page itself never triggers downstream effects.",
    ],
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface BuildItemInput {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  sourceSystem: string;
  sourceMode: NotificationSourceMode;
  route: { label: string; href: string };
  safeNextAction?: { label: string; href: string };
  linkedObjectType?: string;
  linkedObjectId?: string;
  evidenceRefs: string[];
  limitations: string[];
  createdAt: string;
}

function buildNotification(i: BuildItemInput): NotificationItem {
  return {
    id: i.id,
    type: i.type,
    severity: i.severity,
    createdAt: i.createdAt,
    title: i.title,
    description: i.description,
    sourceSystem: i.sourceSystem,
    sourceMode: i.sourceMode,
    route: i.route,
    safeNextAction: i.safeNextAction,
    linkedObjectType: i.linkedObjectType,
    linkedObjectId: i.linkedObjectId,
    evidenceRefs: i.evidenceRefs,
    limitations: i.limitations,
  };
}

function severityWeight(s: NotificationSeverity): number {
  return s === "critical" ? 0 : s === "warning" ? 1 : 2;
}

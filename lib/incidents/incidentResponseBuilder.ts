/**
 * Incident Response builder.
 *
 * Pure read-only composition. Per-provider posture honors a closed
 * catalog of incident providers. Until each webhook / API client
 * lands, incident lists stay empty.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { loadAppEnv } from "@/lib/config/env";
import { readIncidentQueue } from "./incidentWebhookReceiver";
import { extractPagerDutyOpenIncidents } from "./pagerDutyPullExtractor";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  IncidentProvider,
  IncidentProviderPosture,
  IncidentRecord,
  IncidentResponseReport,
  IncidentSeverity,
  IncidentSourceMode,
  IncidentStatus,
} from "./incidentResponseModel";

export interface BuildIncidentsInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildIncidentResponse(input: BuildIncidentsInput): Promise<IncidentResponseReport> {
  const env = loadAppEnv();
  const state = await buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId });

  // Try live PagerDuty pull.
  let pdLive: Awaited<ReturnType<typeof extractPagerDutyOpenIncidents>> | null = null;
  if (env.pagerDutyPullEnabled) {
    try {
      pdLive = await extractPagerDutyOpenIncidents();
    } catch {
      pdLive = null;
    }
  }

  const providers: IncidentProviderPosture[] = [
    posture("pagerduty", "preview", ["PAGERDUTY_API_TOKEN with incidents:read", "Routing key + service ids"], "https://app.pagerduty.com/"),
    posture("opsgenie",  "preview", ["OPSGENIE_API_KEY with incident:read"], "https://app.opsgenie.com/"),
    posture("slack_alerts", "preview", ["Slack incoming webhook + alert channel allowlist"], "https://api.slack.com/apps"),
    posture("microsoft_teams", "preview", ["Teams incoming webhook + channel allowlist"]),
    posture("victorops", "preview", ["VICTOROPS_API_KEY"]),
    posture("xmatters",  "preview", ["XMATTERS_API_KEY"]),
    posture("discord_alerts", "preview", ["Discord webhook URL"]),
  ];

  // ---------------------------------------------------------------------------
  // Drain the inbound webhook queue into per-provider postures.
  // ---------------------------------------------------------------------------
  const inbound = readIncidentQueue();
  for (const r of inbound) {
    const target = providers.find((p) => p.provider === r.provider);
    if (target) {
      target.openIncidents.push(r);
      target.mode = "live";
      target.headline = `Live · ${target.openIncidents.length} incident(s) received via webhook.`;
    }
  }

  // ---------------------------------------------------------------------------
  // Splice live-pulled PagerDuty incidents into the pagerduty posture.
  // Dedupe against webhook-received records by externalId.
  // ---------------------------------------------------------------------------
  if (pdLive && pdLive.mode === "live" && pdLive.records.length > 0) {
    const target = providers.find((p) => p.provider === "pagerduty");
    if (target) {
      const seenIds = new Set(target.openIncidents.map((i) => i.externalId));
      for (const r of pdLive.records) {
        if (!seenIds.has(r.externalId)) target.openIncidents.push(r);
      }
      target.mode = "live";
      target.headline = `Live · ${target.openIncidents.length} incident(s) (webhook + REST pull).`;
      target.missingRequirements = [];
      target.configured = true;
    }
  }

  const incidents: IncidentRecord[] = providers.flatMap((p) => p.openIncidents);
  const liveCount = providers.filter((p) => p.mode === "live").length;

  const incidentsBySeverity: Record<IncidentSeverity, number> = { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 };
  const incidentsByStatus: Record<IncidentStatus, number> = {
    triggered: 0, acknowledged: 0, investigating: 0, mitigating: 0,
    resolved: 0, auto_resolved: 0, preview: 0, unknown: 0,
  };
  for (const i of incidents) { incidentsBySeverity[i.severity]++; incidentsByStatus[i.status]++; }

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    providers,
    incidents,
    summary: {
      providerCount: providers.length,
      liveProviderCount: liveCount,
      incidentsTotal: incidents.length,
      incidentsBySeverity,
      incidentsByStatus,
      p1Count: incidentsBySeverity.p1,
      openCount: incidents.filter((i) => i.status !== "resolved" && i.status !== "auto_resolved").length,
    },
    overallSourceMode: liveCount > 0 ? (liveCount === providers.length ? "live" : "partial_live") : "preview",
    safetyContract: "incident_response_read_only",
    limitations: [
      "Incident connectors are typed and ready. Inbound webhook + API client wires per provider in follow-up phases.",
      "When live, every IncidentRecord is translated into a Risk Queue entry + Notification + (if approval needed) Approval Packet — autonomy loop drives the routing.",
    ],
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  };
}

function posture(
  provider: IncidentProvider,
  rawMode: IncidentSourceMode,
  missingRequirements: string[],
  externalConsoleHref?: string,
): IncidentProviderPosture {
  return {
    provider,
    mode: rawMode,
    configured: rawMode === "live" || rawMode === "partial_live",
    headline: rawMode === "live"
      ? "Live incident provider — open incidents stream + responder routing active."
      : "Preview — typed connector awaiting credentials.",
    openIncidents: [],
    missingRequirements: rawMode === "live" ? [] : missingRequirements,
    externalConsoleHref,
    safeNextAction: { label: "Open Sources", href: "/dashboard/sources" },
  };
}

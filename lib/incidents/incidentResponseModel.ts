/**
 * Incident Response Lane — typed contract.
 *
 * Canonical model for every on-call / incident provider Axiom can
 * ingest from (PagerDuty / Opsgenie / Slack / Microsoft Teams /
 * VictorOps / xMatters). Inbound incidents land here, get translated
 * into a canonical IncidentRecord, and routed by the autonomy loop
 * into the Risk Queue + Approval Packets.
 *
 * Outbound notification (paging humans) is a separate model and gets
 * gated through the autonomy approve stage.
 *
 * safetyContract literal 'incident_response_read_only'.
 */

export type IncidentProvider =
  | "pagerduty"
  | "opsgenie"
  | "slack_alerts"
  | "microsoft_teams"
  | "victorops"
  | "xmatters"
  | "discord_alerts";

export type IncidentSourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "blocked"
  | "disabled"
  | "unknown";

export type IncidentSeverity = "p1" | "p2" | "p3" | "p4" | "p5";

export type IncidentStatus =
  | "triggered"
  | "acknowledged"
  | "investigating"
  | "mitigating"
  | "resolved"
  | "auto_resolved"
  | "preview"
  | "unknown";

export interface IncidentResponder {
  id: string;
  name: string;
  /** team / oncall rotation. */
  rotation?: string;
  /** Honest preview when no live integration. */
  sourceMode: IncidentSourceMode;
}

export interface IncidentRecord {
  id: string;
  provider: IncidentProvider;
  externalId: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedService?: string;
  triggeredAt: string;
  resolvedAt?: string;
  responder?: IncidentResponder;
  externalUrl?: string;
  /** Honest preview / live tag. */
  sourceMode: IncidentSourceMode;
  /** Pre-mortem rationale. */
  summary: string;
  /** Linked telemetry signal ids. */
  linkedTelemetrySignalIds: string[];
  /** Linked risk queue ids (after autonomy translates this signal). */
  linkedRiskIds: string[];
  /** Safe next operator action. */
  safeNextAction: { label: string; href: string };
}

export interface IncidentProviderPosture {
  provider: IncidentProvider;
  mode: IncidentSourceMode;
  configured: boolean;
  headline: string;
  /** Open incidents from this provider. */
  openIncidents: IncidentRecord[];
  missingRequirements: string[];
  externalConsoleHref?: string;
  safeNextAction: { label: string; href: string };
}

export interface IncidentResponseReport {
  generatedAt: string;
  tenantId?: string;
  providers: IncidentProviderPosture[];
  incidents: IncidentRecord[];
  summary: {
    providerCount: number;
    liveProviderCount: number;
    incidentsTotal: number;
    incidentsBySeverity: Record<IncidentSeverity, number>;
    incidentsByStatus: Record<IncidentStatus, number>;
    p1Count: number;
    openCount: number;
  };
  overallSourceMode: IncidentSourceMode;
  /** Hard literal. */
  safetyContract: "incident_response_read_only";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const INCIDENT_PROVIDER_LABEL: Record<IncidentProvider, string> = {
  pagerduty:        "PagerDuty",
  opsgenie:         "Opsgenie",
  slack_alerts:     "Slack alerts",
  microsoft_teams:  "Microsoft Teams",
  victorops:        "VictorOps",
  xmatters:         "xMatters",
  discord_alerts:   "Discord alerts",
};

export const INCIDENT_SEVERITY_TONE: Record<IncidentSeverity, "rose" | "amber" | "cyan" | "emerald" | "zinc"> = {
  p1: "rose", p2: "amber", p3: "cyan", p4: "emerald", p5: "zinc",
};

export const INCIDENT_STATUS_TONE: Record<IncidentStatus, "rose" | "amber" | "cyan" | "emerald" | "violet" | "zinc"> = {
  triggered:       "rose",
  acknowledged:    "amber",
  investigating:   "amber",
  mitigating:      "cyan",
  resolved:        "emerald",
  auto_resolved:   "emerald",
  preview:         "violet",
  unknown:         "zinc",
};

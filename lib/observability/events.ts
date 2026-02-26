/**
 * Phase 7: Structured observability events.
 * JSON format only. No console.log spam.
 * Optional OpenTelemetry hook placeholders.
 */

export type EventType =
  | "ENGINE_TRIGGERED"
  | "ENGINE_COMPLETED"
  | "ENGINE_FAILED"
  | "DRIFT_DETECTED"
  | "CONNECTOR_LINKED"
  | "EXPORT_DOWNLOADED"
  | "UPGRADE_INTENT_CREATED";

type EventPayload = {
  event: EventType;
  ts: string;
  leadId?: string;
  engineName?: string;
  tier?: string;
  unifiedTier?: string;
  scoringVersion?: string;
  [key: string]: unknown;
};

function emit(event: EventPayload): void {
  const line = JSON.stringify(event);
  console.info(line);
}

/** Structured engine event — include leadId, engineName, unifiedTier, scoringVersion if applicable */
export function eventEngineTriggered(args: {
  leadId: string;
  engineName: string;
  tier?: string;
  unifiedTier?: string;
  scoringVersion?: string;
}) {
  emit({ event: "ENGINE_TRIGGERED", ts: new Date().toISOString(), ...args });
}

export function eventEngineCompleted(args: {
  leadId: string;
  engineName: string;
  tier?: string;
  unifiedTier?: string;
  scoringVersion?: string;
}) {
  emit({ event: "ENGINE_COMPLETED", ts: new Date().toISOString(), ...args });
}

export function eventEngineFailed(args: {
  leadId: string;
  engineName: string;
  error?: string;
  tier?: string;
  unifiedTier?: string;
}) {
  emit({ event: "ENGINE_FAILED", ts: new Date().toISOString(), ...args });
}

export function eventDriftDetected(args: { leadId: string; signalCount: number }) {
  emit({ event: "DRIFT_DETECTED", ts: new Date().toISOString(), ...args });
}

export function eventConnectorLinked(args: { leadId: string; connectorType: string }) {
  emit({ event: "CONNECTOR_LINKED", ts: new Date().toISOString(), ...args });
}

export function eventExportDownloaded(args: { leadId: string }) {
  emit({ event: "EXPORT_DOWNLOADED", ts: new Date().toISOString(), ...args });
}

export function eventUpgradeIntentCreated(args: { leadId: string; desiredTier: string }) {
  emit({ event: "UPGRADE_INTENT_CREATED", ts: new Date().toISOString(), ...args });
}

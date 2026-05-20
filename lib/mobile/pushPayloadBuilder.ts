/**
 * Pure mobile push-notification payload builder.
 *
 * Emits the canonical APNS (iOS) and FCM (Android) shapes for an
 * Axiom event. The shapes look slightly different per platform; this
 * module is the single source of truth so a mobile-push gateway can
 * call buildApnsPayload + buildFcmPayload and pass the result on.
 *
 * Pure / deterministic. NEVER includes user-prompt content or
 * tenant data beyond what's already in the operator-facing summary.
 */

export type PushEventKind =
  | "approval_packet_ready"
  | "incident_paged"
  | "deploy_rollback_recommended"
  | "drift_high_severity"
  | "compliance_packet_ready";

export interface PushPayloadInput {
  kind: PushEventKind;
  /** ≤ 60 chars; iOS title / Android title. */
  title: string;
  /** ≤ 140 chars; iOS body / Android body. */
  body: string;
  /** Severity surfaces as iOS interruption-level + Android priority. */
  severity?: "low" | "medium" | "high" | "critical";
  /** Optional deep-link the OS opens on tap. */
  deepLink?: string;
  /** Optional thread id so multiple alerts collapse together on the lock screen. */
  threadId?: string;
}

export interface ApnsPayload {
  /** Top-level aps dictionary. */
  aps: {
    alert: { title: string; body: string };
    sound: string;
    "thread-id"?: string;
    "interruption-level": "passive" | "active" | "time-sensitive" | "critical";
    "mutable-content"?: 1;
  };
  /** Custom user-info dictionary. */
  custom: {
    kind: PushEventKind;
    deepLink?: string;
  };
}

export interface FcmPayload {
  notification: { title: string; body: string };
  android: {
    priority: "normal" | "high";
    notification: {
      sound: "default";
      tag?: string;
      channel_id: "axiom_default" | "axiom_critical";
    };
  };
  data: Record<string, string>;
}

const clip = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 3)}...` : s);

function apnsInterruption(severity: PushPayloadInput["severity"]): ApnsPayload["aps"]["interruption-level"] {
  switch (severity) {
    case "critical": return "critical";
    case "high":     return "time-sensitive";
    case "medium":   return "active";
    case "low":      return "passive";
    default:         return "active";
  }
}

export function buildApnsPayload(input: PushPayloadInput): ApnsPayload {
  return {
    aps: {
      alert: { title: clip(input.title, 60), body: clip(input.body, 140) },
      sound: "default",
      "thread-id": input.threadId,
      "interruption-level": apnsInterruption(input.severity),
      "mutable-content": 1,
    },
    custom: {
      kind: input.kind,
      deepLink: input.deepLink,
    },
  };
}

export function buildFcmPayload(input: PushPayloadInput): FcmPayload {
  const high = input.severity === "high" || input.severity === "critical";
  const data: Record<string, string> = { kind: input.kind };
  if (input.deepLink) data.deepLink = input.deepLink;
  if (input.threadId) data.threadId = input.threadId;
  return {
    notification: { title: clip(input.title, 60), body: clip(input.body, 140) },
    android: {
      priority: high ? "high" : "normal",
      notification: {
        sound: "default",
        tag: input.threadId,
        channel_id: input.severity === "critical" ? "axiom_critical" : "axiom_default",
      },
    },
    data,
  };
}

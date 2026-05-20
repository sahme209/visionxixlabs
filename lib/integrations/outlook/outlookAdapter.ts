/**
 * Microsoft Outlook integration adapter (Microsoft Graph).
 *
 * - sendOutlookMail: POSTs /me/sendMail (or /users/{id}/sendMail)
 * - createOutlookEvent: POSTs /me/events for an incident war-room slot
 *
 * Both surfaces use OAuth 2.0 access tokens from the Microsoft
 * identity platform — the route handler is responsible for the
 * authorization-code dance + token refresh. This module only does
 * the HTTP call. NEVER throws; never logs tokens.
 */

import "server-only";
import { aiFetch } from "@/lib/ai/aiFetch";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const sendMailUrl = (asUser: string | undefined): string =>
  asUser ? `${GRAPH_BASE}/users/${encodeURIComponent(asUser)}/sendMail` : `${GRAPH_BASE}/me/sendMail`;

const eventsUrl = (asUser: string | undefined): string =>
  asUser ? `${GRAPH_BASE}/users/${encodeURIComponent(asUser)}/events` : `${GRAPH_BASE}/me/events`;

export interface OutlookCommonResult {
  ok: boolean;
  latencyMs: number;
  errorKind?: "missing_token" | "missing_recipients" | "rate_limited" | "bad_response" | "network" | "timeout";
  hint?: string;
}

export interface OutlookMailInput {
  graphAccessToken: string;
  /** Send-as user (UPN or object id); omit to use /me. */
  asUser?: string;
  to: readonly string[];
  cc?: readonly string[];
  subject: string;
  /** Either plain text or html — caller picks. */
  body: string;
  bodyContentType?: "text" | "html";
  /** Optional incident severity flag rendered as Outlook importance. */
  importance?: "low" | "normal" | "high";
}

export async function sendOutlookMail(input: OutlookMailInput): Promise<OutlookCommonResult> {
  const t0 = Date.now();
  if (!input.graphAccessToken) {
    return { ok: false, latencyMs: 0, errorKind: "missing_token", hint: "graphAccessToken required" };
  }
  if (!input.to || input.to.length === 0) {
    return { ok: false, latencyMs: 0, errorKind: "missing_recipients", hint: "to list is empty" };
  }
  const toRecipients = input.to.map((address) => ({ emailAddress: { address } }));
  const ccRecipients = (input.cc ?? []).map((address) => ({ emailAddress: { address } }));
  const body = {
    message: {
      subject: input.subject.slice(0, 250),
      body: { contentType: input.bodyContentType ?? "text", content: input.body },
      toRecipients,
      ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
      importance: input.importance ?? "normal",
    },
    saveToSentItems: true,
  };

  try {
    const { res, latencyMs } = await aiFetch({
      provider: "mock",
      url: sendMailUrl(input.asUser),
      headers: { authorization: `Bearer ${input.graphAccessToken}` },
      body,
      timeoutMs: 10_000,
    });
    // sendMail returns 202 Accepted on success with empty body.
    if (res.status === 202) return { ok: true, latencyMs };
    const text = await res.text();
    return { ok: false, latencyMs, errorKind: "bad_response", hint: text.slice(0, 80) };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const kind = (err as { kind?: string }).kind;
    if (kind === "timeout") return { ok: false, latencyMs, errorKind: "timeout" };
    if (kind === "rate_limited") return { ok: false, latencyMs, errorKind: "rate_limited" };
    return { ok: false, latencyMs, errorKind: "network", hint: "fetch failed" };
  }
}

export interface OutlookEventInput {
  graphAccessToken: string;
  asUser?: string;
  subject: string;
  /** ISO 8601 with timezone, e.g. "2026-05-20T15:00:00Z". */
  startIso: string;
  endIso: string;
  attendees: readonly string[];
  /** Optional online-meeting flag (Teams meeting). */
  onlineMeeting?: boolean;
  body?: string;
  bodyContentType?: "text" | "html";
}

export interface OutlookEventResult extends OutlookCommonResult {
  /** Graph event id when ok=true. */
  eventId?: string;
  /** Teams join URL when onlineMeeting=true and Graph created one. */
  joinUrl?: string;
}

interface GraphEventResponse {
  id?: string;
  onlineMeeting?: { joinUrl?: string };
}

export async function createOutlookEvent(input: OutlookEventInput): Promise<OutlookEventResult> {
  const t0 = Date.now();
  if (!input.graphAccessToken) {
    return { ok: false, latencyMs: 0, errorKind: "missing_token", hint: "graphAccessToken required" };
  }
  const body: Record<string, unknown> = {
    subject: input.subject.slice(0, 250),
    start: { dateTime: input.startIso, timeZone: "UTC" },
    end:   { dateTime: input.endIso,   timeZone: "UTC" },
    attendees: input.attendees.map((address) => ({ emailAddress: { address }, type: "required" })),
    body: { contentType: input.bodyContentType ?? "text", content: input.body ?? "" },
    isOnlineMeeting: Boolean(input.onlineMeeting),
    onlineMeetingProvider: input.onlineMeeting ? "teamsForBusiness" : undefined,
  };

  try {
    const { res, latencyMs } = await aiFetch({
      provider: "mock",
      url: eventsUrl(input.asUser),
      headers: { authorization: `Bearer ${input.graphAccessToken}` },
      body,
      timeoutMs: 10_000,
    });
    if (res.status >= 200 && res.status < 300) {
      const json = JSON.parse(await res.text()) as GraphEventResponse;
      return {
        ok: true, latencyMs,
        eventId: json.id,
        joinUrl: json.onlineMeeting?.joinUrl,
      };
    }
    const text = await res.text();
    return { ok: false, latencyMs, errorKind: "bad_response", hint: text.slice(0, 80) };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const kind = (err as { kind?: string }).kind;
    if (kind === "timeout") return { ok: false, latencyMs, errorKind: "timeout" };
    if (kind === "rate_limited") return { ok: false, latencyMs, errorKind: "rate_limited" };
    return { ok: false, latencyMs, errorKind: "network", hint: "fetch failed" };
  }
}

/** Build a war-room invite for an incident. */
export function buildIncidentWarRoom(input: {
  service: string;
  severity: "low" | "medium" | "high" | "critical";
  startIso: string;
  durationMins?: number;
  attendees: readonly string[];
}): { subject: string; startIso: string; endIso: string; body: string; onlineMeeting: true } {
  const dur = Math.max(15, Math.min(input.durationMins ?? 30, 240));
  const end = new Date(new Date(input.startIso).getTime() + dur * 60 * 1000).toISOString();
  return {
    subject: `[${input.severity.toUpperCase()}] War room — ${input.service}`,
    startIso: input.startIso,
    endIso: end,
    body: `Incident war room for ${input.service}. Approval-only-no-execution platform — Axiom never auto-applies remediations; this meeting coordinates the human decision.`,
    onlineMeeting: true,
  };
}

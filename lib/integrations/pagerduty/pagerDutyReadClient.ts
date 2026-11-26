import "server-only";
import { boundedText, getJson, isoTime, isRecord, providerLink } from "../readOnlyHttp";

/**
 * PagerDuty read-only client: open incidents, optionally limited to services. V19 uses them to warn
 * that a deployment is going out while an incident is open; it never triggers, acknowledges, resolves
 * or reassigns. A read-only REST API key is enough. Live acceptance with a real account is pending.
 */
export type PagerDutyCredential = { token: string; region?: "us" | "eu" };
export interface PagerDutyIncident { id: string; number: number | null; title: string; status: "triggered" | "acknowledged"; urgency: "high" | "low" | null; service: string | null; createdAt: string | null; url: string | null }
const ID = /^[A-Z0-9]{2,32}$/;

export class PagerDutyReadClient {
  private readonly host: string;
  constructor(private readonly credential: PagerDutyCredential) {
    if (!credential.token || credential.token.length > 200) throw new Error("pagerduty_token_invalid");
    this.host = credential.region === "eu" ? "https://api.eu.pagerduty.com" : "https://api.pagerduty.com";
  }

  async listOpenIncidents(serviceIds: readonly string[] = []): Promise<PagerDutyIncident[]> {
    if (serviceIds.length > 20 || serviceIds.some((s) => !ID.test(s))) throw new Error("pagerduty_service_ids_invalid");
    const q = new URLSearchParams([["statuses[]", "triggered"], ["statuses[]", "acknowledged"], ["limit", "100"], ["sort_by", "created_at:desc"], ...serviceIds.map((s) => ["service_ids[]", s] as [string, string])]);
    const body = await getJson(`${this.host}/incidents?${q}`, { accept: "application/vnd.pagerduty+json;version=2", authorization: `Token token=${this.credential.token}` }, "pagerduty");
    if (!isRecord(body) || !Array.isArray(body.incidents) || body.incidents.length > 100) throw new Error("pagerduty_response_invalid");
    return body.incidents.filter(isRecord).flatMap((i) => {
      const id = typeof i.id === "string" && ID.test(i.id) ? i.id : null;
      const status = i.status === "triggered" || i.status === "acknowledged" ? i.status : null;
      const title = boundedText(i.title, 512);
      if (!id || !status || !title) return [];
      const service = isRecord(i.service) ? boundedText(i.service.summary, 200) : null;
      return [{ id, number: Number.isSafeInteger(i.incident_number) ? (i.incident_number as number) : null, title, status, urgency: i.urgency === "high" || i.urgency === "low" ? i.urgency : null, service, createdAt: isoTime(i.created_at), url: providerLink(i.html_url, "pagerduty.com") }];
    });
  }
}

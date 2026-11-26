import "server-only";
import { boundedText, getJson, isoTime, isRecord } from "../readOnlyHttp";

/**
 * Opsgenie read-only client: open alerts. Used like PagerDuty incidents, as deployment-time context.
 * Never creates, acknowledges, closes or escalates. A read-only API key (GenieKey) is enough.
 * Live acceptance with a real account is pending.
 */
export type OpsgenieCredential = { apiKey: string; region?: "us" | "eu" };
export interface OpsgenieAlert { id: string; tinyId: string | null; message: string; priority: "P1" | "P2" | "P3" | "P4" | "P5" | null; acknowledged: boolean; tags: string[]; createdAt: string | null }
const PRIORITY = new Set(["P1", "P2", "P3", "P4", "P5"]);
const TAG = /^[A-Za-z0-9_.:\/-]{1,64}$/;

export class OpsgenieReadClient {
  private readonly host: string;
  constructor(private readonly credential: OpsgenieCredential) {
    if (!/^[0-9a-f-]{20,64}$/i.test(credential.apiKey)) throw new Error("opsgenie_api_key_invalid");
    this.host = credential.region === "eu" ? "https://api.eu.opsgenie.com" : "https://api.opsgenie.com";
  }

  async listOpenAlerts(tag?: string): Promise<OpsgenieAlert[]> {
    if (tag !== undefined && !TAG.test(tag)) throw new Error("opsgenie_tag_invalid");
    const query = tag ? `status:open AND tag:"${tag}"` : "status:open";
    const body = await getJson(`${this.host}/v2/alerts?${new URLSearchParams({ query, limit: "100", sort: "createdAt", order: "desc" })}`, { authorization: `GenieKey ${this.credential.apiKey}` }, "opsgenie");
    if (!isRecord(body) || !Array.isArray(body.data) || body.data.length > 100) throw new Error("opsgenie_response_invalid");
    return body.data.filter(isRecord).flatMap((a) => {
      const id = boundedText(a.id, 64), message = boundedText(a.message, 512);
      if (!id || !/^[A-Za-z0-9-]+$/.test(id) || !message) return [];
      return [{ id, tinyId: boundedText(a.tinyId, 16), message, priority: PRIORITY.has(a.priority as string) ? (a.priority as OpsgenieAlert["priority"]) : null, acknowledged: a.acknowledged === true, tags: Array.isArray(a.tags) ? a.tags.filter((t): t is string => typeof t === "string" && TAG.test(t)).slice(0, 20) : [], createdAt: isoTime(a.createdAt) }];
    });
  }
}

import "server-only";
import { boundedText, getJson, isRecord } from "../readOnlyHttp";

/**
 * Datadog read-only client: monitor states for monitors carrying a tag (for example service:checkout),
 * so V19 can show whether a release's service is alerting. Never mutes, edits or resolves monitors.
 * Uses an API key plus an application key scoped to monitors_read. Live acceptance pending.
 */
export const DATADOG_SITES = ["datadoghq.com", "us3.datadoghq.com", "us5.datadoghq.com", "datadoghq.eu", "ap1.datadoghq.com", "ddog-gov.com"] as const;
export type DatadogSite = (typeof DATADOG_SITES)[number];
export type DatadogState = "OK" | "Alert" | "Warn" | "No Data" | "Unknown";
export interface DatadogMonitor { id: number; name: string; state: DatadogState; priority: number | null; tags: string[] }
const TAG = /^[A-Za-z0-9_.:\/-]{1,100}$/;
const STATES = new Set(["OK", "Alert", "Warn", "No Data"]);

export class DatadogReadClient {
  constructor(private readonly site: DatadogSite, private readonly apiKey: string, private readonly appKey: string) {
    if (!DATADOG_SITES.includes(site)) throw new Error("datadog_site_invalid");
    if (!/^[0-9a-f]{32}$/i.test(apiKey) || !/^[0-9a-f]{40}$/i.test(appKey)) throw new Error("datadog_keys_invalid");
  }

  async monitorsTagged(tag: string): Promise<DatadogMonitor[]> {
    if (!TAG.test(tag)) throw new Error("datadog_tag_invalid");
    const q = new URLSearchParams({ monitor_tags: tag, page_size: "100", page: "0" });
    const body = await getJson(`https://api.${this.site}/api/v1/monitor?${q}`, { "dd-api-key": this.apiKey, "dd-application-key": this.appKey }, "datadog");
    if (!Array.isArray(body) || body.length > 100) throw new Error("datadog_response_invalid");
    return body.filter(isRecord).flatMap((m) => {
      const name = boundedText(m.name, 300);
      if (typeof m.id !== "number" || !Number.isSafeInteger(m.id) || !name) return [];
      return [{ id: m.id, name, state: STATES.has(m.overall_state as string) ? (m.overall_state as DatadogState) : "Unknown", priority: typeof m.priority === "number" && m.priority >= 1 && m.priority <= 5 ? m.priority : null, tags: Array.isArray(m.tags) ? m.tags.filter((t): t is string => typeof t === "string" && TAG.test(t)).slice(0, 30) : [] }];
    });
  }
}

/** Plain summary for a release check: alerting monitors first. */
export function summarizeMonitors(monitors: readonly DatadogMonitor[]): { alerting: number; warning: number; ok: number; noData: number } {
  return { alerting: monitors.filter((m) => m.state === "Alert").length, warning: monitors.filter((m) => m.state === "Warn").length, ok: monitors.filter((m) => m.state === "OK").length, noData: monitors.filter((m) => m.state === "No Data" || m.state === "Unknown").length };
}

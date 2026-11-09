import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { unsafeAddress } from "@/lib/integrations/airflow/airflowClient";

/**
 * Prefect read-only inventory client (A8, first new Batches provider).
 *
 * Observation only. This client has NO method that creates, retries, cancels,
 * schedules or changes the state of anything. Prefect's filter endpoints use
 * POST, but they only read. Governed execution needs a separately reviewed
 * design and live acceptance before it is added. Never returns logs, results,
 * parameters, artifacts, variables, blocks or credentials.
 */

export type PrefectCredential = { authMode: "api_key"; apiKey: string };
export interface PrefectFlow { id: string; name: string; tags: string[] }
export interface PrefectFlowRun { id: string; flowId: string; name: string; stateType: string; stateName: string; startedAt: string | null; endedAt: string | null }
export interface PrefectTaskRun { id: string; flowRunId: string; taskKey: string; name: string; stateType: string; runCount: number; startedAt: string | null; endedAt: string | null }

export const PREFECT_PAGE_LIMIT = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATE_TYPES = new Set(["SCHEDULED", "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "CRASHED", "PAUSED", "CANCELLING"]);

/** Accepts Prefect Cloud (`/api/accounts/<id>/workspaces/<id>`) or a self-hosted `/api` base. Public HTTPS only. */
export async function validatePrefectApiUrl(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("prefect_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("prefect_https_url_required");
  const raw = value.match(/^https:\/\/[^\\/?#\s]+([^?#\s]*)$/i);
  if (!raw) throw new Error("prefect_api_url_invalid");
  const path = raw[1].replace(/\/$/, "");
  const cloud = path.match(/^\/api\/accounts\/([^/]+)\/workspaces\/([^/]+)$/);
  if (!(path === "/api" || (cloud && UUID.test(cloud[1]) && UUID.test(cloud[2])))) throw new Error("prefect_api_url_invalid");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("prefect_private_host_blocked");
  const allowlist = (process.env.PREFECT_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(hostname)) throw new Error("prefect_host_not_allowed");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => unsafeAddress(address))) throw new Error("prefect_private_host_blocked");
  return `${url.origin}${path}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const time = (v: unknown): string | null => (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : null);
const uuid = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v : null);
function state(run: Record<string, unknown>): { stateType: string; stateName: string } {
  const type = typeof run.state_type === "string" && STATE_TYPES.has(run.state_type) ? run.state_type : "UNKNOWN";
  return { stateType: type, stateName: str(run.state_name, 80) ?? type };
}
function list(body: unknown, code: string): Record<string, unknown>[] {
  if (!Array.isArray(body) || body.length > PREFECT_PAGE_LIMIT || !body.every(isRecord)) throw new Error(code);
  return body;
}
function uniqueIds<T extends { id: string }>(items: T[], code: string): T[] {
  if (new Set(items.map((i) => i.id)).size !== items.length) throw new Error(code);
  return items;
}

export class PrefectClient {
  constructor(private readonly apiUrl: string, private readonly credential: PrefectCredential) {}

  private async read(path: string, filter?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method: filter ? "POST" : "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json", authorization: `Bearer ${this.credential.apiKey}`, ...(filter ? { "content-type": "application/json" } : {}) },
      ...(filter ? { body: JSON.stringify(filter) } : {}),
    });
    if (!response.ok) throw new Error(`prefect_api_failed:${response.status}`);
    return response.json();
  }

  async validate(): Promise<{ healthy: boolean; flowCount: number }> {
    const [health, flows] = await Promise.all([this.read("/health"), this.read("/flows/filter", { limit: 1, offset: 0 })]);
    return { healthy: health === true, flowCount: list(flows, "prefect_flow_response_invalid").length };
  }

  async listFlows(offset = 0): Promise<PrefectFlow[]> {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("prefect_selection_invalid");
    const body = await this.read("/flows/filter", { limit: PREFECT_PAGE_LIMIT, offset, sort: "NAME_ASC" });
    return uniqueIds(list(body, "prefect_flow_response_invalid").map((f) => {
      const id = uuid(f.id); const name = str(f.name);
      if (!id || !name) throw new Error("prefect_flow_response_invalid");
      return { id, name, tags: Array.isArray(f.tags) ? f.tags.filter((t): t is string => typeof t === "string" && t.length <= 80).slice(0, 20) : [] };
    }), "prefect_flow_response_invalid");
  }

  async listFlowRuns(flowId: string): Promise<PrefectFlowRun[]> {
    if (!UUID.test(flowId)) throw new Error("prefect_selection_invalid");
    const body = await this.read("/flow_runs/filter", { flows: { id: { any_: [flowId] } }, limit: PREFECT_PAGE_LIMIT, offset: 0, sort: "START_TIME_DESC" });
    return uniqueIds(list(body, "prefect_run_response_invalid").map((r) => {
      const id = uuid(r.id); const name = str(r.name);
      // A response row for a different flow means the filter was not honoured: refuse the whole page.
      if (!id || !name || r.flow_id !== flowId) throw new Error("prefect_run_response_invalid");
      return { id, flowId, name, ...state(r), startedAt: time(r.start_time), endedAt: time(r.end_time) };
    }), "prefect_run_response_invalid");
  }

  async listTaskRuns(flowRunId: string): Promise<PrefectTaskRun[]> {
    if (!UUID.test(flowRunId)) throw new Error("prefect_selection_invalid");
    const body = await this.read("/task_runs/filter", { flow_runs: { id: { any_: [flowRunId] } }, limit: PREFECT_PAGE_LIMIT, offset: 0, sort: "EXPECTED_START_TIME_ASC" });
    return uniqueIds(list(body, "prefect_task_response_invalid").map((t) => {
      const id = uuid(t.id); const taskKey = str(t.task_key); const name = str(t.name);
      if (!id || !taskKey || !name || t.flow_run_id !== flowRunId || (t.run_count !== undefined && (!Number.isSafeInteger(t.run_count) || (t.run_count as number) < 0))) throw new Error("prefect_task_response_invalid");
      return { id, flowRunId, taskKey, name, ...state(t), runCount: (t.run_count as number | undefined) ?? 0, startedAt: time(t.start_time), endedAt: time(t.end_time) };
    }), "prefect_task_response_invalid");
  }
}

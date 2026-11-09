import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
import { PREFECT_PAGE_LIMIT, PrefectClient, validatePrefectApiUrl } from "../prefectClient";

const A = "11111111-1111-4111-8111-111111111111";
const W = "22222222-2222-4222-8222-222222222222";
const FLOW = "33333333-3333-4333-8333-333333333333";
const RUN = "44444444-4444-4444-8444-444444444444";
const TASK = "55555555-5555-4555-8555-555555555555";
const BASE = `https://api.prefect.cloud/api/accounts/${A}/workspaces/${W}`;
const client = () => new PrefectClient(BASE, { authMode: "api_key", apiKey: "fixture-key" });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Prefect API URL boundary", () => {
  it.each([BASE, `${BASE}/`, "https://prefect.example.com/api"])("accepts %s", async (url) => {
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8" }]);
    expect(await validatePrefectApiUrl(url)).toBe(url.replace(/\/$/, ""));
  });
  it.each(["http://prefect.example.com/api", "https://u:p@prefect.example.com/api", "https://prefect.example.com/api?x=1", "https://prefect.example.com/", "https://prefect.example.com/api/flows", `https://api.prefect.cloud/api/accounts/not-a-uuid/workspaces/${W}`, "https://prefect.example.com/api/../admin"])("rejects %s before DNS", async (url) => {
    await expect(validatePrefectApiUrl(url)).rejects.toThrow();
    expect(dns.lookup).not.toHaveBeenCalled();
  });
  it("blocks private hosts and honours the host allowlist", async () => {
    await expect(validatePrefectApiUrl("https://prefect.internal/api")).rejects.toThrow("prefect_private_host_blocked");
    dns.lookup.mockResolvedValue([{ address: "10.0.0.5" }]);
    await expect(validatePrefectApiUrl("https://prefect.example.com/api")).rejects.toThrow("prefect_private_host_blocked");
    vi.stubEnv("PREFECT_ALLOWED_HOSTS", "api.prefect.cloud");
    await expect(validatePrefectApiUrl("https://prefect.example.com/api")).rejects.toThrow("prefect_host_not_allowed");
  });
});

describe("Prefect read-only client", () => {
  it("exposes no mutation methods", () => {
    const methods = Object.getOwnPropertyNames(PrefectClient.prototype).filter((m) => m !== "constructor");
    expect(methods.sort()).toEqual(["listFlowRuns", "listFlows", "listTaskRuns", "read", "validate"]);
  });

  it("reads inside the API base with bearer auth, no redirects and a bounded filter", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url.startsWith(BASE)).toBe(true);
      expect(init.redirect).toBe("error");
      expect(init.headers.authorization).toBe("Bearer fixture-key");
      expect(JSON.parse(String(init.body)).limit).toBe(PREFECT_PAGE_LIMIT);
      return Response.json([{ id: FLOW, name: "nightly-etl", tags: ["prod", 3] }]);
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await client().listFlows()).toEqual([{ id: FLOW, name: "nightly-etl", tags: ["prod"] }]);
    expect(fetcher).toHaveBeenCalledWith(`${BASE}/flows/filter`, expect.objectContaining({ method: "POST" }));
  });

  it("maps runs and normalises unknown states", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: RUN, flow_id: FLOW, name: "brave-otter", state_type: "COMPLETED", state_name: "Completed", start_time: "2026-11-08T01:00:00Z", end_time: "2026-11-08T01:05:00Z" }, { id: TASK, flow_id: FLOW, name: "odd", state_type: "WEIRD" }])));
    const runs = await client().listFlowRuns(FLOW);
    expect(runs[0]).toMatchObject({ id: RUN, stateType: "COMPLETED", startedAt: "2026-11-08T01:00:00Z" });
    expect(runs[1]).toMatchObject({ stateType: "UNKNOWN", startedAt: null });
  });

  it("refuses a page containing another flow's run", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: RUN, flow_id: TASK, name: "x", state_type: "RUNNING" }])));
    await expect(client().listFlowRuns(FLOW)).rejects.toThrow("prefect_run_response_invalid");
  });

  it("refuses duplicate ids, oversize pages and bad selections", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: FLOW, name: "a" }, { id: FLOW, name: "b" }])));
    await expect(client().listFlows()).rejects.toThrow("prefect_flow_response_invalid");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(Array.from({ length: PREFECT_PAGE_LIMIT + 1 }, () => ({ id: FLOW, name: "a" })))));
    await expect(client().listFlows()).rejects.toThrow("prefect_flow_response_invalid");
    await expect(client().listFlowRuns("../flows")).rejects.toThrow("prefect_selection_invalid");
    await expect(client().listTaskRuns("nope")).rejects.toThrow("prefect_selection_invalid");
  });

  it("maps task runs for exactly the requested flow run", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: TASK, flow_run_id: RUN, task_key: "extract-1", name: "extract", state_type: "FAILED", run_count: 2 }])));
    expect(await client().listTaskRuns(RUN)).toEqual([{ id: TASK, flowRunId: RUN, taskKey: "extract-1", name: "extract", stateType: "FAILED", stateName: "FAILED", runCount: 2, startedAt: null, endedAt: null }]);
  });

  it("surfaces HTTP failures without the response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret detail", { status: 401 })));
    await expect(client().listFlows()).rejects.toThrow(/^prefect_api_failed:401$/);
  });
});

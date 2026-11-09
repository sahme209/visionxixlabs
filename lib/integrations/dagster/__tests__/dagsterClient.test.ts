import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
import { DAGSTER_PAGE_LIMIT, DAGSTER_QUERIES, DagsterClient, validateDagsterBaseUrl } from "../dagsterClient";

const BASE = "https://acme.dagster.cloud/prod";
const RUN = "44444444-4444-4444-8444-444444444444";
const RUN2 = "55555555-5555-4555-8555-555555555555";
const client = () => new DagsterClient(BASE, { authMode: "api_token", token: "fixture-token" });
const gql = (data: unknown) => vi.fn(async () => Response.json({ data }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Dagster base URL boundary", () => {
  it.each([BASE, `${BASE}/`, "https://dagster.example.com", "https://dagster.example.com/"])("accepts %s", async (url) => {
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8" }]);
    expect(await validateDagsterBaseUrl(url)).toBe(url.replace(/\/$/, ""));
  });
  it.each(["http://acme.dagster.cloud/prod", "https://u:p@acme.dagster.cloud/prod", "https://acme.dagster.cloud/prod?x", "https://acme.dagster.cloud/graphql", "https://acme.dagster.cloud/a/b", "https://acme.dagster.cloud/a/../b"])("rejects %s before DNS", async (url) => {
    await expect(validateDagsterBaseUrl(url)).rejects.toThrow();
    expect(dns.lookup).not.toHaveBeenCalled();
  });
  it("blocks private hosts and honours the allowlist", async () => {
    await expect(validateDagsterBaseUrl("https://dagster.internal")).rejects.toThrow("dagster_private_host_blocked");
    dns.lookup.mockResolvedValue([{ address: "192.168.1.4" }]);
    await expect(validateDagsterBaseUrl("https://dagster.example.com")).rejects.toThrow("dagster_private_host_blocked");
    vi.stubEnv("DAGSTER_ALLOWED_HOSTS", "acme.dagster.cloud");
    await expect(validateDagsterBaseUrl("https://dagster.example.com")).rejects.toThrow("dagster_host_not_allowed");
  });
});

describe("Dagster read-only client", () => {
  it("only ever sends fixed GraphQL queries, never mutations", () => {
    for (const q of Object.values(DAGSTER_QUERIES)) { expect(q.startsWith("query ")).toBe(true); expect(q).not.toMatch(/mutation|launch|terminate|wipe|reexecut/i); }
    expect(Object.getOwnPropertyNames(DagsterClient.prototype).filter((m) => m !== "constructor").sort()).toEqual(["listJobs", "listRuns", "query"]);
  });

  it("posts to /graphql with the API token header and no redirects", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url).toBe(`${BASE}/graphql`);
      expect(init.redirect).toBe("error");
      expect(init.headers["Dagster-Cloud-Api-Token"]).toBe("fixture-token");
      expect(JSON.parse(String(init.body)).query).toBe(DAGSTER_QUERIES.jobs);
      return Response.json({ data: { repositoriesOrError: { __typename: "RepositoryConnection", nodes: [{ name: "__repository__", location: { name: "etl" }, jobs: [{ name: "daily_load", description: "Loads", isJob: true }, { name: "__ASSET_JOB", isJob: true }, { name: "old_pipe", isJob: false }] }] } } });
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await client().listJobs()).toEqual([{ location: "etl", repository: "__repository__", name: "daily_load", description: "Loads" }]);
  });

  it("maps runs, converts epoch seconds and normalises unknown statuses", async () => {
    vi.stubGlobal("fetch", gql({ runsOrError: { __typename: "Runs", results: [{ runId: RUN, jobName: "daily_load", status: "SUCCESS", startTime: 1762560000, endTime: 1762560300 }, { runId: RUN2, jobName: "daily_load", status: "ODD", startTime: null }] } }));
    const runs = await client().listRuns("daily_load");
    expect(runs[0]).toEqual({ runId: RUN, jobName: "daily_load", status: "SUCCESS", startedAt: "2025-11-08T00:00:00.000Z", endedAt: "2025-11-08T00:05:00.000Z" });
    expect(runs[1]).toMatchObject({ status: "UNKNOWN", startedAt: null });
  });

  it("refuses runs for another job, duplicates, oversize pages and GraphQL errors", async () => {
    vi.stubGlobal("fetch", gql({ runsOrError: { __typename: "Runs", results: [{ runId: RUN, jobName: "other" }] } }));
    await expect(client().listRuns("daily_load")).rejects.toThrow("dagster_run_response_invalid");
    vi.stubGlobal("fetch", gql({ runsOrError: { __typename: "Runs", results: [{ runId: RUN, jobName: "daily_load" }, { runId: RUN, jobName: "daily_load" }] } }));
    await expect(client().listRuns("daily_load")).rejects.toThrow("dagster_run_response_invalid");
    vi.stubGlobal("fetch", gql({ runsOrError: { __typename: "Runs", results: Array.from({ length: DAGSTER_PAGE_LIMIT + 1 }, () => ({})) } }));
    await expect(client().listRuns("daily_load")).rejects.toThrow("dagster_run_response_invalid");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ errors: [{ message: "boom" }] })));
    await expect(client().listRuns("daily_load")).rejects.toThrow("dagster_response_invalid");
    await expect(client().listRuns("bad name!")).rejects.toThrow("dagster_selection_invalid");
  });

  it("surfaces HTTP failures without the body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret", { status: 403 })));
    await expect(client().listJobs()).rejects.toThrow(/^dagster_api_failed:403$/);
  });
});

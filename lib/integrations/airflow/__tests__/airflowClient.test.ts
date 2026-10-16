import { afterEach, describe, expect, it, vi } from "vitest";
import { AirflowClient } from "../airflowClient";

afterEach(() => vi.unstubAllGlobals());

describe("AirflowClient", () => {
  it("rejects an invalid explicit run identity before sending credentials", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(new AirflowClient("https://airflow.example.com", { authMode: "token", token: "fixture-token" }).triggerDag("daily", {}, "../other")).rejects.toThrow("invalid_airflow_run_id");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not turn a non-conflict failure into a successful run lookup", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 503 })); vi.stubGlobal("fetch", fetcher);
    await expect(new AirflowClient("https://airflow.example.com", { authMode: "token", token: "fixture-token" }).triggerDag("daily", {}, "axiom_schedule__fixture")).rejects.toThrow("airflow_api_failed:503");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("reuses the exact scheduled run after a conflict instead of creating a fresh identity", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ dag_run_id: "axiom_schedule__fixture", dag_id: "daily", state: "queued" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const client = new AirflowClient("https://airflow.example.com", { authMode: "token", token: "fixture-token" });
    const run = await client.triggerDag("daily", {}, "axiom_schedule__fixture");
    expect(run.dagRunId).toBe("axiom_schedule__fixture");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).dag_run_id).toBe("axiom_schedule__fixture");
    expect(fetcher.mock.calls[1][0]).toBe("https://airflow.example.com/api/v2/dags/daily/dagRuns/axiom_schedule__fixture");
    expect(fetcher.mock.calls.filter((call) => call[1].method === "POST")).toHaveLength(1);
  });

  it("does not accept an unrelated run returned during conflict reconciliation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}", { status: 409 })).mockResolvedValueOnce(new Response(JSON.stringify({ dag_run_id: "other", dag_id: "daily" }), { status: 200 })));
    await expect(new AirflowClient("https://airflow.example.com", { authMode: "token", token: "fixture-token" }).triggerDag("daily", {}, "axiom_schedule__fixture")).rejects.toThrow("airflow_run_conflict_unconfirmed");
  });
  it("mints a JWT then lists real DAG metadata without exposing credentials", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "short-lived-jwt" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ dags: [{ dag_id: "daily_import", display_name: "Daily import", is_paused: false, owners: ["data"], tags: [{ name: "release" }] }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const dags = await new AirflowClient("https://airflow.example.com", { authMode: "username_password", username: "axiom", password: "secret" }).listDags();
    expect(dags).toEqual([{ dagId: "daily_import", displayName: "Daily import", description: null, paused: false, owners: ["data"], tags: ["release"] }]);
    expect(fetcher.mock.calls[0][0]).toBe("https://airflow.example.com/auth/token");
    expect(fetcher.mock.calls[1][1].headers.authorization).toBe("Bearer short-lived-jwt");
  });

  it("creates an explicitly attributable DAG run", async () => {
    const fetcher = vi.fn().mockImplementation(async (_url, init) => Response.json({ dag_id: "deploy_batch", dag_run_id: JSON.parse(init.body).dag_run_id, state: "queued" }));
    vi.stubGlobal("fetch", fetcher);
    const run = await new AirflowClient("https://airflow.example.com", { authMode: "token", token: "gateway-token" }).triggerDag("deploy_batch", { release: "42" });
    expect(run.dagRunId).toBe(JSON.parse(fetcher.mock.calls[0][1].body).dag_run_id);
    expect(fetcher.mock.calls[0][0]).toBe("https://airflow.example.com/api/v2/dags/deploy_batch/dagRuns");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ conf: { release: "42" }, note: "Triggered by Axiom Agent" });
  });
});

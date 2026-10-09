import { afterEach, describe, expect, it, vi } from "vitest";
import { AirflowClient } from "../airflowClient";

afterEach(() => vi.unstubAllGlobals());

describe("AirflowClient", () => {
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
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ dag_run_id: "axiom-run", state: "queued" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const run = await new AirflowClient("https://airflow.example.com", { authMode: "token", token: "gateway-token" }).triggerDag("deploy_batch", { release: "42" });
    expect(run.dagRunId).toBe("axiom-run");
    expect(fetcher.mock.calls[0][0]).toBe("https://airflow.example.com/api/v2/dags/deploy_batch/dagRuns");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ conf: { release: "42" }, note: "Triggered by Axiom Agent" });
  });
});

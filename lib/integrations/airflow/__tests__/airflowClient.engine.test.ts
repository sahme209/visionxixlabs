import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { AirflowClient, validateAirflowBaseUrl } from "../airflowClient";
const fixtureFile = process.env.AXIOM_OWNED_AIRFLOW_FIXTURE;
type Fixture = { baseUrl: string; username: string; password: string; dagId: string; runId: string; version: string };
describe.skipIf(!fixtureFile)("AirflowClient actual owned Airflow engine", () => {
  let fixture: Fixture; let client: AirflowClient;
  beforeAll(async () => {
    if (!fixtureFile || !/^\/(?:private\/)?tmp\/axiom-airflow-engine-[^/]+\/fixture.json$/.test(fixtureFile)
        || realpathSync(fixtureFile) !== fixtureFile || (statSync(fixtureFile).mode & 0o077) !== 0
        || (process.getuid && statSync(fixtureFile).uid !== process.getuid())) throw new Error("owned_airflow_fixture_required");
    fixture = JSON.parse(readFileSync(fixtureFile, "utf8"));
    const url = new URL(fixture.baseUrl);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.pathname !== "/"
        || !/^axiom_owned_noop_[a-f0-9]{16}$/.test(fixture.dagId)
        || fixture.username !== "axiom_fixture" || fixture.version !== "3.3.2") throw new Error("owned_airflow_binding_required");
    client = new AirflowClient(fixture.baseUrl, { authMode: "username_password", username: fixture.username, password: fixture.password }, { beforeWrite: async () => {
      // Synthetic authority only for the verified private owned no-op fixture.
      if (!fixture || !/^axiom_owned_noop_[a-f0-9]{16}$/.test(fixture.dagId)) throw Error("owned_airflow_binding_required");
    } });
    expect(await client.validate()).toMatchObject({ version: fixture.version });
    const dag = (await client.listDags()).find(d => d.dagId === fixture.dagId);
    expect(dag?.tags).toContain("axiom_owned_fixture");
  });
  // The Python runner always stops its own processes, including on test failure.
  afterAll(() => { fixture = undefined as unknown as Fixture; });
  it("keeps the production private-origin block while accepting the explicit owned client fixture", async () => {
    await expect(validateAirflowBaseUrl(fixture.baseUrl)).rejects.toThrow("airflow_https_url_required");
    expect((await client.listDags()).find(d => d.dagId === fixture.dagId)).toMatchObject({ paused: false });
  });
  it("refuses an invalid credential against the real authentication endpoint", async () => {
    const invalid = new AirflowClient(fixture.baseUrl, { authMode: "username_password", username: fixture.username, password: "incorrect-owned-fixture-password" });
    await expect(invalid.validate()).rejects.toThrow("airflow_auth_failed:");
  });
  it("triggers only the owned no-op, observes actual task completion and confirms occurrence replay", async () => {
    expect(await client.triggerDag(fixture.dagId, { owned_fixture: true }, fixture.runId)).toMatchObject({ dagId: fixture.dagId, dagRunId: fixture.runId });
    const deadline = Date.now() + 120_000;
    let run = await client.getDagRun(fixture.dagId, fixture.runId);
    while (!["success", "failed"].includes(run.state) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      run = await client.getDagRun(fixture.dagId, fixture.runId);
    }
    expect(run.state).toBe("success");
    const tasks = await client.listTaskInstances(fixture.dagId, fixture.runId);
    expect(tasks.totalEntries).toBe(2); expect(tasks.tasks).toHaveLength(2);
    expect(tasks.tasks.every(t => t.state === "success")).toBe(true);
    expect(tasks.tasks.map(t => t.taskId).sort()).toEqual(["confirm_fixture", "read_fixture"]);
    expect(await client.triggerDag(fixture.dagId, { owned_fixture: true }, fixture.runId)).toMatchObject({ dagRunId: fixture.runId, state: "success" });
    expect((await client.listDagRuns(fixture.dagId)).filter(r => r.dagRunId === fixture.runId)).toHaveLength(1);
    await expect(client.getDagRun(fixture.dagId, "nonexistent_owned_fixture_run")).rejects.toThrow("airflow_api_failed:404");
  }, 150_000);
});

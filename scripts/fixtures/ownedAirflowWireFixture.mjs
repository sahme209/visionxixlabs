import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

export const AIRFLOW_FIXTURE_ORIGIN = "https://airflow.fixture.example.test";
export const AIRFLOW_FIXTURE_DAG = "axiom_fixture_batch";
export const AIRFLOW_FIXTURE_DEPENDENCY = "axiom_fixture_upstream";
export function airflowFixtureResponse(method, path, authorization, token, run) {
  assert.equal(method, "GET", "airflow_fixture_provider_writes_forbidden");
  assert.equal(authorization, `Bearer ${token}`, "synthetic_airflow_bearer_required");
  const url = new URL(path, AIRFLOW_FIXTURE_ORIGIN);
  if (url.pathname === "/api/v2/version") return { version: "3.0.6-synthetic-contract-fixture" };
  if (url.pathname === "/api/v2/dags") return { total_entries: 2, dags: [AIRFLOW_FIXTURE_DAG, AIRFLOW_FIXTURE_DEPENDENCY].map(dag_id => ({ dag_id, display_name: dag_id, is_paused: false, owners: ["synthetic-fixture"], tags: [] })) };
  for (const dagId of [AIRFLOW_FIXTURE_DAG, AIRFLOW_FIXTURE_DEPENDENCY]) {
    const body = { dag_id: dagId, dag_run_id: run.id, state: "success", logical_date: run.logicalDate, start_date: run.logicalDate, end_date: run.logicalDate };
    if (url.pathname === `/api/v2/dags/${dagId}/dagRuns`) return { dag_runs: [body], total_entries: 1 };
    if (url.pathname === `/api/v2/dags/${dagId}/dagRuns/${run.id}`) return body;
  }
  throw new Error("airflow_fixture_unknown_contract_request");
}
/** Started only inside the explicitly opted-in, parent-owned acceptance run. */
export async function startOwnedAirflowWireFixture() {
  const proof = randomBytes(16).toString("hex"), token = `synthetic-airflow-bearer-${randomBytes(16).toString("hex")}`;
  const ready = new Set(), calls = [];
  let run = { id: "synthetic-completed-run-1", logicalDate: new Date(Date.now() + 60_000).toISOString() }, violation = false;
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.headers["x-axiom-fixture-guard"], proof, "airflow_guard_stamp_required");
      if (request.url === "/__fixture_guard_ready") {
        assert.equal(request.method, "POST"); let body = "";
        for await (const chunk of request) { body += chunk; assert.ok(body.length < 1024); }
        const message = JSON.parse(body); assert.equal(message.kind, "builtin_http_guard_ready"); assert.ok(Number.isSafeInteger(message.pid));
        ready.add(String(message.pid)); response.writeHead(200).end("ok"); return;
      }
      assert.ok(ready.has(request.headers["x-axiom-fixture-process"]), "airflow_guard_ready_before_read_required");
      const body = airflowFixtureResponse(request.method, request.url, request.headers.authorization, token, run);
      calls.push({ method: request.method, path: new URL(request.url, AIRFLOW_FIXTURE_ORIGIN).pathname });
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
    } catch { violation = true; response.writeHead(400).end("airflow_fixture_contract_refused"); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, proof, token,
    encryptionSecret: `synthetic-airflow-key-${randomBytes(24).toString("hex")}`, cronSecret: `synthetic-airflow-cron-${randomBytes(24).toString("hex")}`,
    advanceRun() { run = { id: `synthetic-completed-run-${calls.length + 2}`, logicalDate: new Date(Date.now() + 60_000).toISOString() }; return run.id; },
    async waitUntilReady() { const deadline = Date.now() + 3000; while (!ready.size && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10)); assert.ok(ready.size, "owned_airflow_guard_not_ready"); assert.equal(violation, false); },
    report() { assert.equal(violation, false, "owned_airflow_protocol_violation"); return { requests: [...calls], guardedProcesses: ready.size, contract: "synthetic_Airflow3_GET_only", providerWrites: 0, realAirflow: false, universalNetworkIsolation: false }; },
    async close() {
      await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("owned_airflow_fixture_close_timeout")), 2000);
        server.close(error => { clearTimeout(timer); if (error && error.code !== "ERR_SERVER_NOT_RUNNING") reject(error); else resolve(); }); server.closeIdleConnections(); server.closeAllConnections(); });
    },
  };
}

import { afterEach, expect, it, vi } from "vitest";
import { AirflowClient } from "../airflowClient";
afterEach(() => vi.unstubAllGlobals());
const client = () => new AirflowClient("https://airflow.example.com", { authMode: "token", token: "fixture" });
const task = { dag_id: "daily", dag_run_id: "run", task_id: "extract", map_index: -1, try_number: 2, state: "failed", start_date: null, end_date: null, rendered_fields: { secret: "not returned" } };
it("reads a bounded task page and exposes no operator configuration", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ task_instances: [task], total_entries: 101 })); vi.stubGlobal("fetch", fetcher);
  expect(await client().listTaskInstances("daily", "run")).toEqual({ tasks: [{ taskId: "extract", mapIndex: -1, tryNumber: 2, state: "failed", startedAt: null, endedAt: null }], totalEntries: 101, offset: 0 });
  expect(fetcher.mock.calls[0][0]).toBe("https://airflow.example.com/api/v2/dags/daily/dagRuns/run/taskInstances?limit=100&offset=0");
});
it.each([{ dag_id: "other" }, { dag_run_id: "other" }, { task_id: "" }, { map_index: 0.5 }, { try_number: -1 }])("rejects mismatched or malformed task identity %j", async (override) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ task_instances: [{ ...task, ...override }], total_entries: 1 })));
  await expect(client().listTaskInstances("daily", "run")).rejects.toThrow("airflow_task_response_invalid");
});
it.each(["~", "", " "])("rejects wildcard or empty DAG/run selection %j before sending credentials", async (id) => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(client().listTaskInstances(id, "run")).rejects.toThrow("airflow_task_selection_invalid");
  await expect(client().listTaskInstances("daily", id)).rejects.toThrow("airflow_task_selection_invalid");
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects invalid pagination and inconsistent totals", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ task_instances: [task], total_entries: 0 })); vi.stubGlobal("fetch", fetcher);
  await expect(client().listTaskInstances("daily", "run", -1)).rejects.toThrow("airflow_task_selection_invalid");
  expect(fetcher).not.toHaveBeenCalled();
  await expect(client().listTaskInstances("daily", "run")).rejects.toThrow("airflow_task_response_invalid");
});

it("preserves mapped task instances and page offsets but rejects duplicate identities", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ task_instances: [task, { ...task, map_index: 0 }], total_entries: 102 })).mockResolvedValueOnce(Response.json({ task_instances: [task, task], total_entries: 2 }));
  vi.stubGlobal("fetch", fetcher);
  expect((await client().listTaskInstances("daily", "run", 100)).tasks).toHaveLength(2);
  expect(fetcher.mock.calls[0][0]).toContain("offset=100");
  await expect(client().listTaskInstances("daily", "run")).rejects.toThrow("airflow_task_response_invalid");
});

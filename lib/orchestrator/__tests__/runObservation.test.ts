import { afterEach, describe, expect, it, vi } from "vitest";
import { AirflowClient } from "@/lib/integrations/airflow/airflowClient";
import { CAPABILITY_PROFILES, ENGINE_KINDS, ORCHESTRATOR_SCHEMA } from "../contract";
import { compareRunObservations, type RunObservationBinding } from "../runObservation";

describe.each(ENGINE_KINDS)("%s bound run observations", engineKind => {
  const expected: RunObservationBinding = {
    schemaVersion: ORCHESTRATOR_SCHEMA, organizationId: "workspace-a", connectionId: "connection-a",
    connectionRevision: "rev-2", engineKind, profileVersion: CAPABILITY_PROFILES[engineKind].profileVersion,
    workflowId: "daily", runId: "run-7", sourceDigest: "a".repeat(64),
  };
  const terminal = { airflow: "success", prefect: "COMPLETED", dagster: "SUCCESS", argo_workflows: "Succeeded" }[engineKind];
  const saved = { ...expected, nativeState: terminal, observedAt: "2026-11-23T08:30:00.000Z", complete: true };

  it("normalizes only the exact requested run", () => {
    expect(compareRunObservations(expected, null, saved)).toEqual({ ok: true, disposition: "accepted", state: "succeeded" });
  });

  it.each([
    { organizationId: "foreign" }, { connectionId: "other" }, { connectionRevision: "rev-1" },
    { workflowId: "weekly" }, { runId: "run-6" }, { sourceDigest: "b".repeat(64) }, { profileVersion: "old" },
  ])("refuses mismatched receipt or saved history %j", mismatch => {
    expect(compareRunObservations(expected, null, { ...saved, ...mismatch })).toEqual({ ok: false, error: "scopeMismatch" });
    expect(compareRunObservations(expected, { ...saved, ...mismatch }, saved)).toEqual({ ok: false, error: "scopeMismatch" });
  });

  it("keeps the original state for duplicate, stale and conflicting observations", () => {
    const prior = (disposition: string) => ({ ok: true, disposition, state: "succeeded" });
    expect(compareRunObservations(expected, saved, saved)).toEqual(prior("duplicate"));
    expect(compareRunObservations(expected, saved, { ...saved, nativeState: "unrecognized", observedAt: "2026-11-23T08:29:00.000Z" })).toEqual(prior("stale"));
    expect(compareRunObservations(expected, saved, { ...saved, complete: false })).toEqual(prior("anomaly"));
    expect(compareRunObservations(expected, saved, { ...saved, nativeState: "unrecognized", observedAt: "2026-11-23T08:31:00.000Z" })).toEqual(prior("anomaly"));
  });

  it("does not establish or overwrite run state with incomplete receipts", () => {
    const running = { airflow: "running", prefect: "RUNNING", dagster: "STARTED", argo_workflows: "Running" }[engineKind];
    const priorRun = { ...saved, nativeState: running };
    const partial = { ...saved, complete: false, observedAt: "2026-11-23T08:31:00.000Z" };
    const verifiedRun = { ...priorRun, observedAt: "2026-11-23T08:32:00.000Z" };
    expect(compareRunObservations(expected, null, partial)).toEqual({ ok: true, disposition: "incomplete", state: "unknown" });
    expect(compareRunObservations(expected, priorRun, partial)).toEqual({ ok: true, disposition: "incomplete", state: "running" });
    expect(compareRunObservations(expected, saved, partial)).toEqual({ ok: true, disposition: "incomplete", state: "succeeded" });
    expect(compareRunObservations(expected, partial, partial)).toEqual({ ok: true, disposition: "duplicate", state: "unknown" });
    expect(compareRunObservations(expected, partial, saved)).toEqual({ ok: true, disposition: "stale", state: "unknown" });
    expect(compareRunObservations(expected, partial, verifiedRun)).toEqual({ ok: true, disposition: "accepted", state: "running" });
  });

  it("rejects malformed receipts and unregistered profile versions", () => {
    expect(compareRunObservations(expected, null, { ...saved, observedAt: "2026-02-30T08:30:00.000Z" })).toEqual({ ok: false, error: "receiptMismatch" });
    expect(compareRunObservations(expected, null, { ...saved, state: "succeeded" })).toEqual({ ok: false, error: "receiptMismatch" });
    expect(compareRunObservations({ ...expected, profileVersion: "unregistered" }, null, saved)).toEqual({ ok: false, error: "unsupported" });
  });
});

afterEach(() => vi.unstubAllGlobals());

it("accepts the exact Airflow GET and rejects a different native run before reconciliation", async () => {
  const expected: RunObservationBinding = {
    schemaVersion: ORCHESTRATOR_SCHEMA, engineKind: "airflow", profileVersion: CAPABILITY_PROFILES.airflow.profileVersion,
    organizationId: "workspace-a", connectionId: "airflow-a", connectionRevision: "rev-2",
    workflowId: "daily", runId: "run-7", sourceDigest: "c".repeat(64),
  };
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ dag_id: "daily", dag_run_id: "run-7", state: "success", logical_date: null }))
    .mockResolvedValueOnce(Response.json({ dag_id: "daily", dag_run_id: "run-6", state: "success", logical_date: null }));
  vi.stubGlobal("fetch", fetcher);
  const client = new AirflowClient("https://airflow.example.test", { authMode: "token", token: "fixture-only" });
  const run = await client.getDagRun(expected.workflowId, expected.runId);
  expect(run.logicalDate).toBeNull();
  const receipt = { ...expected, workflowId: run.dagId, runId: run.dagRunId, nativeState: run.state,
    observedAt: "2026-11-23T08:30:00.000Z", complete: true };
  expect(compareRunObservations(expected, null, receipt)).toEqual({ ok: true, disposition: "accepted", state: "succeeded" });
  await expect(client.getDagRun(expected.workflowId, expected.runId)).rejects.toThrow("airflow_run_response_invalid");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([, init]) => (init.method ?? "GET") === "GET")).toBe(true);
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readSavedPlans } from "../savedPlanRead";
import { parseSavedPlanBinding } from "../savedPlanArtifact";
import { binding, show, sealSavedPlan } from "./savedPlanFixtures";
import type { SavedPlanRecord } from "../savedPlanArtifact";

const storage = vi.hoisted(() => ({ readiness: vi.fn(), rows: vi.fn() }));
vi.mock("../savedPlanStore", () => ({ readSavedPlanStorageReadiness: storage.readiness, listSavedPlanRecords: storage.rows }));
let row: SavedPlanRecord;
const now = new Date("2026-10-16T12:30:00Z");
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-read-fixture-key-not-real-12345678");
  row = sealSavedPlan("artifact-fixture", parseSavedPlanBinding(binding()), Buffer.from("fixture"), JSON.stringify(show()));
  storage.readiness.mockResolvedValue("ready"); storage.rows.mockResolvedValue([row]);
});
afterEach(() => vi.unstubAllEnvs());
const db = (version = 1) => ({ $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: "request-fixture", organizationId: "org-fixture", version }]) });
const scope = { organizationId: "org-fixture", requestId: "request-fixture" };
it("returns only sanitized stored-byte evidence with approval and target authority unavailable", async () => {
  const result = await readSavedPlans(db(), scope, row.id, now);
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({ ok: true, data: { executionEnabled: false, producer: "unavailable", plans: [{ approval: "unavailable", currentTarget: "unavailable", summary: { counts: { create: 1 } } }] } });
  expect(JSON.stringify(result)).not.toMatch(/SENTINEL|encrypted|credential|stateLineage/);
});
it("lists only metadata and leaves full summary inspection to the bounded detail read", async () => {
  const result = await readSavedPlans(db(), scope, undefined, now);
  expect(result.status).toBe(200);
  expect(JSON.stringify(result.body)).not.toMatch(/summary|SENTINEL/);
});
it("checks parent tenant ownership before optional storage", async () => {
  const database = { $queryRawUnsafe: vi.fn().mockResolvedValue([]) };
  expect((await readSavedPlans(database, scope, undefined, now)).status).toBe(404);
  expect(storage.readiness).not.toHaveBeenCalled(); expect(storage.rows).not.toHaveBeenCalled();
});
it.each(["not_installed", "drift", "unavailable"])("never selects artifacts when storage is %s", async (state) => {
  storage.readiness.mockResolvedValue(state);
  expect((await readSavedPlans(db(), scope, undefined, now)).status).toBe(503);
  expect(storage.rows).not.toHaveBeenCalled();
});
it("rejects request revisions and corrupt content rather than returning stale summaries", async () => {
  expect((await readSavedPlans(db(2), scope, row.id, now)).status).toBe(409);
  storage.rows.mockResolvedValue([{ ...row, encryptedBinary: "v2.corrupt" }]);
  expect((await readSavedPlans(db(), scope, row.id, now)).status).toBe(409);
});
it("returns not found for missing detail and marks bounded metadata lists as truncated", async () => {
  storage.rows.mockResolvedValue([]);
  expect((await readSavedPlans(db(), scope, "unknown", now)).status).toBe(404);
  storage.rows.mockResolvedValue(Array.from({ length: 21 }, (_, i) => ({ ...row, id: `changed-id-${i}` })));
  const result = await readSavedPlans(db(), scope, undefined, now);
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({ data: { truncated: true, plans: expect.arrayContaining([expect.objectContaining({ inspection: "metadata_only" })]) } });
  if (result.body.ok) expect(result.body.data.plans).toHaveLength(20);
});

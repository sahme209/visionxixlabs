import { beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/integrations/batch/batchConnection", () => ({ loadBatchClient: io.load }));
import { BATCH_OBSERVATION_TOOLS, executeBatchObservationTool } from "../batchObservation";

const future = new Date(Date.now() + 3600_000);
function context(overrides: { device?: unknown; member?: unknown } = {}) {
  return {
    principal: { sessionId: "sess", userId: "user", organizationId: "org" },
    repo: {
      desktopSessionRecord: { findUnique: vi.fn().mockResolvedValue("device" in overrides ? overrides.device : { id: "sess", userId: "user", organizationId: "org", revokedAt: null, expiresAt: future }) },
      orgMembership: { findUnique: vi.fn().mockResolvedValue("member" in overrides ? overrides.member : { acceptedAt: new Date(), role: "read_only" }) },
    },
  } as never;
}
const conn = (id = "c1", t = 1, client: unknown = { listFlows: vi.fn().mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ id: String(i) }))) }) => ({ client, connectionId: id, connectionUpdatedAt: new Date(t) });

beforeEach(() => vi.clearAllMocks());

describe("batch observation tools", () => {
  it("are read-only by name", () => {
    for (const t of BATCH_OBSERVATION_TOOLS) expect(t).toMatch(/^(list|read)_/);
  });

  it("returns a bounded, labelled observation for a paired reader", async () => {
    io.load.mockResolvedValue(conn());
    const r = await executeBatchObservationTool("org", "list_prefect_flows", {}, context());
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.result).toMatchObject({ provider: "prefect", authority: "observation_only", truncated: true }); expect((r.result.items as unknown[]).length).toBe(20); }
  });

  it("requires a paired context for the same workspace", async () => {
    expect(await executeBatchObservationTool("org", "list_prefect_flows", {})).toEqual({ ok: false, error: "paired_batch_observation_required" });
    expect((await executeBatchObservationTool("other", "list_prefect_flows", {}, context())).ok).toBe(false);
    expect(io.load).not.toHaveBeenCalled();
  });

  it("rejects unexpected or invalid arguments", async () => {
    expect(await executeBatchObservationTool("org", "list_prefect_flows", { extra: "x" }, context())).toEqual({ ok: false, error: "invalid_batch_observation_args" });
    expect(await executeBatchObservationTool("org", "read_dagster_runs", {}, context())).toEqual({ ok: false, error: "invalid_batch_observation_args" });
    expect(await executeBatchObservationTool("org", "read_dagster_runs", { jobName: " x" }, context())).toEqual({ ok: false, error: "invalid_batch_observation_args" });
  });

  it("refuses revoked sessions and unaccepted members", async () => {
    io.load.mockResolvedValue(conn());
    expect((await executeBatchObservationTool("org", "list_prefect_flows", {}, context({ device: { id: "sess", userId: "user", organizationId: "org", revokedAt: new Date(), expiresAt: future } }))).ok).toBe(false);
    expect((await executeBatchObservationTool("org", "list_prefect_flows", {}, context({ member: { acceptedAt: null, role: "admin" } }))).ok).toBe(false);
  });

  it("discards results when the connection changed during the read", async () => {
    io.load.mockResolvedValueOnce(conn("c1", 1)).mockResolvedValueOnce(conn("c1", 2));
    expect(await executeBatchObservationTool("org", "list_prefect_flows", {}, context())).toEqual({ ok: false, error: "batch_observation_changed" });
  });

  it("collapses provider errors to one safe code", async () => {
    io.load.mockResolvedValue(conn("c1", 1, { listFlows: vi.fn().mockRejectedValue(new Error("prefect_api_failed:500 detail")) }));
    expect(await executeBatchObservationTool("org", "list_prefect_flows", {}, context())).toEqual({ ok: false, error: "batch_observation_unavailable" });
  });
});

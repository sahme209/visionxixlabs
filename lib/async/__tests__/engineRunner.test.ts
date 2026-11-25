import { GenerationNotDispatchedError } from "@/lib/ai/generationNotDispatched";
import { leadGenerationRecovery } from "../generationRecovery";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadEngineBusyError, runAsyncLeadEngine } from "../engineRunner";

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead: db } }));

function setup() {
  type Payload = Record<string, unknown>;
  let row = {
    id: "lead-1",
    source: "cloud-studio",
    status: "created",
    updatedAt: new Date(0),
    fullPayload: {} as Payload,
  };
  const edit = (data: Partial<typeof row>) => {
    row = { ...row, ...data, updatedAt: new Date(row.updatedAt.getTime() + 1) };
    return row;
  };
  const matches = (where: Omit<Partial<typeof row>, "fullPayload"> & {
    fullPayload?: { equals: unknown; path?: string[] };
  }) => {
    const engine = row.fullPayload.engine as { runId?: string } | undefined;
    const actualPayload = where.fullPayload?.path ? engine?.runId : row.fullPayload;
    return where.status === row.status &&
      (!where.updatedAt || where.updatedAt.getTime() === row.updatedAt.getTime()) &&
      (!where.fullPayload || JSON.stringify(where.fullPayload.equals) === JSON.stringify(actualPayload));
  };
  db.findUnique.mockImplementation(async () => row);
  db.updateMany.mockImplementation(async ({ where, data }) => {
    if (!matches(where)) return { count: 0 };
    edit(data);
    return { count: 1 };
  });
  db.update.mockImplementation(async ({ where, data }) => {
    if (!matches(where)) throw new Error("Lead changed");
    return edit(data);
  });
  const generate = vi.fn(async () => "report");
  const run = () => runAsyncLeadEngine({
    leadId: row.id,
    expectedSource: row.source,
    engineName: "cloud-studio",
    getTier: () => "free",
    generate,
    persist: ({ result }) => ({ output: result }),
    isReady: (payload) => typeof payload.output === "string",
    getExistingResult: (payload) => typeof payload.output === "string" ? payload.output : null,
  });
  return { run, generate, edit, current: () => row };
}

beforeEach(() => vi.resetAllMocks());

describe("lead generation claim", () => {
  it("admits one caller with a stale concurrent read and reuses its completed result", async () => {
    const { run, generate, edit, current } = setup();
    generate.mockImplementationOnce(async () => {
      edit({ fullPayload: { ...current().fullPayload, note: "saved during generation" } });
      return "report";
    });

    const results = await Promise.allSettled([run(), run()]);
    expect(results).toEqual([
      expect.objectContaining({ status: "fulfilled" }),
      { status: "rejected", reason: expect.any(LeadEngineBusyError) },
    ]);
    expect((await run()).generated).toBe("report");
    expect(current().fullPayload).toMatchObject({ note: "saved during generation", output: "report" });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("never retries an unresolved generating row on its own", async () => {
    const { run, generate, edit } = setup();
    edit({ status: "package_generating" });
    await expect(run()).rejects.toBeInstanceOf(LeadEngineBusyError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("releases its own claim when preflight proves the provider was never contacted", async () => {
    const { run, generate, current } = setup();
    generate.mockRejectedValueOnce(new GenerationNotDispatchedError("Provider not configured"));
    await expect(run()).rejects.toThrow("Provider not configured");
    expect(current()).toMatchObject({ status: "created", fullPayload: { outputStatus: "failed" } });
    expect((await run()).generated).toBe("report");
  });

  it("recovers a reserved run before dispatch, then records only one provider attempt", async () => {
    const { run, generate, edit, current } = setup();
    edit({ status: "package_generating", fullPayload: { engine: { runId: "reserved-run", dispatchState: "reserved" } } });
    expect(leadGenerationRecovery(current().status, current().fullPayload)).toEqual({ state: "reserved", retryAllowed: true });
    expect((await run()).generated).toBe("report");
    expect(generate).toHaveBeenCalledOnce();
    expect(current().fullPayload.engine).toMatchObject({ dispatchState: "completed" });
  });

  it("fences an old caller when a newer reservation wins before dispatch", async () => {
    const { run, generate, edit, current } = setup();
    const actualUpdate = db.updateMany.getMockImplementation()!;
    db.updateMany.mockImplementationOnce(async (args) => {
      const result = await actualUpdate(args);
      const engine = current().fullPayload.engine as object;
      edit({ fullPayload: { ...current().fullPayload, engine: { ...engine, runId: "newer-reservation" } } });
      return result;
    });
    await expect(run()).rejects.toBeInstanceOf(LeadEngineBusyError);
    expect(generate).not.toHaveBeenCalled();
    expect((current().fullPayload.engine as { runId: string }).runId).toBe("newer-reservation");
  });

  it("holds an unconfirmed provider failure without exposing its error text", async () => {
    const { run, generate, current } = setup();
    generate.mockRejectedValueOnce(new Error("provider connection timed out"));
    await expect(run()).rejects.toThrow("provider connection timed out");
    expect(current()).toMatchObject({ status: "package_generating", fullPayload: { outputStatus: "failed" } });
    expect(leadGenerationRecovery(current().status, current().fullPayload)).toEqual({ state: "outcome_unconfirmed", retryAllowed: false });
    expect(JSON.stringify(current().fullPayload)).not.toContain("provider connection timed out");
    await expect(run()).rejects.toBeInstanceOf(LeadEngineBusyError);
    expect(generate).toHaveBeenCalledOnce();
  });

  it("treats dispatch-started as potentially active even if the row is old", async () => {
    const { run, generate, edit, current } = setup();
    edit({ status: "package_generating", fullPayload: { engine: { runId: "started-run", dispatchState: "started" } } });
    expect(leadGenerationRecovery(current().status, current().fullPayload)).toEqual({ state: "dispatch_started", retryAllowed: false });
    await expect(run()).rejects.toThrow("Generation has started");
    expect(generate).not.toHaveBeenCalled();
  });

  it("recovers a staged report after the final write fails and preserves intervening metadata", async () => {
    const { run, generate, edit, current } = setup();
    db.update.mockRejectedValueOnce(new Error("database write interrupted"));
    await expect(run()).rejects.toThrow("database write interrupted");
    expect(leadGenerationRecovery(current().status, current().fullPayload)).toEqual({ state: "result_staged", retryAllowed: false });
    expect(current().fullPayload.output).toBeUndefined();

    edit({ fullPayload: { ...current().fullPayload, note: "changed while interrupted" } });
    await expect(run()).resolves.toMatchObject({ generated: "report", reused: true });
    expect(generate).toHaveBeenCalledOnce();
    expect(current().fullPayload).toMatchObject({
      note: "changed while interrupted", output: "report", engine: { stagedResult: null },
    });
  });

  it("does not publish a staged result when report inputs have changed", async () => {
    const { run, generate, edit, current } = setup();
    db.update.mockRejectedValueOnce(new Error("database write interrupted"));
    await expect(run()).rejects.toThrow("database write interrupted");
    edit({ fullPayload: { ...current().fullPayload, form: { cloudProvider: "different" } } });
    await expect(run()).rejects.toBeInstanceOf(LeadEngineBusyError);
    expect(current().fullPayload.output).toBeUndefined();
    expect(generate).toHaveBeenCalledOnce();
  });

  it("uses the committed report when the final write acknowledgement is lost", async () => {
    const { run, generate, current } = setup();
    const finalize = db.update.getMockImplementation()!;
    db.update.mockImplementationOnce(async (args) => {
      await finalize(args);
      throw new Error("lost acknowledgement");
    });
    await expect(run()).resolves.toMatchObject({ generated: "report", reused: true });
    expect(current().status).toBe("package_ready");
    expect(generate).toHaveBeenCalledOnce();
  });

  it("cannot overwrite a newer claim even if the lead is still generating", async () => {
    const { run, generate, edit } = setup();
    generate.mockImplementationOnce(async () => {
      edit({ fullPayload: { engine: { runId: "different-run" } } });
      return "report";
    });
    await expect(run()).rejects.toBeInstanceOf(LeadEngineBusyError);
    expect(db.update).not.toHaveBeenCalled();
  });
});

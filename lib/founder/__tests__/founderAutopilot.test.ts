// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), txFind: vi.fn(), create: vi.fn(), updateMany: vi.fn(), revision: vi.fn(), signals: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../founderSignals", () => ({ readFounderSignals: m.signals }));
vi.mock("@/lib/db", () => {
  const tx = { founderBlueprint: { findUnique: m.txFind, create: m.create, updateMany: m.updateMany }, founderBlueprintRevision: { create: m.revision } };
  return { prisma: { founderBlueprint: { findUnique: m.find }, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
import { runFounderAutopilot } from "../founderAutopilot";
import { DEFAULT_BLUEPRINT } from "../defaultBlueprint";
beforeEach(() => { vi.clearAllMocks(); m.find.mockResolvedValue({ document: DEFAULT_BLUEPRINT, version: 5 }); m.txFind.mockResolvedValue({ version: 5 }); m.updateMany.mockResolvedValue({ count: 1 }); m.signals.mockResolvedValue({ leads_30d: 2 }); });

describe("runFounderAutopilot", () => {
  it("saves its changes as the next version, as the autopilot", async () => {
    const run = await runFounderAutopilot(new Date("2026-11-27T12:00:00Z"));
    expect(run).toMatchObject({ outcome: "applied", version: 6 });
    expect(m.updateMany.mock.calls[0][0]).toMatchObject({ where: { version: 5 }, data: { version: 6, updatedByEmail: "autopilot@v19" } });
    expect(m.revision.mock.calls[0][0].data).toMatchObject({ version: 6, summary: "Autopilot: marked 1 step live.", savedByEmail: "autopilot@v19" });
  });
  it("saves nothing when there is nothing to do, when paused, or when the map changed meanwhile", async () => {
    m.signals.mockResolvedValue({});
    expect((await runFounderAutopilot()).outcome).toBe("nothing_to_do");
    m.find.mockResolvedValue({ document: { ...DEFAULT_BLUEPRINT, autopilot: { paused: true } }, version: 5 });
    expect((await runFounderAutopilot()).outcome).toBe("paused");
    expect(m.signals).toHaveBeenCalledTimes(1);
    m.find.mockResolvedValue({ document: DEFAULT_BLUEPRINT, version: 5 }); m.signals.mockResolvedValue({ leads_30d: 2 }); m.txFind.mockResolvedValue({ version: 6 });
    expect((await runFounderAutopilot()).outcome).toBe("changed_meanwhile");
    expect(m.revision).not.toHaveBeenCalled();
  });
  it("refuses to overwrite a stored map it cannot read", async () => {
    m.find.mockResolvedValue({ document: { kind: "nope" }, version: 5 });
    expect((await runFounderAutopilot()).outcome).toBe("unreadable");
    expect(m.updateMany).not.toHaveBeenCalled();
  });
});

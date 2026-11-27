// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ founder: vi.fn(), sameOrigin: true, find: vi.fn(), txFind: vi.fn(), create: vi.fn(), updateMany: vi.fn(), revision: vi.fn(), signals: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/founder/founderAccess", () => ({ founderContext: m.founder }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/founder/founderSignals", () => ({ readFounderSignals: m.signals }));
vi.mock("@/lib/db", () => {
  const tx = { founderBlueprint: { findUnique: m.txFind, create: m.create, updateMany: m.updateMany }, founderBlueprintRevision: { create: m.revision } };
  return { prisma: { founderBlueprint: { findUnique: m.find }, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
import { GET, PUT } from "../route";
import { DEFAULT_BLUEPRINT } from "@/lib/founder/defaultBlueprint";
const put = (body: unknown) => PUT(new NextRequest("http://localhost/api/founder/blueprint", { method: "PUT", body: JSON.stringify(body) }));
beforeEach(() => { vi.clearAllMocks(); m.sameOrigin = true; m.founder.mockResolvedValue({ email: "founder@example.test" }); m.signals.mockResolvedValue({ incidents_open: 0 }); m.find.mockResolvedValue(null); m.txFind.mockResolvedValue(null); m.updateMany.mockResolvedValue({ count: 1 }); });

describe("/api/founder/blueprint", () => {
  it("is invisible to anyone who is not the founder", async () => {
    m.founder.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
    expect((await put({ blueprint: DEFAULT_BLUEPRINT, expectedVersion: 0, summary: "x" })).status).toBe(404);
    expect(m.find).not.toHaveBeenCalled();
  });
  it("serves the default draft with live signals until a version is saved", async () => {
    const body = await (await GET()).json();
    expect(body.data).toMatchObject({ version: 0, saved: false, signals: { incidents_open: 0 } });
    expect(body.data.blueprint.departments.length).toBe(DEFAULT_BLUEPRINT.departments.length);
  });
  it("saves the first version and keeps a revision", async () => {
    const res = await put({ blueprint: DEFAULT_BLUEPRINT, expectedVersion: 0, summary: "First save" });
    expect((await res.json()).data.version).toBe(1);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ id: "company", version: 1, updatedByEmail: "founder@example.test" });
    expect(m.revision.mock.calls[0][0].data).toMatchObject({ version: 1, summary: "First save" });
  });
  it("refuses a stale version, an invalid map and cross-origin calls", async () => {
    m.txFind.mockResolvedValue({ version: 3 });
    expect((await put({ blueprint: DEFAULT_BLUEPRINT, expectedVersion: 2, summary: "x" })).status).toBe(409);
    const bad = await put({ blueprint: { ...DEFAULT_BLUEPRINT, links: [{ from: "a", to: "b", label: "" }] }, expectedVersion: 3, summary: "x" });
    expect(bad.status).toBe(422);
    m.sameOrigin = false;
    expect((await put({ blueprint: DEFAULT_BLUEPRINT, expectedVersion: 3, summary: "x" })).status).toBe(403);
  });
});

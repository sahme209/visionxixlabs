// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ founder: vi.fn(), sameOrigin: true, run: vi.fn(), find: vi.fn(), revisions: vi.fn(), txFind: vi.fn(), create: vi.fn(), updateMany: vi.fn(), revision: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/founder/founderAccess", () => ({ founderContext: m.founder }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/founder/founderAutopilot", () => ({ runFounderAutopilot: m.run }));
vi.mock("@/lib/db", () => {
  const tx = { founderBlueprint: { findUnique: m.txFind, create: m.create, updateMany: m.updateMany }, founderBlueprintRevision: { create: m.revision } };
  return { prisma: { founderBlueprint: { findUnique: m.find }, founderBlueprintRevision: { findMany: m.revisions }, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
import { GET, PATCH, POST } from "../route";
import { DEFAULT_BLUEPRINT } from "@/lib/founder/defaultBlueprint";
const req = (method: string, body?: unknown) => new NextRequest("http://localhost/api/founder/autopilot", { method, body: body === undefined ? undefined : JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); m.sameOrigin = true; m.founder.mockResolvedValue({ email: "f@x.test" }); m.find.mockResolvedValue(null); m.revisions.mockResolvedValue([]); m.txFind.mockResolvedValue({ document: DEFAULT_BLUEPRINT, version: 3 }); m.updateMany.mockResolvedValue({ count: 1 }); });

describe("/api/founder/autopilot", () => {
  it("is invisible to anyone who is not the founder", async () => {
    m.founder.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
    expect((await POST(req("POST"))).status).toBe(404);
    expect((await PATCH(req("PATCH", { paused: true, expectedVersion: 3 }))).status).toBe(404);
    expect(m.run).not.toHaveBeenCalled();
  });
  it("refuses cross-origin runs and changes", async () => {
    m.sameOrigin = false;
    expect((await POST(req("POST"))).status).toBe(403);
    expect((await PATCH(req("PATCH", { paused: true, expectedVersion: 3 }))).status).toBe(403);
  });
  it("lists only the autopilot's own changes", async () => {
    m.revisions.mockResolvedValue([{ version: 2, summary: "Autopilot: marked 1 step live.", createdAt: new Date() }]);
    const body = await (await GET()).json();
    expect(body.data.paused).toBe(false);
    expect(m.revisions.mock.calls[0][0].where).toMatchObject({ savedByEmail: "autopilot@v19" });
  });
  it("runs once on request", async () => {
    m.run.mockResolvedValue({ outcome: "nothing_to_do", version: 3, actions: [], proposals: [] });
    expect((await (await POST(req("POST"))).json()).data.outcome).toBe("nothing_to_do");
    expect(m.run).toHaveBeenCalledTimes(1);
  });
  it("pauses with compare-and-set and records a revision", async () => {
    const res = await PATCH(req("PATCH", { paused: true, expectedVersion: 3 }));
    expect(res.status).toBe(200);
    expect(m.updateMany.mock.calls[0][0]).toMatchObject({ where: { version: 3 }, data: { version: 4, document: { autopilot: { paused: true } } } });
    expect(m.revision.mock.calls[0][0].data).toMatchObject({ version: 4, summary: "Paused the autopilot.", savedByEmail: "f@x.test" });
  });
  it("refuses a pause against a stale version", async () => {
    expect((await PATCH(req("PATCH", { paused: true, expectedVersion: 2 }))).status).toBe(409);
    expect(m.updateMany).not.toHaveBeenCalled();
  });
});

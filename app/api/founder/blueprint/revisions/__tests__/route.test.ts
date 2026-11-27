// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_BLUEPRINT } from "@/lib/founder/defaultBlueprint";
const m = vi.hoisted(() => ({ founder: vi.fn(), sameOrigin: true, list: vi.fn(), find: vi.fn(), updateMany: vi.fn(), create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/founder/founderAccess", () => ({ founderContext: m.founder }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/db", () => {
  const tx = { founderBlueprintRevision: { findUnique: m.find, create: m.create }, founderBlueprint: { updateMany: m.updateMany } };
  return { prisma: { founderBlueprintRevision: { findMany: m.list }, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
import { GET, POST } from "../route";
const post = (b: unknown) => POST(new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(b) }));
beforeEach(() => { vi.clearAllMocks(); m.sameOrigin = true; m.founder.mockResolvedValue({ email: "founder@example.test" }); m.list.mockResolvedValue([{ version: 2, summary: "b" }]); m.find.mockResolvedValue({ document: DEFAULT_BLUEPRINT }); m.updateMany.mockResolvedValue({ count: 1 }); });

describe("/api/founder/blueprint/revisions", () => {
  it("lists versions for the founder only", async () => {
    expect((await (await GET()).json()).data.revisions).toHaveLength(1);
    m.founder.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });
  it("restores an earlier version as a new version", async () => {
    const res = await post({ version: 1, expectedVersion: 3 });
    expect((await res.json()).data.version).toBe(4);
    expect(m.updateMany.mock.calls[0][0].where).toEqual({ id: "company", version: 3 });
    expect(m.create.mock.calls[0][0].data).toMatchObject({ version: 4, summary: "Restored version 1" });
  });
  it("refuses a stale version, a missing revision and cross-origin calls", async () => {
    m.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await post({ version: 1, expectedVersion: 3 })).status).toBe(409);
    m.find.mockResolvedValueOnce(null);
    expect((await post({ version: 9, expectedVersion: 3 })).status).toBe(404);
    m.sameOrigin = false;
    expect((await post({ version: 1, expectedVersion: 3 })).status).toBe(403);
  });
});

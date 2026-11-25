import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { adminGenerationRevision } from "@/lib/async/adminGenerationIntent";

const io = vi.hoisted(() => ({
  findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(),
  token: vi.fn(), generate: vi.fn(), admin: vi.fn(), rate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead: io } }));
vi.mock("@/lib/websiteStarter/engine", () => ({ generateWebsiteStarter: io.generate }));
vi.mock("@/lib/leads/starterToken", () => ({ verifyStarterToken: io.token }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: io.rate }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: io.admin }));

import { POST as signed } from "../[id]/starter/generate/route";
import { POST as admin } from "@/app/api/admin/leads/[id]/starter/route";

const form = {
  fullName: "Sample Customer", email: "sample@example.test", industry: "technology",
  projectType: "new_website", numberOfPages: 4, projectGoals: ["informational"],
};
const pkg = { heroHeadline: "A real result fixture", siteStructure: { pages: [] } };
const key = "229e0391-85ce-4f5e-b342-5216a22e0001";
const params = { params: Promise.resolve({ id: "legacy" }) };
function fixture(source = "website-request", payload: Record<string, unknown> = form) {
  let row = { id: "legacy", status: "published", source, updatedAt: new Date(0), fullPayload: payload };
  const save = (data: Partial<typeof row>) => {
    row = { ...row, ...data, updatedAt: new Date(row.updatedAt.getTime() + 1) };
    return row;
  };
  const matches = (where: { fullPayload?: { equals: unknown }; status?: string }) =>
    where.status === row.status &&
    JSON.stringify(where.fullPayload?.equals) === JSON.stringify(row.fullPayload);
  io.findUnique.mockImplementation(async () => row);
  io.updateMany.mockImplementation(async ({ where, data }) => {
    if (!matches(where)) return { count: 0 };
    save(data);
    return { count: 1 };
  });
  io.update.mockImplementation(async ({ where, data }) => {
    if (!matches(where)) throw Error("changed fixture");
    return save(data);
  });
  return () => row;
}
const signedRequest = () => new NextRequest("https://example.test/api/leads/legacy/starter/generate?token=signed", { method: "POST" });
const adminRequest = (revision: string) => new NextRequest("https://example.test/api/admin/leads/legacy/starter", {
  method: "POST", headers: { "idempotency-key": key, "x-v19-lead-revision": revision },
});

beforeEach(() => {
  vi.resetAllMocks();
  io.token.mockReturnValue({ leadId: "legacy" });
  io.rate.mockReturnValue(true);
  io.admin.mockResolvedValue({ user: { uid: "synthetic-admin" } });
  io.generate.mockResolvedValue(pkg);
});
afterEach(() => vi.unstubAllEnvs());

it("keeps signed generation bound to one lead and one valid legacy brief", async () => {
  io.token.mockReturnValueOnce({ leadId: "other" });
  expect((await signed(signedRequest(), params)).status).toBe(401);
  expect(io.findUnique).not.toHaveBeenCalled();
  fixture("cloud-operator");
  expect((await signed(signedRequest(), params)).status).toBe(404);
  fixture("website-request", { form: { email: "current-flow@example.test" } });
  expect((await signed(signedRequest(), params)).status).toBe(422);
  expect(io.generate).not.toHaveBeenCalled();
});

it("dispatches one authorized generation across concurrent signed calls and preserves preview state", async () => {
  const current = fixture("website-request", {
    ...form, engine: { outputStatus: "ready" }, outputStatus: "ready",
    aiPackage: { companyName: "Existing preview" },
  });
  const responses = await Promise.all([signed(signedRequest(), params), signed(signedRequest(), params)]);
  expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
  expect(io.generate).toHaveBeenCalledOnce();
  expect(io.generate.mock.calls[0][2]).toMatchObject({ requestId: expect.stringMatching(/^lead_/) });
  expect(current()).toMatchObject({
    status: "published",
    fullPayload: {
      engine: { outputStatus: "ready" }, outputStatus: "ready",
      aiPackage: { companyName: "Existing preview" }, aiStarterPackage: pkg,
      starterEngine: { dispatchState: "completed" },
    },
  });
  expect(await (await signed(signedRequest(), params)).json()).toMatchObject({ alreadyPresent: true, aiStarterPackage: pkg });
  expect(io.generate).toHaveBeenCalledOnce();
});

it("returns the prior admin result for the same confirmed intent", async () => {
  const current = fixture("website-request", { ...form, aiStarterPackage: { heroHeadline: "Old" } });
  const revision = adminGenerationRevision(current());
  expect((await admin(adminRequest(revision), params)).status).toBe(200);
  const second = await admin(adminRequest(revision), params);
  expect(await second.json()).toMatchObject({ requestId: key, replayed: true, aiStarterPackage: pkg });
  expect(io.generate).toHaveBeenCalledOnce();
});

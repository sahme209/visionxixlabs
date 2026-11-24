import {NextRequest} from "next/server";
import {beforeEach, expect, it, vi} from "vitest";

const m = vi.hoisted(() => ({context: vi.fn(), release: vi.fn(), tickets: vi.fn()}));
vi.mock("@/lib/auth/currentContext", () => ({currentContext: m.context}));
vi.mock("@/lib/db", () => ({
  prisma: {
    release: {findUnique: m.release},
    releaseReadinessSnapshot: {findFirst: async () => null},
    cherryPickException: {findMany: async () => []},
    policyViolation: {findMany: async () => []},
    changeTicket: {findMany: m.tickets},
    releaseEvidencePack: {findUnique: async () => null},
  },
}));
import {GET} from "../route";

const account = {isAuthenticated: true, userId: "fixture-user", sessionUserId: "fixture-user", organizationId: "fixture-workspace", roles: ["read_only"]};
const release = {id: "fixture-release", organizationId: account.organizationId, applicationId: "fixture-application",
  releaseTag: "v2.14.0", status: "ready", createdAt: new Date("2026-11-17T12:00:00Z")};
const read = () => GET(new NextRequest("https://fixture.invalid/api/dashboard/release-detail/fixture-release"),
  {params: Promise.resolve({id: release.id})});

beforeEach(() => {
  vi.resetAllMocks();
  m.context.mockResolvedValue(account);
  m.release.mockResolvedValue(release);
  m.tickets.mockResolvedValue([{id: "fixture-ticket", externalKey: "CHG-2041", provider: "servicenow",
    title: "Fixture governed release", status: "approved"}]);
});

it("returns the exact authenticated release and scoped tickets without caching it", async () => {
  const reply = await read();
  expect(reply.status).toBe(200);
  expect(reply.headers.get("cache-control")).toBe("private, no-store");
  expect(m.tickets).toHaveBeenCalledWith({where: {organizationId: account.organizationId, linkedReleaseIds: {has: release.id}}});
  expect(await reply.json()).toMatchObject({ok: true, data: {release: {id: release.id, releaseTag: "v2.14.0"},
    changeTickets: {total: 1, items: [{externalKey: "CHG-2041"}]}}});
});

it("withholds details for a workspace that does not own the release", async () => {
  m.context.mockResolvedValue({...account, organizationId: "different-workspace"});
  const reply = await read();
  expect(reply.status).toBe(403);
  expect(await reply.json()).toEqual({ok: false, error: "cross_org_release"});
  expect(m.tickets).not.toHaveBeenCalled();
});

it("requires sign-in before reading any release", async () => {
  m.context.mockResolvedValue({isAuthenticated: false});
  expect((await read()).status).toBe(401);
  expect(m.release).not.toHaveBeenCalled();
});

it("withholds a completed read after the authenticated workspace changes", async () => {
  m.context.mockResolvedValueOnce(account).mockResolvedValueOnce({...account, organizationId: "replacement-workspace"});
  const reply = await read();
  expect(reply.status).toBe(403);
  expect(await reply.json()).toEqual({ok:false, error: "workspace_context_changed"});
  expect(reply.headers.get("cache-control")).toBe("private, no-store");
});

it.each([{ sessionUserId: undefined }, { roles: [] }])("requires a canonical account and accepted membership (%j)", async patch => {
  m.context.mockResolvedValue({ ...account, ...patch });
  expect((await read()).status).toBe(401);
  expect(m.release).not.toHaveBeenCalled();
});

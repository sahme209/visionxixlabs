import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), verify: vi.fn(), create: vi.fn(), revise: vi.fn(), parse: vi.fn(), list: vi.fn(), read: vi.fn(), members: vi.fn(), users: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { tauriPlaybook: { findMany: async () => [] }, orgMembership: { findMany: mocks.members }, user: { findMany: mocks.users } } }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.session }));
vi.mock("@/lib/tauri/intakeWorkflowSource", () => ({ verifyIntakeWorkflowSource: mocks.verify }));
vi.mock("@/lib/tauri/deploymentIntakeSchema", () => ({ parseDeploymentIntake: mocks.parse }));
vi.mock("@/lib/tauri/deploymentRequestRepo", () => ({ createDeploymentRequest: mocks.create, reviseDeploymentRequest: mocks.revise, listDeploymentRequests: mocks.list, getDeploymentRequest: mocks.read }));
import { GET, POST } from "@/app/api/desktop/deployments/route";
import { PUT } from "@/app/api/desktop/deployments/[id]/route";
const intake = { workflowSource: { blobSha: "a".repeat(40) }, tenantId: "tenant" };
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue({ organizationId: "tenant", userId: "actor" });
  mocks.parse.mockReturnValue({ ok: true, intake }); mocks.verify.mockResolvedValue(false);
});
const request = () => new NextRequest("https://example.test/api/desktop/deployments", { method: "POST", body: JSON.stringify({ expectedVersion: 1 }), headers: { "Content-Type": "application/json" } });
it.each(["create", "revise"])("blocks %s persistence when fresh workflow source verification fails", async mode => {
  const req = request(); const result = mode === "create" ? await POST(req) : await PUT(req, { params: Promise.resolve({ id: "request" }) });
  expect(result.status).toBe(409);
  expect(await result.json()).toMatchObject({ ok: false, error: "workflow_source_unverified" });
  expect(mocks.verify).toHaveBeenCalledWith("tenant", intake, req.signal);
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.revise).not.toHaveBeenCalled();
});
it.each(["create", "revise"])("requires a session before %s source reads", async mode => {
  mocks.session.mockResolvedValue(null); const req = request();
  const result = mode === "create" ? await POST(req) : await PUT(req, { params: Promise.resolve({ id: "request" }) });
  expect(result.status).toBe(401); expect(mocks.verify).not.toHaveBeenCalled();
});
it.each(["create", "revise"])("allows %s persistence only after successful verification", async mode => {
  mocks.verify.mockResolvedValue(true);
  const row = { id: "request", title: "release", status: "submitted", version: 2, correlationId: "correlation", submittedAt: new Date() };
  mocks.create.mockResolvedValue({ ok: true, request: row, replayed: false });
  mocks.revise.mockResolvedValue({ ok: true, request: row, changed: true });
  const req = request(); const result = mode === "create" ? await POST(req) : await PUT(req, { params: Promise.resolve({ id: "request" }) });
  expect(result.status).toBe(mode === "create" ? 201 : 200);
  const persist = mode === "create" ? mocks.create : mocks.revise;
  expect(persist).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "tenant", intake }));
  expect(mocks.verify.mock.invocationCallOrder[0]).toBeLessThan(persist.mock.invocationCallOrder[0]);
});

it("summarizes selected batch count without exposing connection or run identities", async () => {
 const airflowDependency={connectionId:'private-connection',connectionUpdatedAt:'2026-10-24T00:00:00.000Z',runs:[{dagId:'private-dag',dagRunId:'private-run',logicalDate:'2026-10-24T00:00:00Z'}]};
 mocks.list.mockResolvedValue([{id:'request',title:'release',version:1,status:'submitted',correlationId:'c',submittedAt:null,closedAt:null,updatedAt:new Date(),intakeJson:{airflowDependency}}]);
 const response=await GET(new NextRequest('https://example.test/api'));const body=await response.json();
 expect(body.data[0].releaseContext.batches).toEqual({selectedRunCount:1});expect(JSON.stringify(body)).not.toContain('private-');
});

it.each([
  {credentialKind: "desktop_session", granted: false, exposed: false},
  {credentialKind: "desktop_session", granted: true, exposed: true},
  {credentialKind: "api_key", granted: true, exposed: false},
])("projects only safe release fact fields for $credentialKind with GitHub read $granted", async ({credentialKind, granted, exposed}) => {
  mocks.session.mockResolvedValue({organizationId: "tenant", credentialKind, capabilities: granted ? ["github:read"] : []});
  const intakeJson = {
    repositoryUrls: ["https://github.com/acme/payments.git", "https://github.com/ACME/PAYMENTS",
      "https://private-value@github.com/acme/internal", "https://github.com/acme/private?secret=123", "https://example.test/private"],
    workflowSource: {blobSha: "a".repeat(40)}, changeCreationMethod: "not_applicable", deploymentContact: "private-contact",
  };
  mocks.list.mockResolvedValue([{id: "release", title: "Release", version: 4, status: "draft", correlationId: "corr",
    submittedAt: null, closedAt: null, updatedAt: new Date(), intakeJson}]);
  const response = await GET(new NextRequest("https://example.test/api"));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.data[0].releaseContext.scope).toEqual({applicationCount: 0, repositoryCount: 5, targetEnvironment: null,
    changeNotApplicable: true, ...(exposed && {githubRepositories: ["acme/payments"]})});
  expect(JSON.stringify(body)).not.toMatch(/private|https:\/\/|aaaaaaaa/);
});

const exactRequest = (query = "savedReleaseId=older-release&savedReleaseVersion=4") =>
    new NextRequest(`https://example.test/api/desktop/deployments?${query}`);
const olderRelease = {
    id: "older-release", organizationId: "tenant", requesterUserId: "private-actor",
    title: "Older release", status: "submitted", version: 4, correlationId: "fixture",
    updatedAt: new Date("2026-11-17T00:00:00Z"), submittedAt: null, closedAt: null,
    intakeJson: { deploymentContact: "private-contact", repositoryUrls: ["https://github.com/acme/payments"] },
};

it("looks up an older exact release with the directory read scope and the redacted projection", async () => {
    mocks.read.mockResolvedValue(olderRelease);
    const result = await GET(exactRequest());
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    const {data} = await result.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "older-release", version: 4, releaseContext: {scope: {repositoryCount: 1}} });
    expect(JSON.stringify(data)).not.toMatch(/private-|github.com|githubRepositories|intakeJson/);
    expect(mocks.session).toHaveBeenCalledWith(expect.any(NextRequest), { requiredScope: "pipeline:read", route: "GET /api/desktop/deployments" });
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), "tenant", "older-release");
    expect(mocks.list).not.toHaveBeenCalled();
});

it.each([
    null,
    {...olderRelease, version: 5},
    {...olderRelease, organizationId: "another-workspace"},
    {...olderRelease, id: "different-release"},
])("returns an empty projection for a missing or mismatched exact release", async row => {
    mocks.read.mockResolvedValue(row);
    const result = await GET(exactRequest());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ok: true, data: []});
    expect(mocks.list).not.toHaveBeenCalled();
});

it.each(["savedReleaseId=older-release", "savedReleaseVersion=4", "savedReleaseId=older-release&savedReleaseVersion=04",
    "savedReleaseId=older-release&savedReleaseVersion=4&savedReleaseVersion=5"])("rejects invalid exact release parameters without a storage read", async query => {
    expect((await GET(exactRequest(query))).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
});

it("requires an authenticated read session before looking up an exact release", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(exactRequest())).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
});

it("returns only the owned current locator for an incident release outside the directory", async () => {
    mocks.read.mockResolvedValue(olderRelease);
    const result = await GET(exactRequest("linkedReleaseId=older-release"));
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.json()).toEqual({ok: true, data: {id: "older-release", version: 4}});
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(expect.anything(), "tenant", "older-release");
    expect(mocks.list).not.toHaveBeenCalled();
});

it.each([null, {...olderRelease, organizationId: "foreign-workspace"}, {...olderRelease, version: 0}])(
    "returns no current locator when the owned release cannot be verified",
    async row => {
        mocks.read.mockResolvedValue(row);
        expect(await (await GET(exactRequest("linkedReleaseId=older-release"))).json()).toEqual({ok: true, data: null});
    },
);

it.each(["linkedReleaseId=older-release&linkedReleaseId=second", "linkedReleaseId=older-release&savedReleaseVersion=4", "linkedReleaseId="])(
    "rejects malformed current locators without a release read",
    async query => {
        expect((await GET(exactRequest(query))).status).toBe(400);
        expect(mocks.read).not.toHaveBeenCalled();
        expect(mocks.list).not.toHaveBeenCalled();
    },
);

it("projects the accepted requester's display name for an opted-in, authorized exact release", async () => {
    mocks.session.mockResolvedValue({organizationId: "tenant", credentialKind: "desktop_session", capabilities: ["workspace:read"]});
    mocks.read.mockResolvedValue(olderRelease);
    mocks.members.mockResolvedValue([{userId: olderRelease.requesterUserId}]);
    mocks.users.mockResolvedValue([{id: olderRelease.requesterUserId, name: "  Fixture Requester  ", email: "test@example.test"}]);
    const legacy = await GET(exactRequest());
    expect((await legacy.json()).data[0]).not.toHaveProperty("requesterName");
    expect(mocks.members).not.toHaveBeenCalled();
    const response = await GET(exactRequest("savedReleaseId=older-release&savedReleaseVersion=4&includeRequester=1"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const {data} = await response.json();
    expect(data[0].requesterName).toBe("Fixture Requester");
    expect(JSON.stringify(data)).not.toMatch(/private-actor|example.test/);
    expect(mocks.members).toHaveBeenCalledExactlyOnceWith({
        where: {organizationId: "tenant", userId: {in: [olderRelease.requesterUserId]}, acceptedAt: {not: null}},
        select: {userId: true},
    });
    expect(mocks.users).toHaveBeenCalledExactlyOnceWith({
        where: {id: {in: [olderRelease.requesterUserId]}, name: {not: null}}, select: {id: true, name: true},
    });
});

it.each([
    ["paired without workspace read", "desktop_session", [], [], false],
    ["API key", "api_key", ["workspace:read"], [], false],
    ["removed requester", "desktop_session", ["workspace:read"], [], true],
    ["foreign workspace", "desktop_session", ["workspace:read"], [{userId: "private-actor"}], false],
] as const)("withholds the name for %s", async (mode, credentialKind, capabilities, members, resolvesMembership) => {
    mocks.session.mockResolvedValue({organizationId: "tenant", credentialKind, capabilities});
    mocks.read.mockResolvedValue(mode === "foreign workspace" ? {...olderRelease, organizationId: "foreign"} : olderRelease);
    mocks.members.mockResolvedValue(members);
    const response = await GET(exactRequest("savedReleaseId=older-release&savedReleaseVersion=4&includeRequester=1"));
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain("requesterName");
    expect(mocks.members).toHaveBeenCalledTimes(resolvesMembership ? 1 : 0);
    expect(mocks.users).not.toHaveBeenCalled();
});

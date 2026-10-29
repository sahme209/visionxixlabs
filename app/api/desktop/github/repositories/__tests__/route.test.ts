import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findFirst: vi.fn(),
  resolveGithubInstallationToken: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/db", () => ({ prisma: { gitHubInstallation: { findFirst: mocks.findFirst } } }));
vi.mock("@/lib/connectors/github/githubAppAuth", () => ({
  resolveGithubInstallationToken: mocks.resolveGithubInstallationToken,
}));

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const request = () => new NextRequest("https://visionxixlabs.com/api/desktop/github/repositories");

describe("GET /api/desktop/github/repositories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findFirst.mockResolvedValue({ githubInstallationId: "123" });
    mocks.resolveGithubInstallationToken.mockResolvedValue({ ok: true, token: "server-only-token" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("requires a verified desktop administrator session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("returns a clear disconnected state", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "github_not_connected" });
  });

  it("returns only normalized repository metadata and never the token", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: "Bearer server-only-token" });
      return new Response(JSON.stringify({
        total_count: 3,
        repositories: [
          { id: 2, name: "zeta", full_name: "acme/zeta", private: true, default_branch: "trunk", owner: { login: "acme" } },
          { id: 1, name: "alpha", full_name: "acme/alpha", private: false, default_branch: "main", owner: { login: "acme" } },
          { id: "invalid", name: "ignored" },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const { GET } = await import("../route");
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      repositories: [
        { id: "1", name: "alpha", fullName: "acme/alpha", owner: "acme", defaultBranch: "main", visibility: "public" },
        { id: "2", name: "zeta", fullName: "acme/zeta", owner: "acme", defaultBranch: "trunk", visibility: "private" },
      ],
      totalCount: 3,
      truncated: true,
    });
    expect(JSON.stringify(body)).not.toContain("server-only-token");
  });

  it("fails closed when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(503);
  });

  it("loads additional repository pages so normal workspaces are click-selectable", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: `repo-${index + 1}`,
      full_name: `acme/repo-${index + 1}`,
      private: true,
      default_branch: "main",
      owner: { login: "acme" },
    }));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ total_count: 101, repositories: firstPage }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ total_count: 101, repositories: [{
        id: 101, name: "last-repo", full_name: "acme/last-repo", private: false, default_branch: "trunk", owner: { login: "acme" },
      }] }), { status: 200 })));

    const { GET } = await import("../route");
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.repositories).toHaveLength(101);
    expect(body.data.repositories).toContainEqual(expect.objectContaining({ fullName: "acme/last-repo" }));
    expect(body.data.truncated).toBe(false);
  });
  it.each([null, {}, {repositories: null}, {repositories: [] , total_count: -1}, {repositories: [], total_count: "1"}])("refuses a malformed successful provider envelope %j", async payload => {
    vi.stubGlobal("fetch", vi.fn(async()=>Response.json(payload)));
    const {GET}=await import("../route");const response=await GET(request());
    expect(response.status).toBe(502);expect(await response.json()).toEqual({ok:false,error:"github_repositories_unavailable"});
  });
  it("preserves a genuine empty connected catalog", async()=>{vi.stubGlobal("fetch",vi.fn(async()=>Response.json({total_count:0,repositories:[]})));const {GET}=await import("../route");const response=await GET(request());expect(response.status).toBe(200);expect((await response.json()).data).toEqual({repositories:[],totalCount:0,truncated:false});});
  it("refuses malformed later pages rather than claiming a partial catalog succeeded",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(Response.json({total_count:101,repositories:[]})).mockResolvedValueOnce(Response.json({unexpected:true})));const {GET}=await import("../route");expect((await GET(request())).status).toBe(502);});
  it("bounds provider response bodies without returning provider or credential data",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>Response.json({repositories:[],padding:"x".repeat(2_000_001)})));const {GET}=await import("../route");const response=await GET(request());expect(response.status).toBe(502);expect(JSON.stringify(await response.json())).not.toContain("server-only-token");});

  it("refuses redirects without following another authenticated destination",async()=>{const redirected=Response.json({total_count:0,repositories:[]});Object.defineProperty(redirected,"redirected",{value:true});const fetcher=vi.fn(async(_url,init)=>{expect(init.redirect).toBe("error");return redirected;});vi.stubGlobal("fetch",fetcher);const {GET}=await import("../route");expect((await GET(request())).status).toBe(502);expect(fetcher).toHaveBeenCalledTimes(1);});
  it("cancels an unfinished provider body when the request is aborted",async()=>{const controller=new AbortController();let bodyCanceled=false;const response=new Response(new ReadableStream({cancel(){bodyCanceled=true;}}));const fetcher=vi.fn(async()=>response);vi.stubGlobal("fetch",fetcher);const {GET}=await import("../route");const pending=GET(new NextRequest("https://visionxixlabs.com/api/desktop/github/repositories",{signal:controller.signal}));await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());controller.abort();expect((await pending).status).toBe(502);expect(bodyCanceled).toBe(true);});
  it("filters invalid individual rows without crashing or exposing provider payloads",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>Response.json({total_count:3,repositories:[null,12,{id:1,name:"valid",full_name:"acme/valid",private:true,default_branch:"main",owner:{login:"acme"}}]})));const {GET}=await import("../route");const response=await GET(request());expect(response.status).toBe(200);expect((await response.json()).data).toMatchObject({repositories:[{id:"1",fullName:"acme/valid"}],truncated:true});});
  it("enforces the requested maximum page size",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>Response.json({repositories:Array.from({length:101},()=>({}))})));const {GET}=await import("../route");expect((await GET(request())).status).toBe(502);});

  it("cancels remaining page bodies after a malformed page",async()=>{let canceled=false;const waiting=new Response(new ReadableStream({cancel(){canceled=true;}}));vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(Response.json({total_count:201,repositories:[]})).mockResolvedValueOnce(Response.json({bad:true})).mockResolvedValueOnce(waiting));const {GET}=await import("../route");expect((await GET(request())).status).toBe(502);expect(canceled).toBe(true);});

  it("aborts outstanding page requests and cancels a late body after a sibling fetch fails",async()=>{let resolveLate!:(response:Response)=>void;let canceled=false;let lateSignal:AbortSignal|undefined;const late=new Promise<Response>(resolve=>{resolveLate=resolve;});const fetcher=vi.fn().mockResolvedValueOnce(Response.json({total_count:201,repositories:[]})).mockRejectedValueOnce(new Error("provider unavailable")).mockImplementationOnce((_url,init)=>{lateSignal=init.signal;return late;});vi.stubGlobal("fetch",fetcher);const {GET}=await import("../route");expect((await GET(request())).status).toBe(503);expect(lateSignal?.aborted).toBe(true);resolveLate(new Response(new ReadableStream({cancel(){canceled=true;}})));await vi.waitFor(()=>expect(canceled).toBe(true));});

});

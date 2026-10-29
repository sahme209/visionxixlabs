import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchRepoContext } from "../repoContextFetcher";
import { fetchFileContent, openPullRequest } from "../githubWriteClient";
const fetcher = vi.fn();
beforeEach(() => { vi.stubEnv("GITHUB_TOKEN", "synthetic_platform_token"); vi.stubGlobal("fetch", fetcher); fetcher.mockReset(); fetcher.mockResolvedValue(new Response("{}", { status: 403 })); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("repository reads never silently use the platform environment token", async () => {
 await fetchRepoContext("owned/repo", null);
 expect(fetcher).toHaveBeenCalled(); expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
});
it("a write without an explicitly supplied scoped token refuses before any GitHub request", async () => {
 const result = await openPullRequest({ owner: "owned", repo: "repo", baseBranch: "main", newBranch: "ai/fixture", files: [], commitMessage: "fixture", prTitle: "fixture", prBody: "fixture" } as never);
 expect(result).toMatchObject({ ok: false, reason: "no_token" }); expect(fetcher).not.toHaveBeenCalled();
});
it("file reads use the explicit scoped token and refuse redirect credential forwarding", async () => {
 fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ content: Buffer.from("fixture").toString("base64"), encoding: "base64" }), { status: 200 }));
 expect(await fetchFileContent("owned", "repo", "file.txt", "main", "synthetic_tenant_token")).toMatchObject({ ok: true, content: "fixture" });
 expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer synthetic_tenant_token" }, redirect: "error", credentials: "omit" });
});
it("refuses file reads without scoped authority before a network request", async () => {
 expect(await fetchFileContent("owned", "repo", "private.txt", "main")).toMatchObject({ ok: false }); expect(fetcher).not.toHaveBeenCalled();
});
it("carries only the supplied tenant token through a complete synthetic branch and PR transaction", async () => {
 const responses = [
  { object: { sha: "a".repeat(40) } }, { tree: { sha: "synthetic_base_tree" } }, {truncated:false,tree:[]},
  { sha: "synthetic_blob" }, { sha: "synthetic_tree" }, { sha: "synthetic_head" },
  { ref: "refs/heads/ai/fixture" }, { number: 12, html_url: "https://github.com/owned/repo/pull/12" },
 ];
 fetcher.mockImplementation(async () => new Response(JSON.stringify(responses.shift()), { status: 200 }));
 const result = await openPullRequest({ resolveToken: async () => ({ok:true,token:"synthetic_tenant_token"}), owner: "owned", repo: "repo", baseBranch: "main", expectedBaseSha: "a".repeat(40), newBranch: "ai/fixture", files: [{ path: "file.txt", content: "fixture" }], commitMessage: "fixture", prTitle: "fixture", prBody: "fixture" });
 expect(result).toMatchObject({ ok: true, prNumber: 12 }); expect(fetcher).toHaveBeenCalledTimes(8);
 for (const [url, options] of fetcher.mock.calls) {
  expect(url).toMatch(/^https:\/\/api\.github\.com\/repos\/owned\/repo\//);
  expect(options).toMatchObject({ headers: { Authorization: "Bearer synthetic_tenant_token" }, redirect: "error", credentials: "omit" });
 }
 expect(fetcher.mock.calls.some(([, options]) => JSON.stringify(options).includes("synthetic_platform_token"))).toBe(false);
});
it("reads a coherent repository snapshot even when the branch moves after HEAD discovery", async () => {
 const head = "a".repeat(40);
 fetcher.mockImplementation(async (url: string) => {
  const u = new URL(url);
  if (u.pathname === "/repos/owned/repo") return Response.json({default_branch:"main"});
  if (u.pathname === "/repos/owned/repo/branches/main") return Response.json({commit:{sha:head}});
  if (u.pathname.includes("/git/trees/")) return Response.json({tree:[{path:"README.md",type:"blob"}],truncated:false});
  if (u.pathname.endsWith("/commits")) return Response.json([{sha:u.searchParams.get("sha") === head ? head : "b".repeat(40)}]);
  if (u.pathname.includes("/contents/")) return Response.json({encoding:"base64",content:Buffer.from(u.searchParams.get("ref") === head ? "reviewed base" : "branch moved").toString("base64")});
  throw Error("unexpected synthetic route");
 });
 const result = await fetchRepoContext("owned/repo", "main", "synthetic_tenant_token");
 expect(result).toMatchObject({ok:true,snapshot:{headSha:head,keyFiles:[{path:"README.md",content:"reviewed base"}],recentCommits:[{sha:head}]}});
});
it.each(["main", "a".repeat(39), "a".repeat(40)+"/other", ""]) ("refuses an unverified branch commit identity %s before dependent reads", async sha => {
 fetcher.mockResolvedValueOnce(Response.json({default_branch:"main"})).mockResolvedValueOnce(Response.json({commit:{sha}}));
 expect(await fetchRepoContext("owned/repo", "main", "synthetic_tenant_token")).toMatchObject({ok:false,reason:"unexpected_response"});
 expect(fetcher).toHaveBeenCalledTimes(2);
});
it("refuses a moved base branch before any repository write", async () => {
 fetcher.mockResolvedValueOnce(Response.json({object:{sha:"b".repeat(40)}}));
 const result = await openPullRequest({resolveToken: async () => ({ok:true,token:"synthetic_tenant_token"}),owner:"owned",repo:"repo",baseBranch:"main",expectedBaseSha:"a".repeat(40),newBranch:"ai/fixture",files:[{path:"file.txt",content:"fixture"}],commitMessage:"fixture",prTitle:"fixture",prBody:"fixture"} as never);
 expect(result).toMatchObject({ok:false,reason:"base_changed"}); expect(fetcher).toHaveBeenCalledTimes(1);
});
it("requires a verified immutable base identity before any GitHub write workflow", async () => {
 const result = await openPullRequest({resolveToken: async () => ({ok:true,token:"synthetic_tenant_token"}),owner:"owned",repo:"repo",baseBranch:"main",newBranch:"ai/fixture",files:[],commitMessage:"fixture",prTitle:"fixture",prBody:"fixture"} as never);
 expect(result).toMatchObject({ok:false,reason:"base_identity_required"}); expect(fetcher).not.toHaveBeenCalled();
});
it("refuses malformed base64 instead of silently accepting different file bytes",async()=>{
 fetcher.mockResolvedValueOnce(Response.json({encoding:"base64",content:"!!!not-base64!!!"}));
 expect(await fetchFileContent("owned","repo","file.txt","a".repeat(40),"synthetic_tenant_token")).toMatchObject({ok:false});
});
it("refuses non-UTF8 file bytes instead of replacing them in a proposed patch",async()=>{
 fetcher.mockResolvedValueOnce(Response.json({encoding:"base64",content:Buffer.from([0xff,0xfe,0xfd]).toString("base64")}));
 expect(await fetchFileContent("owned","repo","file.txt","a".repeat(40),"synthetic_tenant_token")).toMatchObject({ok:false});
});
it("bounds file response bytes before retaining them",async()=>{
 fetcher.mockResolvedValueOnce(new Response(JSON.stringify({encoding:"base64",content:Buffer.alloc(524289).toString("base64")})));
 expect(await fetchFileContent("owned","repo","file.txt","a".repeat(40),"synthetic_tenant_token")).toMatchObject({ok:false});
});
it("keeps the read deadline active through a stalled response body",async()=>{
 vi.useFakeTimers();let cancelled=false;
 const body=new ReadableStream<Uint8Array>({cancel(){cancelled=true;}});
 fetcher.mockResolvedValueOnce(new Response(body));
 try{
  const pending=fetchFileContent("owned","repo","file.txt","a".repeat(40),"synthetic_tenant_token");
  await vi.advanceTimersByTimeAsync(15_001);
  expect(await pending).toMatchObject({ok:false});expect(cancelled).toBe(true);
 }finally{vi.useRealTimers();}
});
it("preserves a UTF8 byte-order mark instead of silently changing the pinned file",async()=>{
 fetcher.mockResolvedValueOnce(Response.json({encoding:"base64",content:Buffer.from("\ufefffixture").toString("base64")}));
 expect(await fetchFileContent("owned","repo","file.txt","a".repeat(40),"synthetic_tenant_token")).toMatchObject({ok:true,content:"\ufefffixture"});
});
it("rechecks write authority before every provider operation",async()=>{
 const authorize=vi.fn().mockResolvedValue({ok:true,token:"synthetic_tenant_token"});
 const responses=[{object:{sha:"a".repeat(40)}},{tree:{sha:"synthetic_base_tree"}},{truncated:false,tree:[]},{sha:"synthetic_blob"},{sha:"synthetic_tree"},{sha:"synthetic_commit"},{ref:"refs/heads/ai/fixture"},{number:12,html_url:"https://github.com/owned/repo/pull/12"}];
 fetcher.mockImplementation(async()=>Response.json(responses.shift()));
 expect(await openPullRequest({resolveToken:authorize,owner:"owned",repo:"repo",baseBranch:"main",expectedBaseSha:"a".repeat(40),newBranch:"ai/fixture",files:[{path:"file.txt",content:"fixture"}],commitMessage:"fixture",prTitle:"fixture",prBody:"fixture"} as never)).toMatchObject({ok:true});
 expect(authorize).toHaveBeenCalledTimes(8);
});
it("stops a revoked connection after a blob write and retains partial-write uncertainty",async()=>{
 const authorize=vi.fn().mockResolvedValueOnce({ok:true,token:"synthetic_tenant_token"}).mockResolvedValueOnce({ok:true,token:"synthetic_tenant_token"}).mockResolvedValueOnce({ok:true,token:"synthetic_tenant_token"}).mockResolvedValueOnce({ok:true,token:"synthetic_tenant_token"}).mockResolvedValue({ok:false,error:"github_not_connected"});
 const responses=[{object:{sha:"a".repeat(40)}},{tree:{sha:"synthetic_base_tree"}},{truncated:false,tree:[]},{sha:"synthetic_blob"}];fetcher.mockImplementation(async()=>Response.json(responses.shift()));
 expect(await openPullRequest({resolveToken:authorize,owner:"owned",repo:"repo",baseBranch:"main",expectedBaseSha:"a".repeat(40),newBranch:"ai/fixture",files:[{path:"file.txt",content:"fixture"}],commitMessage:"fixture",prTitle:"fixture",prBody:"fixture"} as never)).toMatchObject({ok:false,reason:"authority_changed",writeMayHaveOccurred:true});
 expect(fetcher).toHaveBeenCalledTimes(4);
});
it("bounds a stalled write response body and preserves uncertain repository outcome",async()=>{
 vi.useFakeTimers();let cancelled=false;
 const responses=[Response.json({object:{sha:"a".repeat(40)}}),Response.json({tree:{sha:"synthetic_base_tree"}}),Response.json({truncated:false,tree:[]}),new Response(new ReadableStream<Uint8Array>({cancel(){cancelled=true;}}))];
 fetcher.mockImplementation(async()=>responses.shift());
 try{
  const pending=openPullRequest({resolveToken:async()=>({ok:true,token:"synthetic_tenant_token"}),owner:"owned",repo:"repo",baseBranch:"main",expectedBaseSha:"a".repeat(40),newBranch:"ai/fixture",files:[{path:"file.txt",content:"fixture"}],commitMessage:"fixture",prTitle:"fixture",prBody:"fixture"});
  await vi.advanceTimersByTimeAsync(15_001);
  const result=await Promise.race([pending,Promise.resolve("still_pending")]);
  expect(result).toMatchObject({ok:false,writeMayHaveOccurred:true});expect(cancelled).toBe(true);expect(fetcher).toHaveBeenCalledTimes(4);
 }finally{vi.useRealTimers();}
});

import { beforeEach, expect, it, vi } from "vitest";
import { listWorkflowFiles } from "../githubWriteClient";
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const input = { owner: "acme", repo: "app", ref: "release/example", installationToken: "private-token", signal: new AbortController().signal };
const entry = (name: string, extra = {}) => ({ name, path: `.github/workflows/${name}`, type: "file", sha: "a".repeat(40), ...extra });
beforeEach(() => vi.clearAllMocks());
it("lists only bounded workflow filenames and blob identities at the requested ref", async () => {
 fetchMock.mockResolvedValue(new Response(JSON.stringify([entry("z.yml"), entry("a.yaml"), entry(".gitkeep"), entry("notes.txt")])));
 expect(await listWorkflowFiles(input)).toEqual({ ok: true, data: [{ name: "a.yaml", path: ".github/workflows/a.yaml", blobSha: "a".repeat(40) }, { name: "z.yml", path: ".github/workflows/z.yml", blobSha: "a".repeat(40) }] });
 expect(fetchMock).toHaveBeenCalledTimes(1);
 expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/repos/acme/app/contents/.github/workflows?ref=release%2Fexample", expect.objectContaining({ method: "GET", redirect: "error", cache: "no-store" }));
});
it.each([{}, null, [entry("a.yml", {path: "outside/a.yml"})], [entry("a.yml", {sha: "bad"})], [entry("a.yml", {type: "symlink"})], [entry("a.yml"), entry("a.yml")], Array.from({length: 201}, (_, i) => entry(`${i}.yml`))])("refuses malformed or over-limit catalogues instead of returning partial choices", async body => {
 fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));
 expect(await listWorkflowFiles(input)).toEqual({ok:false,error:"github_workflow_catalogue_unavailable"});
});
it.each(["", "bad\nref", "x".repeat(241)])("refuses invalid references before fetching", async ref => {
 expect((await listWorkflowFiles({...input,ref})).ok).toBe(false); expect(fetchMock).not.toHaveBeenCalled();
});
it("does not leak provider errors or credentials", async()=>{
 fetchMock.mockResolvedValue(new Response('private-token provider diagnostic', {status:403}));
 expect(await listWorkflowFiles(input)).toEqual({ok:false,error:"github_workflow_catalogue_unavailable"});
});
it("accepts an empty directory without claiming a runnable workflow",async()=>{
 fetchMock.mockResolvedValue(new Response('[]'));expect(await listWorkflowFiles(input)).toEqual({ok:true,data:[]});
});

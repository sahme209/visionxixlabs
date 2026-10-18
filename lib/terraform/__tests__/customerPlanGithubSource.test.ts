import { afterEach, expect, it, vi } from "vitest";
import { readGithubTerraformSource } from "@/lib/connectors/github/githubWriteClient";
afterEach(()=>vi.unstubAllGlobals());
const base={owner:"owned",repo:"infra",installationToken:"synthetic-installation-token",signal:new AbortController().signal,budget:{remainingBytes:256*1024}};
it("uses exact immutable GET source resources through the bounded existing GitHub transport",async()=>{
 const fetcher=vi.fn(async(url:unknown,options?:RequestInit)=>{void url;void options;return new Response(JSON.stringify({fixture:true}));});vi.stubGlobal("fetch",fetcher);
 for(const resource of [{kind:"commit",sha:"a".repeat(40)},{kind:"tree",sha:"b".repeat(40)},{kind:"file",path:"scripts/terraform/customer-plan-producer.mjs",commitSha:"a".repeat(40)}] as const){
  expect(await readGithubTerraformSource({...base,resource})).toEqual({ok:true,data:{fixture:true}});
 }
 expect(fetcher.mock.calls.map(([url])=>String(url))).toEqual([`https://api.github.com/repos/owned/infra/git/commits/${"a".repeat(40)}`,`https://api.github.com/repos/owned/infra/git/trees/${"b".repeat(40)}?recursive=1`,`https://api.github.com/repos/owned/infra/contents/scripts/terraform/customer-plan-producer.mjs?ref=${"a".repeat(40)}`]);
 for(const [,options] of fetcher.mock.calls as unknown as Array<[unknown,RequestInit]>){expect(options).toMatchObject({method:"GET",credentials:"omit",redirect:"error",cache:"no-store"});}
});
it.each([ {kind:"file",path:"../outside",commitSha:"a".repeat(40)},{kind:"file",path:"https://foreign.invalid",commitSha:"a".repeat(40)},{kind:"tree",sha:"main"},{kind:"commit",sha:"a".repeat(40),url:"https://foreign.invalid"} ])("rejects unsupported source selectors before any send %#",async resource=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 expect(await readGithubTerraformSource({...base,resource:resource as never})).toMatchObject({ok:false});expect(fetcher).not.toHaveBeenCalled();
});
it("rejects body overflow and canceled reads without returning partial JSON",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(" ".repeat(256*1024+1))));
 expect(await readGithubTerraformSource({...base,resource:{kind:"commit",sha:"a".repeat(40)}})).toMatchObject({ok:false});
 const controller=new AbortController();controller.abort();const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 expect(await readGithubTerraformSource({...base,signal:controller.signal,resource:{kind:"commit",sha:"a".repeat(40)}})).toMatchObject({ok:false});expect(fetcher).not.toHaveBeenCalled();
});

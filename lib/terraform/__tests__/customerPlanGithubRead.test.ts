import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bytesDigest } from "../savedPlanArtifact";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { customerProfile, hash } from "./customerPlanFixtures";
const m=vi.hoisted(()=>({token:vi.fn()}));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken",()=>({resolveTenantScopedToken:m.token,parseRepositoryFullName:(fullName:string)=>{const [owner,repo]=fullName.split("/");return {owner,repo};}}));
import { readCustomerPlanGithubEvidence } from "../customerPlanGithubRead";
const gitHash=(content:Buffer)=>createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
function fixture(){
 const profile=customerProfile(),workflow=Buffer.from("synthetic fixed reviewed manual workflow"),script=Buffer.from("synthetic fixed reviewed producer"),lock=Buffer.from("synthetic readonly provider lock"),main=Buffer.from('resource "terraform_data" "owned" {}');
 profile.producer.workflowDigest=bytesDigest(workflow);profile.producer.scriptDigest=bytesDigest(script);profile.configuration.providerLockDigest=bytesDigest(lock);
 const blobs=[{path:`${profile.configuration.root}/main.tf`,mode:"100644",type:"blob",sha:gitHash(main)},{path:`${profile.configuration.root}/.terraform.lock.hcl`,mode:"100644",type:"blob",sha:gitHash(lock)},{path:profile.producer.scriptPath,mode:"100644",type:"blob",sha:gitHash(script)},{path:profile.producer.workflowPath,mode:"100644",type:"blob",sha:gitHash(workflow)}];
 profile.configuration.treeDigest=sha256ContentHash(blobs.filter(v=>v.path.startsWith(`${profile.configuration.root}/`)).map(v=>({path:v.path.slice(profile.configuration.root.length+1),mode:v.mode,sha:v.sha})).sort((a,b)=>a.path.localeCompare(b.path)));
 const repository={id:12345,full_name:"owned/infra",private:false},run={id:888,run_attempt:1,head_sha:profile.repository.sourceSha,head_branch:"main",path:profile.producer.workflowPath,event:"workflow_dispatch",status:"completed",conclusion:"success",repository,head_repository:repository,referenced_workflows:[]};
 const tree={sha:"b".repeat(40),truncated:false,tree:blobs},bundle=Buffer.from("synthetic-downloaded-bytes-not-verified"),bundleUrl="https://reviewed.blob.core.windows.net/attestations/12345/fixture.json";
 const fetched:string[]=[];let active=true;
 const current=vi.fn(async()=>active);
 const fetcher=vi.fn(async(url:unknown)=>{
  const value=String(url);fetched.push(value);let data:unknown;
  if(value===bundleUrl)return new Response(bundle);
  if(value.includes("/actions/runs/"))data=run;
  else if(value.includes("/git/commits/"))data={sha:profile.repository.sourceSha,tree:{sha:tree.sha}};
  else if(value.includes("/git/trees/"))data=tree;
  else if(value.includes("/contents/")){
   const path=new URL(value).pathname.split("/contents/")[1],content=path===profile.producer.workflowPath?workflow:path===profile.producer.scriptPath?script:lock;
   data={type:"file",path,encoding:"base64",content:content.toString("base64"),size:content.length,sha:gitHash(content)};
  }else if(value.includes("/attestations/"))data={attestations:[{repository_id:12345,bundle_url:bundleUrl}]};
  else data=repository;
  return new Response(JSON.stringify(data));
 });
 vi.stubGlobal("fetch",fetcher);
 const input={profile,run:{id:"888",attempt:1},receiptDigest:hash("receipt"),installation:{id:"installation-owned",githubInstallationId:"9000",accountLogin:"owned",status:"active",revokedAt:null,suspendedAt:null,updatedAt:new Date("2026-10-18T11:00:00Z")},
  repo:{gitHubInstallation:{findFirst:vi.fn()}},current,signal:new AbortController().signal,downloadPolicy:[{origin:"https://reviewed.blob.core.windows.net",pathPrefix:"/attestations/12345/"}]};
 return {input,profile,run,repository,tree,fetched,bundle,bundleUrl,stop:()=>{active=false;}};
}
beforeEach(()=>{m.token.mockReset();m.token.mockResolvedValue({ok:true,token:"synthetic-narrow-token"});});
afterEach(()=>vi.unstubAllGlobals());
it("reads exact run/source/code/lock/bundle bytes without claiming signature or deployment authority",async()=>{
 const f=fixture(),result=await readCustomerPlanGithubEvidence(f.input);
 expect(result.kind).toBe("read_customer_plan_source");
 if(result.kind!=="read_customer_plan_source")throw Error("expected synthetic source response");
 expect(result.bundles.map(bytesDigest)).toEqual([bytesDigest(f.bundle)]);
 expect(result).not.toHaveProperty("verified");expect(JSON.stringify(result)).not.toContain("synthetic-narrow-token");
 expect(m.token.mock.calls[0][2]).toMatchObject({id:"installation-owned",permissionProfile:"provenance_read"});
 expect(f.fetched.some(url=>url.includes("/attempts/1"))).toBe(true);
});
it.each(["fork","attempt","automatic","workflow","truncated","symlink","lock"])("refuses changed or unsupported source %s before bundle download",async kind=>{
 const f=fixture();
 if(kind==="fork")f.run.head_repository={...f.repository,id:999};
 if(kind==="attempt")f.run.run_attempt=2;
 if(kind==="automatic")f.run.event="push";
 if(kind==="workflow")f.profile.producer.workflowDigest=hash("unreviewed");
 if(kind==="truncated")f.tree.truncated=true;
 if(kind==="symlink")f.tree.tree[0].mode="120000";
 if(kind==="lock")f.profile.configuration.providerLockDigest=hash("other-lock");
 expect(await readCustomerPlanGithubEvidence(f.input)).toMatchObject({kind:"unavailable"});expect(f.fetched).not.toContain(f.bundleUrl);
});
it("withholds late source reads when current membership/profile/installation changes",async()=>{
 const f=fixture();f.input.current.mockImplementation(async()=>{if(f.fetched.length>1)f.stop();return f.fetched.length<=1;});
 expect(await readCustomerPlanGithubEvidence(f.input)).toMatchObject({kind:"unavailable"});expect(f.fetched).not.toContain(f.bundleUrl);
});
it("never falls back to global credentials or an unreviewed bundle URL",async()=>{
 const f=fixture();m.token.mockResolvedValue({ok:false,error:"github_token_unavailable"});
 expect(await readCustomerPlanGithubEvidence(f.input)).toMatchObject({kind:"unavailable"});expect(f.fetched).toEqual([]);
 const g=fixture();m.token.mockResolvedValue({ok:true,token:"synthetic"});g.input.downloadPolicy=[];
 expect(await readCustomerPlanGithubEvidence(g.input)).toMatchObject({kind:"unavailable"});expect(g.fetched).toEqual([]);
});
it.each([0,Number.NaN,Number.POSITIVE_INFINITY,1.5,96*1024*1024+1])("refuses invalid/exhausted shared budget %s before token mint/fetch",async remaining=>{
 const f=fixture();expect(await readCustomerPlanGithubEvidence({...f.input,budget:{remaining}})).toMatchObject({kind:"unavailable"});expect(m.token).not.toHaveBeenCalled();expect(f.fetched).toHaveLength(0);
});
it("charges actual bounded body bytes to the same budget across initial and final reads",async()=>{
 const f=fixture(),budget={remaining:96*1024*1024};expect((await readCustomerPlanGithubEvidence({...f.input,budget})).kind).toBe("read_customer_plan_source");const first=budget.remaining;expect(first).toBeLessThan(96*1024*1024-f.bundle.length);
 expect((await readCustomerPlanGithubEvidence({...f.input,budget})).kind).toBe("read_customer_plan_source");expect(budget.remaining).toBeLessThan(first);
 budget.remaining=1;expect((await readCustomerPlanGithubEvidence({...f.input,budget})).kind).toBe("unavailable");expect(budget.remaining).toBe(0);
});
it("keeps the debit from a partial failed stream instead of restoring it for retry",async()=>{
 const f=fixture(),budget={remaining:1024};let stage=0;
 vi.mocked(fetch).mockImplementationOnce(async()=>new Response(new ReadableStream<Uint8Array>({pull(controller){if(stage++===0)controller.enqueue(Buffer.from("{"));else controller.error(Error("synthetic stream failure"));}})));
 expect((await readCustomerPlanGithubEvidence({...f.input,budget})).kind).toBe("unavailable");expect(budget.remaining).toBe(1023);
});
it("cancels the whole operation without minting or resetting its owned budget",async()=>{
 const f=fixture(),controller=new AbortController(),budget={remaining:1024};controller.abort();expect((await readCustomerPlanGithubEvidence({...f.input,signal:controller.signal,budget})).kind).toBe("unavailable");expect(m.token).not.toHaveBeenCalled();expect(budget.remaining).toBe(1024);
});

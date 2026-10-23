import { beforeEach, expect, it, vi } from "vitest";
const f=vi.hoisted(()=>({read:vi.fn(),file:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{pipelineStageRun:{findFirst:f.read}}}));
vi.mock("../codingGithubCredential",()=>({readCodingGithubFile:f.file}));
import { prepareCodingArtifact } from "../prepareCodingArtifact";
const patch="--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n";
let proposal:{id:string;outputDetail:{proposedPatchText:string}};
beforeEach(()=>{vi.resetAllMocks();proposal={id:"proposal",outputDetail:{proposedPatchText:patch}};
 f.read.mockImplementation(async({where})=>where.stageKind==="code_read"?{id:"read",outputDetail:{owner:"owned",repo:"repo",branch:"main",headSha:"a".repeat(40)}}:proposal);
 f.file.mockResolvedValue({ok:true,content:"old\n"});
});
const ctx={organizationId:"org",runId:"run",repositoryFullName:"owned/repo"};
it("captures exact file bytes using current scoped read authority at the saved immutable commit",async()=>{
 expect(await prepareCodingArtifact(ctx)).toMatchObject({ok:true,artifact:{proposalStageRunId:"proposal",readStageRunId:"read",baseCommitSha:"a".repeat(40),files:[{path:"file.txt",before:"old\n",after:"new\n"}]}});
 expect(f.file).toHaveBeenCalledWith("org",{owner:"owned",repo:"repo"},"file.txt","a".repeat(40));
 for(const [query] of f.read.mock.calls)expect(query.where).toMatchObject({runId:"run",run:{organizationId:"org"}});
});
it("refuses a changed proposal after remote file reads",async()=>{
 f.file.mockImplementation(async()=>{proposal={...proposal,outputDetail:{proposedPatchText:patch.replace("new","other")}};return{ok:true,content:"old\n"};});
 expect(await prepareCodingArtifact(ctx)).toMatchObject({ok:false});
});
it("refuses revoked or unavailable file access",async()=>{f.file.mockResolvedValue({ok:false,reason:"fetch_failed"});expect(await prepareCodingArtifact(ctx)).toMatchObject({ok:false});});
it("refuses a saved read for a different repository before any file access",async()=>{
 f.read.mockImplementation(async({where})=>where.stageKind==="code_read"?{id:"read",outputDetail:{owner:"other",repo:"repo",branch:"main",headSha:"a".repeat(40)}}:proposal);
 expect(await prepareCodingArtifact(ctx)).toMatchObject({ok:false});expect(f.file).not.toHaveBeenCalled();
});
it("refuses sensitive paths before any credentialed file request",async()=>{
 proposal.outputDetail.proposedPatchText=patch.replaceAll("file.txt",".env");
 expect(await prepareCodingArtifact(ctx)).toMatchObject({ok:false});expect(f.file).not.toHaveBeenCalled();
});

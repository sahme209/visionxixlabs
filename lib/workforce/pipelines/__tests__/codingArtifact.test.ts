import { expect, it } from "vitest";
import { buildCodingArtifact, verifyCodingArtifact } from "../codingArtifact";
const input = () => ({ organizationId:"org",runId:"run",proposalStageRunId:"proposal",readStageRunId:"read",repositoryFullName:"owned/repo",baseBranch:"main",baseCommitSha:"a".repeat(40),patchText:"--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",baseFiles:[{path:"file.txt",content:"old\n" as string|null}] });
it("binds the exact target, proposal, pinned base and resulting file bytes", () => {
 const result=buildCodingArtifact(input());expect(result).toMatchObject({ok:true,artifact:{schema:1,files:[{path:"file.txt",before:"old\n",after:"new\n",kind:"modified"}]}});
 if(!result.ok)throw Error("fixture artifact required");
 expect(result.digest).toMatch(/^[a-f0-9]{64}$/);expect(verifyCodingArtifact(result.artifact,result.digest,{organizationId:"org",runId:"run"})).toBe(true);
});
it("has a deterministic digest and owns its copied frozen contents", () => {
 const source=input(),a=buildCodingArtifact(source),b=buildCodingArtifact(input());expect(a).toEqual(b);
 if(!a.ok)throw Error("fixture artifact required");source.baseFiles[0].content="later mutation";
 expect(a.artifact.files[0].before).toBe("old\n");expect(Object.isFrozen(a.artifact.files[0])).toBe(true);
});
it.each(["organizationId","runId","repositoryFullName","baseBranch","baseCommitSha","proposalStageRunId","readStageRunId","patchText"] as const)("rejects a changed %s against the approved digest", key=>{
 const a=buildCodingArtifact(input());if(!a.ok)throw Error("fixture artifact required");
 const changed=structuredClone(a.artifact);Object.assign(changed,{[key]:"changed"});
 expect(verifyCodingArtifact(changed,a.digest,{organizationId:"org",runId:"run"})).toBe(false);
});
it("rejects changed output bytes and cross-workspace consumption",()=>{
 const a=buildCodingArtifact(input());if(!a.ok)throw Error("fixture artifact required");const changed=structuredClone(a.artifact);changed.files[0].after="other\n";
 expect(verifyCodingArtifact(changed,a.digest,{organizationId:"org",runId:"run"})).toBe(false);
 expect(verifyCodingArtifact(a.artifact,a.digest,{organizationId:"other",runId:"run"})).toBe(false);
});
it("requires observed absence for an addition and presence for a deletion",()=>{
 const source=input();source.patchText="--- /dev/null\n+++ b/file.txt\n@@ -0,0 +1 @@\n+new\n";
 expect(buildCodingArtifact(source)).toMatchObject({ok:false});source.baseFiles[0].content=null;expect(buildCodingArtifact(source)).toMatchObject({ok:true});
 source.patchText="--- a/file.txt\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n";expect(buildCodingArtifact(source)).toMatchObject({ok:false});
});
it.each(["../file.txt","/file.txt",".git/config","dir/../file.txt","C:/file.txt","a\\b.txt"])("rejects unsafe artifact path %s",path=>{
 const source=input();source.patchText=source.patchText.replaceAll("file.txt",path);source.baseFiles=[{path,content:"old\n"}];expect(buildCodingArtifact(source)).toMatchObject({ok:false});
});
it("refuses duplicate patch paths, missing observations and malformed commit identities",()=>{
 const source=input();source.patchText+=source.patchText;expect(buildCodingArtifact(source)).toMatchObject({ok:false});
 const missing=input();missing.baseFiles=[];expect(buildCodingArtifact(missing)).toMatchObject({ok:false});
 expect(buildCodingArtifact({...input(),baseCommitSha:"main"})).toMatchObject({ok:false});
});
it("survives JSON storage with reordered object keys without weakening exact content checks",()=>{
 const a=buildCodingArtifact(input());if(!a.ok)throw Error("fixture artifact required");
 const reordered=Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(a.artifact))).reverse());
 expect(verifyCodingArtifact(reordered,a.digest,{organizationId:"org",runId:"run"})).toBe(true);
 expect(verifyCodingArtifact({...reordered,extra:"unapproved"},a.digest,{organizationId:"org",runId:"run"})).toBe(false);
});
it("refuses a patch that cannot apply to the observed base and unused base observations",()=>{
 expect(buildCodingArtifact({...input(),baseFiles:[{path:"file.txt",content:"different\n"}]})).toMatchObject({ok:false});
 expect(buildCodingArtifact({...input(),baseFiles:[...input().baseFiles,{path:"other.txt",content:null}]})).toMatchObject({ok:false});
});
it.each([".env","keys/signing.pem","secrets/password.json"])("excludes sensitive repository material from artifact %s",path=>{
 const source=input();source.patchText=source.patchText.replaceAll("file.txt",path);source.baseFiles=[{path,content:"old\n"}];expect(buildCodingArtifact(source)).toMatchObject({ok:false});
});
it("refuses an oversized proposal before parsing or storing it",()=>{
 expect(buildCodingArtifact({...input(),patchText:"x".repeat(262145)})).toMatchObject({ok:false});
});
it("rejects lone surrogates that would become different UTF8 bytes on GitHub",()=>{
 const source=input();source.patchText=source.patchText.replace("+new","+\ud800");expect(buildCodingArtifact(source)).toMatchObject({ok:false});
 const base=input();base.patchText=base.patchText.replace("-old","-\ud800");base.baseFiles[0].content="\ud800\n";expect(buildCodingArtifact(base)).toMatchObject({ok:false});
});
it("preserves well-formed Unicode output bytes across JSON and UTF8 encoding",()=>{
 const source=input();source.patchText=source.patchText.replace("+new","+hello 🌍 café");const a=buildCodingArtifact(source);if(!a.ok)throw Error("fixture artifact required");
 expect(a.artifact.files[0].after).toBe("hello 🌍 café\n");
 expect(Buffer.from(a.artifact.files[0].after!,"utf8").toString("utf8")).toBe(a.artifact.files[0].after);
 expect(verifyCodingArtifact(JSON.parse(JSON.stringify(a.artifact)),a.digest,{organizationId:"org",runId:"run"})).toBe(true);
});

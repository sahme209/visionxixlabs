import { expect, it } from "vitest";
import { fileProposalReview } from "../fileProposalReview";
const args=()=>({repositoryFullName:"owner/repo",branch:"test",path:"a.js",content:"after",message:"change",_review:{kind:"github_file",baseSha:"blob",baseContent:"before"}});
it("pairs a single file with its matching trusted base",()=>{
 expect(fileProposalReview("commit_github_file",args())?.files).toEqual([{path:"a.js",before:"before",after:"after",baseSha:"blob"}]);
});
it("refuses the wrong review snapshot kind for a single-file action",()=>{
 expect(fileProposalReview("commit_github_file",{...args(),_review:{kind:"github_files",files:[{path:"a.js",baseSha:"blob",baseContent:"before"}]}})).toBeNull();
});
it("refuses a nonempty claimed base for a new file",()=>{
 expect(fileProposalReview("commit_github_file",{...args(),_review:{kind:"github_file",baseSha:null,baseContent:"untrusted prior text"}})).toBeNull();
});
it("bounds the total before/after content sent to the diff renderer",()=>{
 expect(fileProposalReview("commit_github_file",{...args(),content:"x".repeat(2_000_001)})).toBeNull();
});
it("refuses duplicate proposed paths even when review arrays have matching length",()=>{
 const file={path:"a.js",content:"after"},base={path:"a.js",baseSha:"blob",baseContent:"before"};
 expect(fileProposalReview("commit_github_files",{...args(),files:[file,file],_review:{kind:"github_files",files:[base,base]}})).toBeNull();
});

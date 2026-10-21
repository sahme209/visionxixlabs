import {expect, it} from "vitest";
import {localEditProposal, localEditBlocker} from "../../../desktop/src/lib/localEditReview";
const proposal = {id: "proposal-1", toolName: "commit_github_file", argsJson: {repositoryFullName: "fixture/repo", branch: "feature", path: "src/app.ts", content: "changed", _review: {kind: "github_file", baseSha: "blob-sha", baseContent: "original"}}};
it("accepts an existing-file review and a clean matching local baseline", () => {
  const edit = localEditProposal(proposal)!;
  expect(localEditBlocker(edit, {repositoryFullName: "fixture/repo", branch: "feature", path: "src/app.ts", saved: "original", content: "original"})).toBeNull();
});
it.each([".env", "../file", "/file", ".git/config"])("rejects restricted path %s", path => {
  expect(localEditProposal({...proposal, argsJson: {...proposal.argsJson, path}})).toBeNull();
});
it("rejects new files and missing trusted review", () => {
  expect(localEditProposal({...proposal, argsJson: {...proposal.argsJson, _review: null}})).toBeNull();
  expect(localEditProposal({...proposal, argsJson: {...proposal.argsJson, _review: {...proposal.argsJson._review, baseSha: null}}})).toBeNull();
});
it("refuses wrong target, dirty buffer and stale baseline", () => {
  const edit = localEditProposal(proposal)!, file = {repositoryFullName: "fixture/repo", branch: "feature", path: "src/app.ts", saved: "original", content: "original"};
  expect(localEditBlocker(edit, {...file, branch: "main"})).toMatch(/repository, branch and file/);
  expect(localEditBlocker(edit, {...file, content: "unsaved"})).toMatch(/existing local edits/);
  expect(localEditBlocker(edit, {...file, saved: "newer", content: "newer"})).toMatch(/differs/);
});
it("accepts a coordinated existing-file proposal set without changing order", async () => {
  const {localEditProposals} = await import("../../../desktop/src/lib/localEditReview");
  const args = proposal.argsJson;
  const multi = {id: "multi", toolName: "commit_github_files", argsJson: {repositoryFullName: args.repositoryFullName, branch: args.branch, files: [{path: "a.ts", content: "next a"}, {path: "b.ts", content: "next b"}], _review: {kind: "github_files", files: [{path: "a.ts", baseContent: "old a", baseSha: "a"}, {path: "b.ts", baseContent: "old b", baseSha: "b"}]}}};
  expect(localEditProposals(multi).map(file => file.path)).toEqual(["a.ts", "b.ts"]);
  for (const bad of [
    {...multi.argsJson, files: [{path: "a.ts", content: "a"}, {path: ".env", content: "secret"}]},
    {...multi.argsJson, _review: {kind: "github_files", files: [...multi.argsJson._review.files].reverse()}},
    {...multi.argsJson, files: []},
    {...multi.argsJson, files: Array(11).fill(multi.argsJson.files[0])},
    {...multi.argsJson, _review: {kind: "github_files", files: multi.argsJson._review.files.map(file => ({...file, baseSha: null}))}},
    {...multi.argsJson, files: multi.argsJson.files.map(file => ({...file, content: "x".repeat(100001)}))},
    {...multi.argsJson, files: [{path: "a.ts", content: "a"}, {path: "A.ts", content: "b"}], _review: {kind: "github_files", files: [{path: "a.ts", baseContent: "a", baseSha: "a"}, {path: "A.ts", baseContent: "b", baseSha: "b"}]}},
  ]) expect(localEditProposals({...multi, argsJson: bad})).toEqual([]);
});

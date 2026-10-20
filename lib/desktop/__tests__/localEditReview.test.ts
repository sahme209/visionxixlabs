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

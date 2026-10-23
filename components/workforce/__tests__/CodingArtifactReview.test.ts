/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildCodingArtifact } from "@/lib/workforce/pipelines/codingArtifact";
import { CodingArtifactReview } from "../CodingArtifactReview";
afterEach(cleanup);
it("shows the exact target and full before/after bytes being approved",()=>{
 const a=buildCodingArtifact({organizationId:"org",runId:"run",proposalStageRunId:"proposal",readStageRunId:"read",repositoryFullName:"owned/repo",baseBranch:"main",baseCommitSha:"a".repeat(40),patchText:"--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+<script>example</script>\n",baseFiles:[{path:"file.txt",content:"old\n"}]});if(!a.ok)throw Error("fixture artifact required");
 render(createElement(CodingArtifactReview,{artifact:a.artifact,digest:a.digest}));
 expect(screen.getByRole("heading",{name:"Review coding changes"})).toBeTruthy();expect(screen.getByText("owned/repo")).toBeTruthy();expect(screen.getByLabelText("file.txt before").textContent).toBe("old\n");expect(screen.getByLabelText("file.txt after").textContent).toBe("<script>example</script>\n");expect(document.querySelector("script")).toBeNull();
});

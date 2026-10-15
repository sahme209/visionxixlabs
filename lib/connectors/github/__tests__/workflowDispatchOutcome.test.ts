import { describe, expect, it } from "vitest";
import { isDefiniteWorkflowDispatchRejection } from "../workflowDispatchOutcome";

describe("workflow dispatch rejection evidence", () => {
  it.each([400, 401, 403, 404, 405, 410, 422, 429])("recognizes explicit GitHub rejection %s", (status) => {
    expect(isDefiniteWorkflowDispatchRejection(`workflow_dispatch_failed: github_${status}: rejected`)).toBe(true);
  });
  it.each(["fetch failed", "workflow_dispatch_failed: timeout", "workflow_dispatch_failed: github_408: timeout", "workflow_dispatch_failed: github_500: failed", "workflow_dispatch_failed: github_503: unavailable", "workflow_dispatch_failed: github_4040", "untrusted github_404: text"])("retains uncertain or malformed evidence: %s", (error) => {
    expect(isDefiniteWorkflowDispatchRejection(error)).toBe(false);
  });
});

/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DeploymentWorkflowEvidence } from "../../../desktop/src/components/DeploymentWorkflowEvidence";
afterEach(cleanup);
it("renders workflow success and old rollback outcome only as reported evidence", () => {
  render(createElement(DeploymentWorkflowEvidence, { execution: { status: "completed", conclusion: "success", rollbackStatus: "succeeded" } }));
  expect(screen.getByText("Requested operation: unverified · installed workflow behavior unverified")).not.toBeNull();
  expect(screen.getByText("GitHub workflow: completed · success")).not.toBeNull();
  expect(screen.getByText("Rollback step evidence: succeeded · image recovery unverified")).not.toBeNull();
  expect(screen.getByText("Source artifact release, application health and image rollback remain unverified.")).not.toBeNull();
  expect(screen.queryByText(/Deployment stabilized|rollback succeeded/)).toBeNull();
});
it("labels only requested bundled restart when the server provides that protocol", () => {
  render(createElement(DeploymentWorkflowEvidence, { execution: { status: "queued", conclusion: null, rollbackStatus: "not_started", evidence: { operation: "unknown", requestedOperation: "service_restart", statusScope: "github_workflow", sourceArtifactVerified: false, applicationHealthVerified: false, rollbackImageVerified: false } } }));
  expect(screen.getByText(/Requested operation: ECS service restart/)).not.toBeNull();
  expect(screen.getByText(/installed workflow behavior unverified/)).not.toBeNull();
});

it("shows the exact run and last observation without claiming current deployment health", () => {
 render(createElement(DeploymentWorkflowEvidence,{execution:{status:"completed",conclusion:"success",rollbackStatus:"not_started",workflowRunId:"123456",lastObservedAt:"2026-10-26T12:00:00.000Z"}}));
 expect(screen.getByText("Workflow run: 123456")).not.toBeNull();
 expect(screen.getByText(/Last observed:.*saved observation, not a live check/)).not.toBeNull();
 expect(screen.getByText(/application health and image rollback remain unverified/)).not.toBeNull();
});
it("keeps absent or malformed observation time honest",()=>{
 render(createElement(DeploymentWorkflowEvidence,{execution:{status:"queued",conclusion:null,rollbackStatus:"not_started",lastObservedAt:"invalid"}}));
 expect(screen.getByText("Workflow run: Not yet identified")).not.toBeNull();
 expect(screen.getByText(/Last observed: Not yet recorded/)).not.toBeNull();
});

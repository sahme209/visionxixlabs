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

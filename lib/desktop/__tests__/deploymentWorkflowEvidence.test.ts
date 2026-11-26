/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { DeploymentWorkflowEvidence, formatRunElapsed } from "../../../desktop/src/components/DeploymentWorkflowEvidence";
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

describe("recorded run timing", () => {
 it("shows dispatch, observation and completion with elapsed time from recorded timestamps only", () => {
  render(createElement(DeploymentWorkflowEvidence,{execution:{status:"completed",conclusion:"success",rollbackStatus:"not_started",createdAt:"2026-10-26T12:00:00.000Z",lastObservedAt:"2026-10-26T12:01:30.000Z",completedAt:"2026-10-26T12:04:05.000Z"}}));
  const strip = screen.getByRole("list", { name: "Recorded run timing" });
  const items = within(strip).getAllByRole("listitem");
  expect(items.map((item) => item.getAttribute("data-recorded"))).toEqual(["true", "true", "true"]);
  expect(items[1].textContent).toContain("+1m 30s");
  expect(items[2].textContent).toContain("+4m 5s");
  expect(items[2].getAttribute("data-tone")).toBe("green");
 });
 it("marks missing steps as not recorded instead of inventing a time", () => {
  render(createElement(DeploymentWorkflowEvidence,{execution:{status:"in_progress",conclusion:null,rollbackStatus:"not_started",createdAt:"2026-10-26T12:00:00.000Z"}}));
  const items = within(screen.getByRole("list", { name: "Recorded run timing" })).getAllByRole("listitem");
  expect(items[1].textContent).toContain("Not yet observed");
  expect(items[2].textContent).toContain("Not completed");
  expect(items[2].getAttribute("data-tone")).toBe("neutral");
 });
 it("omits the strip without a valid dispatch time", () => {
  render(createElement(DeploymentWorkflowEvidence,{execution:{status:"queued",conclusion:null,rollbackStatus:"not_started",createdAt:"invalid"}}));
  expect(screen.queryByRole("list", { name: "Recorded run timing" })).toBeNull();
 });
 it("refuses negative or invalid elapsed time", () => {
  expect(formatRunElapsed(new Date(2000), new Date(1000))).toBeNull();
  expect(formatRunElapsed(new Date(0), new Date(3_720_000))).toBe("1h 2m");
 });
});

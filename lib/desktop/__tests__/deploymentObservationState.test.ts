import { describe, expect, it } from "vitest";
import { deploymentObservationState } from "../../../desktop/src/lib/deploymentObservationState";

describe("deployment receipt observation", () => {
  it.each(["reserved", "queued", "in_progress"])("does not claim or poll an active deployment without a provider receipt (%s)", (status) => {
    expect(deploymentObservationState({ status, conclusion: null, workflowRunId: null })).toEqual({ label: "Dispatch outcome awaiting verification", canPoll: false });
  });
  it("polls an explicitly recorded provider run", () => {
    expect(deploymentObservationState({ status: "in_progress", conclusion: null, workflowRunId: "12345" })).toEqual({ label: "Deployment in progress", canPoll: true });
  });
  it("does not poll a completed run", () => {
    expect(deploymentObservationState({ status: "completed", conclusion: "success", workflowRunId: "12345" })).toEqual({ label: "Deployment stabilized", canPoll: false });
  });
  it("preserves tracking-unavailable status", () => {
    expect(deploymentObservationState({ status: "tracking_unavailable", conclusion: null, workflowRunId: null })).toEqual({ label: "Live tracking unavailable", canPoll: false });
  });
});

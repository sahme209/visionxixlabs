/**
 * Vitest unit tests for the pure onboarding readiness checker.
 */

import { describe, it, expect } from "vitest";
import { checkOnboardingReadiness, type MilestoneState } from "../onboardingReadinessChecker";

const M = (key: MilestoneState["key"], done: boolean): MilestoneState => ({ key, done });

describe("onboardingReadinessChecker", () => {
  it("trial tier requires only AWS connector + AI provider", () => {
    const r = checkOnboardingReadiness({
      tier: "trial",
      milestones: [
        M("cloud_connector_aws", true),
        M("ai_provider_configured", true),
        M("billing_plan_selected", false),
      ],
    });
    expect(r.ready).toBe(true);
    expect(r.completion).toBe(1);
  });

  it("starter tier nextBlocker walks ALL_KEYS order, surfacing the first missing required", () => {
    const r = checkOnboardingReadiness({
      tier: "starter",
      milestones: [
        M("cloud_connector_aws", true),
        M("ai_provider_configured", true),
        M("billing_plan_selected", false),
      ],
    });
    expect(r.ready).toBe(false);
    // outbound_channel_slack precedes billing_plan_selected in ALL_KEYS order.
    expect(r.nextBlocker).toBe("outbound_channel_slack");
  });

  it("growth tier requires GCP + first runbook pinned", () => {
    const r = checkOnboardingReadiness({
      tier: "growth",
      milestones: [
        M("cloud_connector_aws", true),
        M("ai_provider_configured", true),
        M("outbound_channel_slack", true),
        M("billing_plan_selected", true),
        M("first_proposal_decided", true),
        M("cloud_connector_gcp", false),
        M("first_runbook_pinned", false),
      ],
    });
    expect(r.ready).toBe(false);
    expect(r.nextBlocker).toBe("cloud_connector_gcp");
  });

  it("nextBlocker is null when everything required is done", () => {
    const r = checkOnboardingReadiness({
      tier: "trial",
      milestones: [
        M("cloud_connector_aws", true),
        M("ai_provider_configured", true),
      ],
    });
    expect(r.nextBlocker).toBeNull();
  });

  it("completion is 0..1 for required milestones only", () => {
    const r = checkOnboardingReadiness({
      tier: "starter",
      milestones: [
        M("cloud_connector_aws", true),
        M("ai_provider_configured", true),
        M("outbound_channel_slack", false),
        M("billing_plan_selected", false),
        M("first_proposal_decided", false),
      ],
    });
    // required for starter: aws, slack, billing, first_proposal, ai_provider = 5
    expect(r.totalRequired).toBe(5);
    expect(r.completedRequired).toBe(2);
    expect(r.completion).toBe(0.4);
  });

  it("custom requiredForTiers overrides default", () => {
    const r = checkOnboardingReadiness({
      tier: "growth",
      milestones: [
        M("cloud_connector_aws", true),
        M("ai_provider_configured", true),
        M("outbound_channel_slack", true),
        M("billing_plan_selected", true),
        M("first_proposal_decided", true),
        M("cloud_connector_gcp", false),
        M("first_runbook_pinned", false),
        // Override: scale-and-up only — so growth doesn't need it.
        { key: "first_runbook_pinned", done: false, requiredForTiers: ["scale", "enterprise"] },
      ],
    });
    // first_runbook_pinned no longer required at growth
    expect(r.nextBlocker).toBe("cloud_connector_gcp");
  });
});

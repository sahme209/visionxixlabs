/**
 * Vitest unit tests for the Teams adaptive-card builders.
 */

import { describe, it, expect } from "vitest";
import { buildTeamsApprovalCard, buildTeamsIncidentCard } from "../teamsAdapter";

describe("Teams Adaptive Card builders", () => {
  it("approval card schema + version + two actions", () => {
    const card = buildTeamsApprovalCard({
      packetLabel: "p", candidateKind: "k", blastRadius: "service",
      agentSupport: 2, agentOppose: 1, approveUrl: "https://a", rejectUrl: "https://r",
    });
    expect(card.type).toBe("AdaptiveCard");
    expect(card.version).toBe("1.5");
    expect((card.actions as Array<unknown>).length).toBe(2);
  });

  it("approval card mentions the packet label + safety contract", () => {
    const card = buildTeamsApprovalCard({
      packetLabel: "Tighten S3 PAB", candidateKind: "tighten_s3_pab", blastRadius: "single_resource",
      agentSupport: 3, agentOppose: 0, approveUrl: "u", rejectUrl: "u",
    });
    const json = JSON.stringify(card);
    expect(json).toContain("Tighten S3 PAB");
    expect(json).toContain("approval_only_no_execution");
  });

  it("incident card omits actions when no runbookUrl", () => {
    const card = buildTeamsIncidentCard({
      title: "spike", severity: "high", service: "checkout", detail: "p95 spike",
    });
    expect((card.actions as Array<unknown>).length).toBe(0);
  });

  it("incident card adds Open runbook action when supplied", () => {
    const card = buildTeamsIncidentCard({
      title: "spike", severity: "critical", service: "checkout", detail: "p95",
      runbookUrl: "https://rb",
    });
    const actions = card.actions as Array<Record<string, unknown>>;
    expect(actions.length).toBe(1);
    expect(actions[0].url).toBe("https://rb");
  });

  it("severity rendered uppercase in header", () => {
    const card = buildTeamsIncidentCard({
      title: "x", severity: "low", service: "s", detail: "d",
    });
    expect(JSON.stringify(card)).toContain("[LOW]");
  });
});

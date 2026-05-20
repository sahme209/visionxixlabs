/**
 * Vitest unit tests for the pure Slack block builders.
 */

import { describe, it, expect } from "vitest";
import { buildApprovalBlocks, buildIncidentBlocks } from "../slackAdapter";

describe("Slack builders", () => {
  it("approval blocks include header + section + actions", () => {
    const blocks = buildApprovalBlocks({
      packetLabel: "Tighten S3 PAB",
      candidateKind: "tighten_s3_pab",
      blastRadius: "service",
      agentSupport: 4,
      agentOppose: 1,
      approveUrl: "https://example.com/approve",
      rejectUrl: "https://example.com/reject",
    });
    expect(blocks.length).toBe(3);
    expect(blocks[0].type).toBe("header");
    expect(blocks[1].type).toBe("section");
    expect(blocks[2].type).toBe("actions");
  });

  it("approval header includes the packet label", () => {
    const blocks = buildApprovalBlocks({
      packetLabel: "X", candidateKind: "k", blastRadius: "single_resource",
      agentSupport: 0, agentOppose: 0, approveUrl: "u", rejectUrl: "u",
    });
    expect(JSON.stringify(blocks[0])).toContain("Approval needed: X");
  });

  it("approval actions reference the supplied urls", () => {
    const blocks = buildApprovalBlocks({
      packetLabel: "p", candidateKind: "k", blastRadius: "org",
      agentSupport: 1, agentOppose: 0,
      approveUrl: "https://approve", rejectUrl: "https://reject",
    });
    const json = JSON.stringify(blocks[2]);
    expect(json).toContain("https://approve");
    expect(json).toContain("https://reject");
  });

  it("incident blocks default to 2 blocks (no runbook)", () => {
    const blocks = buildIncidentBlocks({
      title: "spike", severity: "high", service: "checkout-api",
      detail: "p95 latency 2s",
    });
    expect(blocks.length).toBe(2);
  });

  it("incident blocks add actions when runbookUrl supplied", () => {
    const blocks = buildIncidentBlocks({
      title: "spike", severity: "high", service: "checkout-api",
      detail: "p95 latency 2s",
      runbookUrl: "https://rb",
    });
    expect(blocks.length).toBe(3);
    expect(blocks[2].type).toBe("actions");
  });

  it("severity prefix is uppercased in header", () => {
    const blocks = buildIncidentBlocks({
      title: "x", severity: "critical", service: "s", detail: "d",
    });
    expect(JSON.stringify(blocks[0])).toContain("[CRITICAL]");
  });
});

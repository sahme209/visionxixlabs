/**
 * Vitest unit tests for the pure deep-link builder + parser.
 */

import { describe, it, expect } from "vitest";
import { buildDeepLink, parseDeepLink } from "../deepLinkBuilder";

describe("deepLinkBuilder.buildDeepLink", () => {
  it("approval packet → both axiom:// and https universal URLs", () => {
    const r = buildDeepLink({ target: "approval_packet", id: "pkt-42" });
    expect(r.scheme).toBe("axiom://approvals/pkt-42");
    expect(r.universal).toBe("https://visionxixlabs.com/m/approvals/pkt-42");
  });

  it("incident with query params", () => {
    const r = buildDeepLink({ target: "incident", id: "inc-1", params: { source: "push", t: "abc" } });
    expect(r.scheme).toContain("axiom://incidents/inc-1?");
    expect(r.scheme).toContain("source=push");
    expect(r.scheme).toContain("t=abc");
  });

  it("no id → path without trailing /", () => {
    const r = buildDeepLink({ target: "agent_activity" });
    expect(r.scheme).toBe("axiom://activity");
    expect(r.universal).toBe("https://visionxixlabs.com/m/activity");
  });

  it("custom scheme override", () => {
    const r = buildDeepLink({ target: "incident", id: "i" }, { scheme: "axiomdev://", universalBase: "https://staging.example.com/m/" });
    expect(r.scheme).toBe("axiomdev://incidents/i");
    expect(r.universal).toBe("https://staging.example.com/m/incidents/i");
  });

  it("id is url-encoded", () => {
    const r = buildDeepLink({ target: "method_proposal", id: "id with space" });
    expect(r.scheme).toContain("proposals/id%20with%20space");
  });
});

describe("deepLinkBuilder.parseDeepLink", () => {
  it("parses scheme URL with id", () => {
    const r = parseDeepLink("axiom://approvals/pkt-42");
    expect(r.ok).toBe(true);
    expect(r.parsed?.target).toBe("approval_packet");
    expect(r.parsed?.id).toBe("pkt-42");
  });

  it("parses universal URL with id + query", () => {
    const r = parseDeepLink("https://visionxixlabs.com/m/incidents/inc-1?source=push");
    expect(r.ok).toBe(true);
    expect(r.parsed?.target).toBe("incident");
    expect(r.parsed?.id).toBe("inc-1");
    expect(r.parsed?.params.source).toBe("push");
  });

  it("returns unknown_target for an unrecognized path", () => {
    const r = parseDeepLink("axiom://nope/123");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown_target");
  });

  it("returns invalid_url for malformed input", () => {
    const r = parseDeepLink("::: not a url");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_url");
  });

  it("decodes the id segment", () => {
    const r = parseDeepLink("axiom://proposals/id%20with%20space");
    expect(r.parsed?.id).toBe("id with space");
  });

  it("no-id target returns null id", () => {
    const r = parseDeepLink("axiom://activity");
    expect(r.parsed?.id).toBeNull();
  });

  it("round-trips: build → parse", () => {
    const built = buildDeepLink({ target: "compliance_packet", id: "ev-1", params: { window: "7d" } });
    const r = parseDeepLink(built.scheme);
    expect(r.parsed?.target).toBe("compliance_packet");
    expect(r.parsed?.id).toBe("ev-1");
    expect(r.parsed?.params.window).toBe("7d");
  });
});

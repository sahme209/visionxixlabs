/**
 * Vitest unit tests for the closed-union narrowers on AgentRole +
 * AgentMessageKind.
 */

import { describe, it, expect } from "vitest";
import {
  AGENT_ROLES,
  AGENT_MESSAGE_KINDS,
  isAgentMessageKind,
  isAgentRole,
} from "../agentBusModel";

describe("agent bus model unions", () => {
  it("AGENT_ROLES declares at least the 10 expected roles", () => {
    expect(AGENT_ROLES.length).toBeGreaterThanOrEqual(10);
    expect(AGENT_ROLES).toContain("detector");
    expect(AGENT_ROLES).toContain("reasoner");
    expect(AGENT_ROLES).toContain("council");
    expect(AGENT_ROLES).toContain("improver");
  });

  it("isAgentRole narrows known roles", () => {
    expect(isAgentRole("detector")).toBe(true);
    expect(isAgentRole("council")).toBe(true);
  });

  it("isAgentRole rejects unknown roles", () => {
    expect(isAgentRole("randomAgent")).toBe(false);
    expect(isAgentRole("")).toBe(false);
    expect(isAgentRole("DETECTOR")).toBe(false); // case-sensitive
  });

  it("AGENT_MESSAGE_KINDS declares at least 11 message kinds", () => {
    expect(AGENT_MESSAGE_KINDS.length).toBeGreaterThanOrEqual(11);
    expect(AGENT_MESSAGE_KINDS).toContain("council_consensus");
    expect(AGENT_MESSAGE_KINDS).toContain("method_improvement");
  });

  it("isAgentMessageKind narrows known kinds", () => {
    expect(isAgentMessageKind("broadcast_signal")).toBe(true);
    expect(isAgentMessageKind("method_improvement")).toBe(true);
  });

  it("isAgentMessageKind rejects unknown kinds", () => {
    expect(isAgentMessageKind("not_a_kind")).toBe(false);
    expect(isAgentMessageKind("")).toBe(false);
  });
});

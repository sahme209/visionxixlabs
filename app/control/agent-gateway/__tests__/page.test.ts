// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const m = vi.hoisted(() => ({ keys: vi.fn(), envs: vi.fn(), requests: vi.fn(async () => [] as unknown[]), users: vi.fn(async () => [] as unknown[]) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org1" }) }));
vi.mock("@/lib/agentGateway/gatewayService", () => ({ listGatewayRequests: m.requests, listAgentScorecards: async () => [] }));
vi.mock("@/components/portal/ModuleIntro", () => ({ ModuleIntro: () => null }));
vi.mock("@/components/agentGateway/AgentGatewayDecision", () => ({ AgentGatewayDecision: () => null }));
vi.mock("@/lib/db", () => ({ prisma: { apiKey: { findMany: m.keys }, environment: { findMany: m.envs }, user: { findMany: m.users } } }));
import Page from "../page";

beforeEach(() => { m.keys.mockResolvedValue([{ name: "ci-all", scopes: ["*"], expiresAt: null, revokedAt: null }]); m.envs.mockResolvedValue([{ name: "Prod", tier: "prod", changeWindowRuleJson: null, approvalPolicyId: "p" }]); });
afterEach(cleanup);
it("shows the always-enforced agent rules and this workspace's findings", async () => {
  render(await Page());
  expect(screen.getByRole("heading", { name: "Agent firewall" })).toBeTruthy();
  expect(screen.getByText(/same change window, freezes, deployment checks and rings/)).toBeTruthy();
  const findings = screen.getByRole("list", { name: "Firewall findings" });
  expect(findings.textContent).toContain("API keys that can start pipelines without the gateway: ci-all");
  expect(findings.textContent).toContain("Production environments that accept deployments at any time: Prod");
  expect(m.keys.mock.calls[0][0].where).toEqual({ organizationId: "org1", revokedAt: null });
});
it("shows no findings rather than guessing when configuration cannot be read", async () => {
  m.keys.mockRejectedValue(new Error("db"));
  render(await Page());
  expect(screen.getByRole("status").textContent).toMatch(/could not be read/);
});

it("shows each request's change passport with named owner and approver", async () => {
  m.requests.mockResolvedValueOnce([{ id: "r1", agentName: "claude-code", actionKind: "deploy", environment: "production", target: "acme/web", summary: "Ship", status: "approved", riskLevel: "high", policyDecision: "require_approval", decidedByUserId: "u2", passport: { v: 1, origin: "external_agent", agent: "claude-code", model: "claude-opus", tools: ["git"], ownerUserId: "u1", createdAt: "2026-11-26T00:00:00.000Z", digest: "d" } }, { id: "r2", agentName: "cursor", actionKind: "read", environment: "development", target: "x", summary: "Look", status: "approved", riskLevel: "low", policyDecision: "allow", decidedByUserId: null, passport: null }]);
  m.users.mockResolvedValueOnce([{ id: "u1", name: "Dana", email: null }, { id: "u2", name: null, email: "lee@example.test" }]);
  render(await Page());
  expect(screen.getByText(/Passport: claude-code · model claude-opus · tools git · owner Dana · decided by lee@example.test/)).toBeTruthy();
  expect(screen.getByText(/No change passport recorded/)).toBeTruthy();
});

it("shows the review lane and when a second approver is needed", async () => {
  m.requests.mockResolvedValueOnce([{ id: "r1", agentName: "claude-code", actionKind: "deploy", environment: "production", target: "acme/web", summary: "Ship", status: "pending", riskLevel: "high", policyDecision: "require_approval", decidedByUserId: null, passport: null, triage: { lane: "two_person", approvalsRequired: 2, reason: "A production change that touches database migration: two different admins must approve." }, awaitingSecondApprover: true }]);
  render(await Page());
  expect(screen.getByText("Two approvers")).toBeTruthy();
  expect(screen.getByText(/a different admin must approve too/)).toBeTruthy();
});

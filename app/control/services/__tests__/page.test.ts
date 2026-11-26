/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const io = vi.hoisted(() => ({ repos: vi.fn(), comps: vi.fn(), runs: vi.fn(), envs: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org_s", roles: ["viewer"] }) }));
vi.mock("@/lib/db", () => ({ prisma: { repository: { findMany: io.repos }, component: { findMany: io.comps }, deploymentExecution: { findMany: io.runs }, environment: { findMany: io.envs } } }));
import Page from "../page";

beforeEach(() => {
  vi.resetAllMocks();
  io.repos.mockResolvedValue([{ id: "r1", remoteOwner: "acme", remoteName: "api", defaultBranch: "main", codeownersPresent: false, protectedBranches: ["main"] }]);
  io.comps.mockResolvedValue([{ repositoryId: "r1", name: "Payments API", ownerTeamLabel: "payments" }]);
  io.runs.mockResolvedValue([{ repositoryFullName: "acme/api", environmentId: "stg", sourceCommitSha: "abcdef1234", status: "completed", conclusion: "success", createdAt: new Date() }]);
  io.envs.mockResolvedValue([{ id: "stg", name: "Staging", displayOrder: 1 }]);
});
afterEach(cleanup);

it("lists services with owners, guardrails and the latest run per environment, scoped to the workspace", async () => {
  render(await Page());
  expect(screen.getByText("acme/api")).toBeTruthy();
  expect(screen.getByText("payments")).toBeTruthy();
  expect(screen.getByText("No CODEOWNERS")).toBeTruthy();
  expect(screen.getByText("abcdef1")).toBeTruthy();
  expect(io.repos.mock.calls[0][0].where.organizationId).toBe("org_s");
});
it("shows nothing rather than an estimate when records cannot be read", async () => {
  io.runs.mockRejectedValue(new Error("db"));
  render(await Page());
  expect(screen.getByRole("status").textContent).toContain("could not be read");
});

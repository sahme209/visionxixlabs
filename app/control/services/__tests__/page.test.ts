/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
const io = vi.hoisted(() => ({ repos: vi.fn(), comps: vi.fn(), runs: vi.fn(), envs: vi.fn(), incidents: vi.fn(), releases: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org_s", roles: ["viewer"] }) }));
vi.mock("@/lib/db", () => ({ prisma: { repository: { findMany: io.repos }, component: { findMany: io.comps }, deploymentExecution: { findMany: io.runs }, environment: { findMany: io.envs }, deploymentIncident: { findMany: io.incidents }, release: { findMany: io.releases } } }));
import Page from "../page";

beforeEach(() => {
  vi.resetAllMocks();
  io.repos.mockResolvedValue([{ id: "r1", remoteOwner: "acme", remoteName: "api", defaultBranch: "main", codeownersPresent: false, protectedBranches: ["main"] }]);
  io.comps.mockResolvedValue([{ repositoryId: "r1", name: "Payments API", ownerTeamLabel: "payments" }]);
  io.runs.mockResolvedValue([{ repositoryFullName: "acme/api", environmentId: "stg", sourceCommitSha: "abcdef1234", status: "completed", conclusion: "success", createdAt: new Date() }]);
  io.envs.mockResolvedValue([{ id: "stg", name: "Staging", displayOrder: 1 }]);
  io.incidents.mockResolvedValue([]);
  io.releases.mockResolvedValue([]);
});
afterEach(cleanup);

it("lists services with owners, guardrails and the latest run per environment, scoped to the workspace", async () => {
  render(await Page());
  const table = within(screen.getByRole("table"));
  expect(table.getByText("acme/api")).toBeTruthy();
  expect(table.getByText("payments")).toBeTruthy();
  expect(table.getByText("No CODEOWNERS")).toBeTruthy();
  expect(table.getByText("abcdef1")).toBeTruthy();
  expect(io.repos.mock.calls[0][0].where.organizationId).toBe("org_s");
});
it("shows nothing rather than an estimate when records cannot be read", async () => {
  io.runs.mockRejectedValue(new Error("db"));
  render(await Page());
  const statuses = screen.getAllByRole("status").map((n) => n.textContent);
  expect(statuses).toEqual(["Delivery health could not be read.", expect.stringContaining("The service catalog could not be read")]);
});
it("shows delivery health per environment from the workspace's own runs", async () => {
  io.runs.mockResolvedValue([{ repositoryFullName: "acme/api", environmentId: "stg", sourceCommitSha: "abcdef1234", status: "completed", conclusion: "failure", createdAt: new Date(Date.now() - 3_600_000), completedAt: new Date(Date.now() - 3_000_000), lastObservedAt: null }]);
  render(await Page());
  const section = screen.getByRole("region", { name: "Delivery health" });
  expect(section.textContent).toContain("Staging");
  expect(section.textContent).toContain("Degraded");
  expect(section.textContent).toContain("0% of finished runs succeeded.");
  expect(io.runs.mock.calls.every((c) => c[0].where.organizationId === "org_s")).toBe(true);
});
it("scores each service and names the next step, counting incidents through the release's repository", async () => {
  io.incidents.mockResolvedValue([{ releaseId: "rel1", status: "open" }]);
  io.releases.mockResolvedValue([{ id: "rel1", evidenceRepositoryId: "r1" }]);
  render(await Page());
  const section = screen.getByRole("region", { name: "Scorecards" });
  expect(section.textContent).toContain("acme/api");
  expect(section.textContent).toContain("4/6");
  expect(section.textContent).toContain("Fails: CODEOWNERS");
  expect(section.textContent).toContain("1 open or mitigated.");
  expect(section.textContent).toContain("Next: Add a CODEOWNERS file");
  expect(io.incidents.mock.calls[0][0].where.organizationId).toBe("org_s");
  expect(io.releases.mock.calls[0][0].where.organizationId).toBe("org_s");
});
it("leaves incidents unknown rather than passing when they cannot be read", async () => {
  io.incidents.mockRejectedValue(new Error("db"));
  render(await Page());
  const section = screen.getByRole("region", { name: "Scorecards" });
  expect(section.textContent).toContain("Unknown: No open incidents");
  expect(section.textContent).toContain("4/5");
});

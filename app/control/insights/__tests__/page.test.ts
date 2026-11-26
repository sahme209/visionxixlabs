/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const io = vi.hoisted(() => ({ runs: vi.fn(), count: vi.fn(), incidents: vi.fn(), checks: vi.fn(), results: vi.fn(), releases: vi.fn(), audit: vi.fn(), agentReqs: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org_insights", email: "owner@example.test", roles: ["owner"] }) }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentExecution: { findMany: io.runs, count: io.count }, deploymentIncident: { findMany: io.incidents }, release: { findMany: io.releases }, deploymentCheck: { findMany: io.checks }, deploymentCheckResult: { findMany: io.results }, auditEvent: { findMany: io.audit }, agentGatewayRequest: { findMany: io.agentReqs } } }));
import Page from "../page";

const value = (label: string) => screen.getByText(label, { selector: "dt" }).parentElement!.querySelector("dd")!.textContent!.trim();
beforeEach(() => {
  vi.resetAllMocks();
  const day = (d: number) => new Date(Date.now() - d * 86_400_000);
  io.runs.mockResolvedValue([
    { status: "completed", conclusion: "success", createdAt: day(1), completedAt: new Date(day(1).getTime() + 600_000) },
    { status: "completed", conclusion: "failure", createdAt: day(2), completedAt: new Date(day(2).getTime() + 300_000) },
    { status: "completed", conclusion: "success", createdAt: day(3), completedAt: new Date(day(3).getTime() + 900_000) },
  ]);
  io.count.mockResolvedValue(2);
  io.checks.mockResolvedValue([]);
  io.results.mockResolvedValue([]);
  io.releases.mockResolvedValue([]);
  io.audit.mockResolvedValue([]);
  io.agentReqs.mockResolvedValue([]);
  io.incidents.mockResolvedValue([{ status: "resolved", reportedAt: day(5), mitigatedAt: new Date(day(5).getTime() + 1_800_000), resolvedAt: new Date(day(5).getTime() + 7_200_000) }, { status: "open", reportedAt: day(1), mitigatedAt: null, resolvedAt: null }]);
});
afterEach(cleanup);

it("reports delivery and recovery from recorded rows scoped to the workspace", async () => {
  render(await Page());
  expect(value("Workflow runs")).toBe("3");
  expect(value("Run success rate")).toBe("66.7%");
  expect(value("Open incidents")).toBe("1");
  expect(value("Median time to mitigate")).toBe("30m");
  expect(value("Median time to resolve")).toBe("2h 0m");
  expect(io.runs.mock.calls[0][0].where.organizationId).toBe("org_insights");
  expect(io.incidents.mock.calls[0][0].where.organizationId).toBe("org_insights");
  expect(document.body.textContent).toContain("not DORA certification");
});

it("shows nothing rather than an estimate when records cannot be read", async () => {
  io.runs.mockRejectedValue(new Error("db"));
  io.incidents.mockRejectedValue(new Error("db"));
  render(await Page());
  expect(screen.getAllByRole("status").map((s) => s.textContent)).toEqual([
    "Workflow run records could not be read. Nothing is shown rather than an estimate.",
    "Incident records could not be read. Nothing is shown rather than an estimate.",
  ]);
});

it("explains an empty window instead of showing zero rates", async () => {
  io.runs.mockResolvedValue([]);
  io.count.mockResolvedValue(0);
  render(await Page());
  expect(screen.getAllByRole("status")[0].textContent).toContain("No workflow runs were recorded in the last 30 days");
  expect(screen.queryByText("Runs per week")).toBeNull();
});

it("reports deployment check evidence by commit when blocking checks exist", async () => {
  io.checks.mockResolvedValue([{ key: "smoke" }]);
  io.runs.mockImplementation(async (args: { select: Record<string, boolean> }) => args.select.sourceCommitSha
    ? [{ sourceCommitSha: "a" }, { sourceCommitSha: "b" }, { sourceCommitSha: null }]
    : [{ status: "completed", conclusion: "success", createdAt: new Date(), completedAt: new Date() }]);
  io.results.mockResolvedValue([{ checkKey: "smoke", releaseRef: "a", status: "passed" }, { checkKey: "smoke", releaseRef: "b", status: "failed" }]);
  render(await Page());
  expect(value("All blocking checks passed")).toBe("1 of 3");
  expect(value("A blocking check failed")).toBe("1");
  expect(io.results.mock.calls[0][0].where).toEqual({ organizationId: "org_insights", releaseRef: { in: ["a", "b"] } });
});

it("reports change failure rate from finished releases and their incidents", async () => {
  io.releases.mockResolvedValue([{ id: "r1", status: "deployed", actualDeployEnd: new Date() }, { id: "r2", status: "rolled_back", actualDeployEnd: new Date() }, { id: "r3", status: "deployed", actualDeployEnd: new Date() }, { id: "r4", status: "deployed", actualDeployEnd: new Date() }]);
  io.incidents.mockImplementation(async (args: { where: { releaseId?: unknown } }) => args.where.releaseId ? [{ releaseId: "r3" }] : []);
  render(await Page());
  expect(value("Change failure rate")).toBe("50%");
  expect(document.body.textContent).toContain("2 of 4 finished releases");
  expect(value("Deployed, then an incident")).toBe("1");
});

it("offers a release evidence download through a plain GET form", async () => {
  render(await Page());
  const form = screen.getByRole("button", { name: "Download evidence" }).closest("form")!;
  expect(form.getAttribute("action")).toBe("/api/control/releases/evidence-pack");
  expect(form.getAttribute("method")).toBe("get");
  expect((screen.getByLabelText(/Full commit SHA/) as HTMLInputElement).pattern).toBe("[0-9a-fA-F]{40}");
});

it("raises a stability early warning when recent releases fail far more often than before", async () => {
  const day = (d: number) => new Date(Date.now() - d * 86_400_000);
  io.releases.mockResolvedValue([
    { id: "r1", status: "failed", actualDeployEnd: day(1) }, { id: "r2", status: "rolled_back", actualDeployEnd: day(2) }, { id: "r3", status: "failed", actualDeployEnd: day(3) }, { id: "r4", status: "deployed", actualDeployEnd: day(4) },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, status: "deployed", actualDeployEnd: day(10 + i) })),
  ]);
  render(await Page());
  const section = screen.getByRole("heading", { name: /Stability early warning/ }).parentElement!;
  expect(section.textContent).toMatch(/Elevated: 3 of 4 releases in the last 7 days .*\(75%\), against 0% before\./);
});

it("counts deployments refused by release gates by reason", async () => {
  io.audit.mockResolvedValue([{ detailJson: { reason: "outside_change_window" } }, { detailJson: { reason: "outside_change_window" } }]);
  render(await Page());
  expect(value("Outside the change window")).toBe("2");
  expect(io.audit.mock.calls[0][0].where).toMatchObject({ organizationId: "org_insights", kind: "release.gate_refused" });
});

it("summarizes AI agent requests by decision and review lane", async () => {
  io.agentReqs.mockResolvedValue([{ status: "approved", reviewTriage: { lane: "auto" }, agentName: "cursor" }, { status: "pending", reviewTriage: { lane: "two_person" }, agentName: "claude-code" }]);
  render(await Page());
  expect(value("Agent requests")).toContain("2");
  expect(screen.getByText("By review lane: Allowed by policy 1 · Two approvers 1")).toBeTruthy();
});

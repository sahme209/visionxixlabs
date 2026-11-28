// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { BusinessOverview } from "../BusinessOverview";
import type { BusinessOverview as Data } from "@/lib/founder/founderBusiness";
afterEach(cleanup);

const data: Data = {
  generatedAt: new Date().toISOString(),
  revenue: { last30Cents: 6000, previous30Cents: 0, changePct: null, monthToDateCents: 6000, mrrListCents: 8700, paidWorkspaces: 1, bySource: [{ source: "AI credits and add-ons", cents: 6000 }], daily: [{ day: "2026-11-26", value: 1000 }, { day: "2026-11-27", value: 5000 }], topWorkspaces: [{ label: "Workspace …11b630", cents: 6000 }] },
  customers: { workspaces: 2, new30: 2, signupsWeekly: [{ week: "2026-11-20", count: 2 }], funnel: { steps: [{ label: "Workspaces", count: 2, pct: 100 }, { label: "Connected a repository", count: 1, pct: 50 }, { label: "Ran a deployment", count: 1, pct: 50 }, { label: "Active in the last 7 days", count: 1, pct: 50 }] }, atRisk: [{ label: "Workspace …abc123", reason: "Payment past due" }], retention: [{ cohortWeek: "2026-11-20", size: 2, retained: [100, 50, null] }] },
  ai: { calls30: 40, costCents: 140, billedCents: 260, marginPct: 46, byModel: [{ model: "anthropic/claude-sonnet-5.5", calls: 20, costCents: 60, billedCents: 122, marginPct: 51 }], byKind: [{ kind: "ai_invocation", calls: 26 }], topWorkspaces: [], pendingAgentRequests: 2 },
  product: null,
  support: { unanswered30: 4, unansweredDaily: [{ day: "2026-11-27", value: 1 }], topUnanswered: [{ topic: "connect gitlab", example: "How do I connect GitLab?", count: 3 }], leads30: 0, leadsBySource: [] },
};

describe("BusinessOverview", () => {
  it("shows the headline numbers, agent proposals and every section", () => {
    render(createElement(BusinessOverview, { data, autopilot: { paused: false, runs: [{ version: 4, summary: "Autopilot: marked 1 step live.", createdAt: new Date().toISOString() }] } }));
    expect(screen.getAllByText("$60.00").length).toBeGreaterThan(0);
    expect(screen.getByText("$87.00/mo")).toBeTruthy();
    expect(screen.getByText("46%")).toBeTruthy();
    const agents = screen.getByRole("region", { name: "Agents running the company" });
    expect(within(agents).getByText('Answer: "How do I connect GitLab?"')).toBeTruthy();
    expect(within(agents).getByText("Follow up with Workspace …abc123")).toBeTruthy();
    expect(within(agents).getByText("Autopilot: marked 1 step live.")).toBeTruthy();
    expect(within(agents).getByText(/2 customer agent requests are waiting/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Revenue per day, last 30 days: $60.00 in total" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Product feedback" })).getByRole("status").textContent).toContain("could not be read");
    const retention = screen.getByRole("table", { name: "Share of each weekly signup cohort active in each following week" });
    expect(retention.textContent).toContain("11-20");
    expect(retention.textContent).toContain("50%");
  });
  it("shows the path to the $2B goal from recorded revenue", () => {
    render(createElement(BusinessOverview, { data, autopilot: { paused: false, runs: [] } }));
    const g = screen.getByRole("region", { name: "Path to a $2B company" });
    expect(g.textContent).toContain("$1,764");
    expect(g.textContent).toContain("Not enough history");
    expect(g.textContent).toContain("$147 a month per paying workspace");
    expect(within(g).getAllByText("not at the current pace").length).toBe(4);
  });
  it("says when the autopilot is paused", () => {
    render(createElement(BusinessOverview, { data, autopilot: { paused: true, runs: [] } }));
    expect(screen.getByText(/The autopilot is paused/)).toBeTruthy();
  });
});

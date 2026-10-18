/** @vitest-environment jsdom */
import { createElement, Fragment, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { email: "fixture@example.test" } } }) }));
vi.mock("@/components/motion/Reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children) }));
vi.mock("@/components/motion/Stagger", () => ({ Stagger: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children) }));
import ResilienceDashboard from "@/app/dashboard/resilience/page";

const category = { score: 10, maxScore: 20, factors: [] };
const report = {
  reportId: "owned-report", resilienceScore: { total: 50, grade: "C", summary: "Synthetic analysis", categories: { cloudDependency: category, regionalRedundancy: category, backupAndReplication: category, securityExposure: category, monitoringAndRecovery: category } },
  currentState: { primaryProvider: "aws", providers: ["aws"], regions: ["us-east-1"], resourceCounts: {}, estimatedMonthlyCost: null },
  risks: [], recommendedArchitecture: { pattern: "active_passive", secondaryProvider: "azure", components: [], description: "Synthetic recommendation" },
  estimatedCostImpact: { currentMonthlyCost: null, additionalMonthlyCost: null, percentIncrease: null }, rto: "unverified", rpo: "unverified", nextSteps: [], aiAnalysis: "Synthetic read-only analysis",
};
const fetchMock = vi.fn();
let generatedStatus = "generating";
beforeEach(() => {
  window.localStorage.clear(); window.history.replaceState({}, "", "/dashboard/resilience?token=owned-token");
  generatedStatus = "generating"; fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), window.location.origin).pathname;
    if (path === "/api/connectors/status") return Response.json({ connectors: { aws: { status: "linked" } } });
    if (path === "/api/architecture/analyze") return Response.json(report);
    if (path === "/api/terraform/generate") return Response.json({ success: true, jobId: "legacy-job", files: ["main.tf"], status: generatedStatus, approvedAt: generatedStatus === "awaiting_approval" ? "2026-10-17T00:00:00Z" : null });
    throw new Error("unexpected_request_no_provider_fixture");
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(["generating", "planned", "awaiting_approval"])("actual Resilience page retains configuration generation without live authority from %s", async status => {
  generatedStatus = status; render(createElement(ResilienceDashboard));
  const analyze = screen.getByRole("button", { name: "Run Resilience Analysis" });
  await waitFor(() => expect((analyze as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(analyze);
  await screen.findByText("Synthetic read-only analysis");
  fireEvent.click(screen.getByRole("button", { name: /Generate (Deployment Plan|Terraform configuration)/ }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/terraform/generate"))).toBe(true));
  await screen.findByText(/(?:Infrastructure plan|Configuration draft) generated/);
  expect(screen.queryByRole("button", { name: /Preview Changes|Approve & Deploy|Deploy Standby Infrastructure/ })).toBeNull();
  expect(screen.getAllByText(/Live Terraform planning and approval are unavailable/).length).toBeGreaterThan(0);
  expect(screen.queryByRole("textbox", { name: /CONFIRM APPLY/ })).toBeNull();
  expect(screen.queryByText(/Plan approved\. Ready to deploy/)).toBeNull();
  expect(fetchMock.mock.calls.some(([url]) => /\/api\/terraform\/(plan|approve|apply)(?:\?|$)/.test(String(url)))).toBe(false);
  const generation = fetchMock.mock.calls.find(([url]) => String(url).includes("/api/terraform/generate"));
  expect(JSON.parse(generation?.[1].body)).toEqual({ readinessReportId: report.reportId });
});

it("shows unavailable authority even without a starter token or connected provider", () => {
  window.history.replaceState({}, "", "/dashboard/resilience"); render(createElement(ResilienceDashboard));
  expect(screen.getAllByText(/Live Terraform planning and approval are unavailable/).length).toBeGreaterThan(0);
  expect(fetchMock).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Run Resilience Analysis" }) as HTMLButtonElement).disabled).toBe(true);
});

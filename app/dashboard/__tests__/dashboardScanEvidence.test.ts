/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DashboardPage from "../page";
vi.mock("../RunScanButton", () => ({ RunScanButton: ({ onComplete }: { onComplete: () => void }) => createElement("button", { onClick: onComplete }, "Refresh scan evidence") }));
vi.mock("../DisconnectButton", () => ({ DisconnectButton: () => null }));
vi.mock("../ConnectionHealth", () => ({ ConnectionHealth: () => null }));
vi.mock("../RecentActivity", () => ({ RecentActivity: () => null }));
vi.mock("../Sparkline", () => ({ Sparkline: () => null }));
vi.mock("@/components/workforce/AxiomBootSequence", () => ({ AxiomBootSequence: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const summary = (lastScanIso: string | null) => ({ ok: true, findingCount: 0, pendingApprovals: 0, highRiskApprovals: 0, monthlyLow: 0, monthlyHigh: 0, lastScanIso, findingsTrend7d: [], scansTrend7d: [] });
function transport(status: string, body: unknown, httpOk = true) {
 vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: url.includes("connectors/status") || httpOk, json: async () => url.includes("connectors/status") ? { ok: true, connectors: [{ provider: "aws", status }] } : body })));
}
it.each(["connected", "linked"])("does not infer validation or a scan from a %s cloud", async (status) => {
 transport(status, summary(null)); render(createElement(DashboardPage));
 expect(await screen.findByText(/No completed scan is recorded/)).toBeDefined();
 expect(await screen.findByText(/step.02 — run your first scan/)).toBeDefined();
 expect(screen.queryByText("Review recorded scan history")).toBeNull();
});
it("reports a completed scan without asserting snapshot persistence or a clean result", async () => {
 transport("connected", summary("2026-10-20T12:00:00Z")); render(createElement(DashboardPage));
 expect(await screen.findByText("Review recorded scan history")).toBeDefined();
 expect(screen.getByText(/Review connection checks and saved results separately/)).toBeDefined();
 expect(screen.queryByText(/Clean —/)).toBeNull();
});
it("rejects a malformed completed timestamp", async () => {
 transport("linked", summary("not-a-date")); render(createElement(DashboardPage));
 expect(await screen.findByText(/No completed scan is recorded/)).toBeDefined();
 expect(screen.queryByText("Review recorded scan history")).toBeNull();
});
it.each(["http", "envelope", "network", "migration"])("clears previously successful evidence after %s failure", async (failure) => {
 transport("connected", summary("2026-10-20T12:00:00Z")); render(createElement(DashboardPage));
 await screen.findByText("Review recorded scan history");
 if (failure === "network") vi.stubGlobal("fetch", vi.fn(async () => { throw Error("offline"); }));
 else transport("connected", failure === "envelope" ? { ok: false } : failure === "migration" ? { ...summary(null), migrationPending: true } : summary(null), failure !== "http");
 fireEvent.click(screen.getAllByRole("button", { name: "Refresh scan evidence" })[0]);
 expect(await screen.findByText(/Scan status unavailable/)).toBeDefined();
 expect(screen.queryByText("Review recorded scan history")).toBeNull();
});

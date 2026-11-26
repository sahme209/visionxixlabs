/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ signals: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { releaseSignals: m.signals } }));
import { ReleaseHealthPanel } from "../../../desktop/src/components/ReleaseHealthPanel";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("ReleaseHealthPanel", () => {
  it("checks release health for the release name and commit and shows the verdict with reasons", async () => {
    m.signals.mockResolvedValue({ ok: true, data: { release: "v1.4.0", incidents: { pagerduty: 1, opsgenie: null }, newIssues: [], monitors: { alerting: 1, warning: 0, ok: 2, noData: 0 }, staleFlags: ["new-checkout"], unavailable: ["opsgenie"], verification: { verdict: "unhealthy", reasons: ["1 monitor is alerting."], missing: ["Verify-stage check results"] } } });
    render(createElement(ReleaseHealthPanel, { defaultRelease: "v1.4.0", commit: "a".repeat(40) }));
    fireEvent.click(screen.getByRole("button", { name: "Check release health" }));
    await waitFor(() => expect(screen.getByText("Unhealthy")).toBeTruthy());
    expect(m.signals).toHaveBeenCalledWith("v1.4.0", "a".repeat(40));
    expect(screen.getByText("1 monitor is alerting.")).toBeTruthy();
    expect(screen.getByText("Open incidents: PagerDuty 1")).toBeTruthy();
    expect(screen.getByText(/new-checkout/)).toBeTruthy();
    expect(screen.getByText("Not available: Verify-stage check results.")).toBeTruthy();
  });
  it("explains a bad release name", async () => {
    m.signals.mockResolvedValue({ ok: false, error: "invalid_query" });
    render(createElement(ReleaseHealthPanel, { defaultRelease: "bad name", commit: null }));
    fireEvent.click(screen.getByRole("button", { name: "Check release health" }));
    await waitFor(() => expect(screen.getByText(/Use the release name/)).toBeTruthy());
  });
});

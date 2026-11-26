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
  const unhealthy = { ok: true, data: { release: "v1.4.0", incidents: { pagerduty: null, opsgenie: null }, newIssues: [], monitors: null, staleFlags: [], unavailable: [], verification: { verdict: "unhealthy", reasons: ["2 new errors."], missing: [] } } };
  it("offers to prepare a rollback to the last good version when the release is unhealthy", async () => {
    m.signals.mockResolvedValue(unhealthy);
    const prepare = vi.fn();
    render(createElement(ReleaseHealthPanel, { defaultRelease: "v1.4.0", commit: null, rollback: { commit: "b".repeat(40), prepare } }));
    fireEvent.click(screen.getByRole("button", { name: "Check release health" }));
    fireEvent.click(await screen.findByRole("button", { name: `Prepare rollback to ${"b".repeat(12)}` }));
    expect(prepare).toHaveBeenCalledTimes(1);
  });
  it("says when there is nothing to roll back to, and offers nothing for a healthy release", async () => {
    m.signals.mockResolvedValue(unhealthy);
    render(createElement(ReleaseHealthPanel, { defaultRelease: "v1.4.0", commit: null }));
    fireEvent.click(screen.getByRole("button", { name: "Check release health" }));
    expect(await screen.findByText("No earlier good version is recorded here to roll back to.")).toBeTruthy();
    cleanup();
    m.signals.mockResolvedValue({ ...unhealthy, data: { ...unhealthy.data, verification: { verdict: "healthy", reasons: [], missing: [] } } });
    render(createElement(ReleaseHealthPanel, { defaultRelease: "v1.4.0", commit: null, rollback: { commit: "b".repeat(40), prepare: vi.fn() } }));
    fireEvent.click(screen.getByRole("button", { name: "Check release health" }));
    await screen.findByText("Healthy");
    expect(screen.queryByRole("button", { name: /Prepare rollback/ })).toBeNull();
  });
});

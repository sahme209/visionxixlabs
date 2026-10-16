/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { VerifiedDesktopIdentity } from "../../../desktop/src/lib/desktopClient";
const mocks = vi.hoisted(() => ({ usage: vi.fn(), portal: vi.fn(), preferences: vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../../desktop/src/lib/preferences", () => ({ readDesktopPreferences: mocks.preferences, writeDesktopPreferences: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { usageSummary: mocks.usage, desktopBillingPortal: mocks.portal } }));
import { SettingsView } from "../../../desktop/src/views/SettingsView";
function identity(planTier: string, billingStatus: string, allowed = true): VerifiedDesktopIdentity {
  return { kind: "desktop_session", organizationId: "synthetic-workspace", role: "owner", capabilities: [], access: { allowed, code: "active", title: "Access active", message: "This workspace has access.", planTier, billingStatus, pricingPath: "/plans", accessRequestPath: "/contact" } };
}
async function showPlan(value: VerifiedDesktopIdentity) {
  render(createElement(SettingsView, { identity: value }));
  fireEvent.click(screen.getByRole("button", { name: "Plan & usage" }));
  await screen.findByText("AI invocations");
}
beforeEach(() => { vi.resetAllMocks(); mocks.preferences.mockResolvedValue(null); mocks.usage.mockResolvedValue({ ok: true, data: { periodMonth: "2026-10", aiInvocationCount: 0, aiInputTokens: 0, aiOutputTokens: 0, aiCostCents: 0 } }); });
afterEach(cleanup);
describe("actual desktop billing status presentation", () => {
  it("does not turn current identity-only no-plan DTO into trial or paid approval", async () => {
    const value = identity("trial", "no_plan"); await showPlan(value);
    expect(screen.getByText("No subscription", { exact: true })).toBeTruthy();
    expect(screen.getByText("No plan", { exact: true })).toBeTruthy();
    expect(screen.getByText(/Identity sign-in is active/)).toBeTruthy();
    expect(screen.queryByText("Trial access is active")).toBeNull(); expect(screen.queryByText("No-charge trial")).toBeNull();
    expect(screen.queryByText(/This workspace has approved no-charge access/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Open billing" })).toBeNull();
    expect(value.access.allowed).toBe(true); expect(mocks.portal).not.toHaveBeenCalled();
  });
  it.each([["trial", "trialing", "Trial access is active"], ["pilot", "active", "Pilot access is active"]])("preserves explicitly supported no-charge state %s/%s", async (tier, status, label) => {
    await showPlan(identity(tier, status)); expect(screen.getByText(label)).toBeTruthy();
  });
  it.each(["active", "past_due", "canceled"])("does not manufacture trial approval from legacy tier with status %s", async status => {
    await showPlan(identity("trial", status)); expect(screen.queryByText("Trial access is active")).toBeNull(); expect(screen.queryByText("No-charge trial")).toBeNull();
  });
  it("preserves legacy paid tier without silently calling it canonical Pro", async () => {
    await showPlan(identity("growth", "active")); expect(screen.getByText("growth", { exact: true })).toBeTruthy(); expect(screen.queryByText("Pro", { exact: true })).toBeNull(); expect(screen.getByRole("button", { name: "Open billing" })).toBeTruthy();
  });
});

/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ setWindow: vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", async (orig) => {
  const actual = await orig<typeof import("../../../desktop/src/lib/desktopClient")>();
  return { ...actual, desktopClient: Object.assign(Object.create(Object.getPrototypeOf(actual.desktopClient)), actual.desktopClient, { setEnvironmentChangeWindow: m.setWindow }) };
});
import { EnvironmentChangeWindowEditor } from "../../../desktop/src/views/SettingsView";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const now = new Date("2026-11-26T12:00:00Z"); // Thursday
const env = (changeWindowRule: unknown) => ({ id: "e1", slug: "prod", name: "Prod", tier: "prod", displayOrder: 1, hasApprovalPolicy: false, tags: [], changeWindowRule });
describe("EnvironmentChangeWindowEditor", () => {
  it("shows the current state and saves the rule with the rule it read", async () => {
    const stored = { weekdays: ["Thu"], utcWindows: [{ start: "22:00", end: "02:00" }] };
    m.setWindow.mockResolvedValue({ ok: true, data: { id: "e1", changeWindowRule: null } });
    const onSaved = vi.fn();
    render(createElement(EnvironmentChangeWindowEditor, { environment: env(stored), onSaved, now }));
    expect(screen.getByText(/Closed now\. Next opening Thu, 26 Nov 2026 22:00 UTC\./)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Windows in UTC/), { target: { value: "nine to five" } });
    expect((screen.getByRole("button", { name: "Save change window" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Windows in UTC/), { target: { value: "09:00-17:00" } });
    fireEvent.click(screen.getByLabelText("Mon"));
    fireEvent.change(screen.getByLabelText(/Freezes/), { target: { value: "2026-12-20 to 2027-01-02: Holiday freeze" } });
    fireEvent.click(screen.getByRole("button", { name: "Save change window" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(m.setWindow).toHaveBeenCalledWith("e1", { weekdays: ["Mon", "Thu"], utcWindows: [{ start: "09:00", end: "17:00" }], freezes: [{ startUtc: "2026-12-20T00:00:00.000Z", endUtc: "2027-01-02T00:00:00.000Z", reason: "Holiday freeze" }] }, stored);
  });
  it("explains no rule, a freeze, an unreadable rule and a concurrent change", async () => {
    render(createElement(EnvironmentChangeWindowEditor, { environment: env(null), onSaved: vi.fn(), now }));
    expect(screen.getByText(/No window set/)).toBeTruthy();
    cleanup();
    render(createElement(EnvironmentChangeWindowEditor, { environment: env({ freezes: [{ startUtc: "2026-11-26T00:00:00Z", endUtc: "2026-11-28T00:00:00Z", reason: "Peak sale" }] }), onSaved: vi.fn(), now }));
    expect(screen.getByText(/Frozen: Peak sale/)).toBeTruthy();
    cleanup();
    render(createElement(EnvironmentChangeWindowEditor, { environment: env({ utcWindows: "bad" }), onSaved: vi.fn(), now }));
    expect(screen.getByText(/cannot be read/)).toBeTruthy();
    m.setWindow.mockResolvedValue({ ok: false, error: "change_window_changed" });
    fireEvent.click(screen.getByRole("button", { name: "Save change window" }));
    expect(await screen.findByText(/Someone changed this window/)).toBeTruthy();
  });
});

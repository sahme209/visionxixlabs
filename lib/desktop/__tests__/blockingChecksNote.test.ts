/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
import { BlockingChecksNote } from "../../../desktop/src/views/SettingsView";

afterEach(cleanup);
const checks = [{ key: "m", name: "Migration dry run", kind: "migration_dry_run", stage: "validate", enforced: true }, { key: "h", name: "Error rate", kind: "health_check", stage: "approve", enforced: false }];
describe("BlockingChecksNote", () => {
  it("lists the checks that must pass for the resolved commit and marks unenforced ones", () => {
    render(createElement(BlockingChecksNote, { checks, commit: "0123456789abcdef0123456789abcdef01234567", bypass: false }));
    expect(screen.getByLabelText("Blocking deployment checks").textContent).toContain("for 0123456789ab within the last 72 hours");
    expect(screen.getByText(/Approve · health check · not enforced yet/)).toBeTruthy();
  });
  it("explains the bypass, fails closed when unavailable, and stays silent with no checks", () => {
    const { rerender, container } = render(createElement(BlockingChecksNote, { checks, commit: null, bypass: true }));
    expect(screen.getByText(/emergency bypass skips these blocking checks/)).toBeTruthy();
    rerender(createElement(BlockingChecksNote, { checks: "unavailable", commit: null, bypass: false }));
    expect(screen.getByText(/Dispatch is refused until they can be checked/)).toBeTruthy();
    rerender(createElement(BlockingChecksNote, { checks: [], commit: null, bypass: false }));
    expect(container.textContent).toBe("");
  });
});

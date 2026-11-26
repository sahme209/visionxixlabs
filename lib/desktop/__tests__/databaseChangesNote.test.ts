/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
import { DatabaseChangesNote } from "../../../desktop/src/views/SettingsView";

afterEach(cleanup);
describe("DatabaseChangesNote", () => {
  it("warns with the migration files when they changed since the last deployment", () => {
    render(createElement(DatabaseChangesNote, { evidence: { status: "detected", since: "a".repeat(40), paths: ["prisma/migrations/x/migration.sql"], truncated: true } }));
    expect(screen.getByLabelText("Database changes").textContent).toContain("changes database migrations since the last successful deployment here (aaaaaaaaaaaa)");
    expect(screen.getByText("prisma/migrations/x/migration.sql")).toBeTruthy();
    expect(screen.getByText(/at most 300 files/)).toBeTruthy();
  });
  it("is honest when nothing could be compared", () => {
    const { rerender } = render(createElement(DatabaseChangesNote, { evidence: { status: "first_deployment" } }));
    expect(screen.getByText(/could not be compared/)).toBeTruthy();
    rerender(createElement(DatabaseChangesNote, { evidence: { status: "unknown", reason: "compare_unavailable" } }));
    expect(screen.getByText("Database changes could not be compared for this commit.")).toBeTruthy();
  });
});

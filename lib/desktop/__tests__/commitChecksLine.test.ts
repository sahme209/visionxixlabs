/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ summarize: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { summarizeCommitChecks: m.summarize } }));
import { CommitChecksLine } from "../../../desktop/src/components/CommitChecksLine";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const sha = "a".repeat(40);
describe("CommitChecksLine", () => {
  it("summarizes blocking check results for the exact commit", async () => {
    m.summarize.mockResolvedValue({ ok: true, data: { commits: { [sha]: { total: 3, passed: 2, failed: 0, missing: 1 } } } });
    render(createElement(CommitChecksLine, { sha }));
    await waitFor(() => expect(screen.getByLabelText("Deployment checks for this commit").textContent).toContain("2 of 3 blocking checks passed; 1 not reported"));
    expect(m.summarize).toHaveBeenCalledWith([sha]);
  });
  it("shows nothing without checks, on errors, or for an invalid commit", async () => {
    m.summarize.mockResolvedValue({ ok: true, data: { commits: { [sha]: { total: 0, passed: 0, failed: 0, missing: 0 } } } });
    const { container, rerender } = render(createElement(CommitChecksLine, { sha }));
    await waitFor(() => expect(m.summarize).toHaveBeenCalled());
    expect(container.textContent).toBe("");
    rerender(createElement(CommitChecksLine, { sha: "abc" }));
    expect(container.textContent).toBe("");
  });
});

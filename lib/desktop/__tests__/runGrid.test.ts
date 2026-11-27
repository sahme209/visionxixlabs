/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RunGrid } from "../../../desktop/src/components/RunGrid";
afterEach(() => cleanup());
describe("RunGrid", () => {
  it("labels every square, counts by state and opens selectable runs", () => {
    const open = vi.fn();
    render(createElement(RunGrid, { label: "Runs", items: [
      { key: "a", label: "acme/web@v1", tone: "green", stateLabel: "Success" },
      { key: "b", label: "acme/web@v2", tone: "red", stateLabel: "Failure", onSelect: open },
    ] }));
    const fig = screen.getByRole("figure", { name: "Runs" });
    expect(screen.getByRole("img", { name: "acme/web@v1: Success" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "acme/web@v2: Failure" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(fig.textContent).toContain("Succeeded 1");
    expect(fig.textContent).toContain("Failed 1");
    expect(fig.textContent).not.toContain("Running");
  });
});

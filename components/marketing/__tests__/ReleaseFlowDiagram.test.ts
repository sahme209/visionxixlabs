// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReleaseFlowDiagram, RELEASE_FLOW } from "../ReleaseFlowDiagram";
afterEach(cleanup);
describe("ReleaseFlowDiagram", () => {
  it("shows the first stage, switches on click and with arrow keys", () => {
    render(createElement(ReleaseFlowDiagram));
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(RELEASE_FLOW.map((s) => s.label));
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("change passport");
    fireEvent.click(tabs[3]);
    expect(screen.getByRole("tabpanel").textContent).toContain("Change window and freezes");
    fireEvent.keyDown(tabs[3], { key: "ArrowRight" });
    expect(screen.getAllByRole("tab")[4].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getAllByRole("tab")[4]);
    fireEvent.keyDown(screen.getAllByRole("tab")[4], { key: "Home" });
    expect(screen.getAllByRole("tab")[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getAllByRole("tab")[0], { key: "ArrowLeft" });
    expect(screen.getAllByRole("tab")[0].getAttribute("aria-selected")).toBe("true");
  });
});

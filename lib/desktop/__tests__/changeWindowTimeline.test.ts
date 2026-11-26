/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChangeWindowTimeline } from "../../../desktop/src/components/ChangeWindowTimeline";
afterEach(cleanup);
const window = { startUtc: "2026-11-26T10:00:00Z", endUtc: "2026-11-26T12:00:00Z", displayTimeZone: "UTC" };
it("shows an open window with time left and never implies approval", () => {
  render(createElement(ChangeWindowTimeline, { window, now: new Date("2026-11-26T11:15:00Z") }));
  const region = screen.getByRole("region", { name: "Change window" });
  expect(region.getAttribute("data-phase")).toBe("open");
  expect(region.textContent).toContain("Open now · closes in 45m");
  expect(region.textContent).toContain("does not approve a deployment");
});
it("counts down to an upcoming window and marks an ended one", () => {
  const { rerender } = render(createElement(ChangeWindowTimeline, { window, now: new Date("2026-11-26T07:00:00Z") }));
  expect(screen.getByText("Opens in 3h")).toBeTruthy();
  rerender(createElement(ChangeWindowTimeline, { window, now: new Date("2026-11-27T00:00:00Z") }));
  expect(screen.getByText("Window ended")).toBeTruthy();
});

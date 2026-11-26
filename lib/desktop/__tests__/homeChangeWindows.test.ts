/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { UpcomingChangeWindows } from "../../../desktop/src/views/WelcomeView";
afterEach(() => { cleanup(); vi.useRealTimers(); });
const row = (id: string, status: string, start: string, end: string) => ({ id, version: 2, title: `Release ${id}`, status, updatedAt: start, environment: "staging", window: { startUtc: start, endUtc: end, displayTimeZone: "UTC" } });

it("lists open windows first, then upcoming ones, skipping ended and closed releases", () => {
  vi.useFakeTimers({ now: new Date("2026-11-26T10:30:00Z") });
  const open = vi.fn();
  render(createElement(UpcomingChangeWindows, { onOpen: open, rows: [
    row("later", "submitted", "2026-11-26T14:00:00Z", "2026-11-26T15:00:00Z"),
    row("now", "submitted", "2026-11-26T10:00:00Z", "2026-11-26T11:00:00Z"),
    row("ended", "submitted", "2026-11-25T10:00:00Z", "2026-11-25T11:00:00Z"),
    row("closed", "closed", "2026-11-26T10:00:00Z", "2026-11-26T12:00:00Z"),
  ] }));
  const items = within(screen.getByRole("region", { name: "Change windows" })).getAllByRole("button");
  expect(items.map((b) => b.getAttribute("aria-label"))).toEqual([
    "Release now, version 2: window open, closes in 30m",
    "Release later, version 2: window opens in 3h 30m",
  ]);
  fireEvent.click(items[0]);
  expect(open).toHaveBeenCalledWith({ id: "now", version: 2 });
});

it("renders nothing without a current or upcoming window", () => {
  const { container } = render(createElement(UpcomingChangeWindows, { onOpen: vi.fn(), rows: [] }));
  expect(container.firstChild).toBeNull();
});

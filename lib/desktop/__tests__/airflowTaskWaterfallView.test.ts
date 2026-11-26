/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AirflowTaskWaterfall } from "../../../desktop/src/components/AirflowTaskWaterfall";
afterEach(cleanup);
it("draws one bar per timed task with its duration, and marks a task without a recorded end as open", () => {
  render(createElement(AirflowTaskWaterfall, { tasks: [
    { taskId: "extract", mapIndex: -1, tryNumber: 1, state: "success", startedAt: "2026-11-17T10:00:00Z", endedAt: "2026-11-17T10:01:30Z" },
    { taskId: "publish", mapIndex: -1, tryNumber: 1, state: "running", startedAt: "2026-11-17T10:01:30Z", endedAt: null },
  ] }));
  const figure = screen.getByRole("figure", { name: "Observed task timing" });
  const rows = within(figure).getAllByRole("listitem");
  expect(rows[0].textContent).toContain("1m 30s");
  expect(rows[1].textContent).toContain("open");
  expect(rows[1].getAttribute("data-tone")).toBe("blue");
});
it("stays out of the way for a single task", () => {
  const { container } = render(createElement(AirflowTaskWaterfall, { tasks: [{ taskId: "a", mapIndex: -1, tryNumber: 1, state: "success", startedAt: "2026-11-17T10:00:00Z", endedAt: "2026-11-17T10:01:00Z" }] }));
  expect(container.firstChild).toBeNull();
});

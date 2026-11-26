/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RecordedReleaseEvents } from "../../../desktop/src/components/RecordedReleaseEvents";
afterEach(cleanup);
const labels = { started: "Execution started", observed: "Workflow observed", finished: "Execution finished" } as const;

it("shows elapsed time from the first recorded step and the total span", async () => {
  const read = () => Promise.resolve({ ok: true as const, data: { events: [
    { type: "started" as const, at: "2026-11-17T10:00:00.000Z" },
    { type: "observed" as const, at: "2026-11-17T10:00:45.000Z" },
    { type: "finished" as const, at: "2026-11-17T10:06:10.000Z" },
  ] } });
  render(createElement(RecordedReleaseEvents<keyof typeof labels>, { subject: "deployment execution", labels, read }));
  fireEvent.click(screen.getByRole("button", { name: "Load deployment execution history" }));
  const list = await screen.findByRole("list", { name: "Recorded deployment execution events" });
  const items = within(list).getAllByRole("listitem");
  expect(items[0].querySelector(".recorded-release-event-elapsed")).toBeNull();
  expect(items[1].textContent).toContain("+45s");
  expect(items[2].textContent).toContain("+6m 10s");
  expect(items[2].getAttribute("data-last")).toBe("true");
  expect(screen.getByText("3 recorded steps over 6m 10s")).toBeTruthy();
});

it("does not invent elapsed time for a single event", async () => {
  const read = () => Promise.resolve({ ok: true as const, data: { events: [{ type: "started" as const, at: "2026-11-17T10:00:00.000Z" }] } });
  render(createElement(RecordedReleaseEvents<keyof typeof labels>, { subject: "deployment execution", labels, read }));
  fireEvent.click(screen.getByRole("button", { name: "Load deployment execution history" }));
  await screen.findByRole("list", { name: "Recorded deployment execution events" });
  expect(screen.queryByText(/recorded steps over/)).toBeNull();
  expect(document.querySelector(".recorded-release-event-elapsed")).toBeNull();
});

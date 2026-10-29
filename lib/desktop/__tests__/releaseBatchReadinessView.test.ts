/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const io = vi.hoisted(() => ({ read: vi.fn(), config: {} }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { releaseBatchReadiness: io.read, get config() { return io.config; }, subscribeContext: () => () => {}, getContextRevision: () => 0 } }));
import { ReleaseBatchReadiness } from "../../../desktop/src/components/ReleaseBatchReadiness";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("shows only actual version-bound completion after an explicit read", async () => {
  io.read.mockResolvedValue({ ok: true, data: { ready: true, requestVersion: 3 } });
  render(createElement(ReleaseBatchReadiness, { requestId: "release", version: 3, count: 2 })); expect(io.read).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Check batches")); await screen.findByText("Selected batches completed. Release approval is still required.");
  expect(io.read).toHaveBeenCalledWith("release", 3);
});
it("discards an old release version response", async () => {
  let resolve!:(value:unknown)=>void; io.read.mockReturnValue(new Promise(r => resolve = r));
  const view = render(createElement(ReleaseBatchReadiness, { requestId: "release", version: 3, count: 2 })); fireEvent.click(screen.getByText("Check batches"));
  view.rerender(createElement(ReleaseBatchReadiness, { requestId: "release", version: 4, count: 2 }));
  await act(async () => resolve({ ok: true, data: { ready: true, requestVersion: 3 } })); expect(screen.queryByText(/Selected batches completed/)).toBeNull();
  expect((screen.getByText("Check batches") as HTMLButtonElement).disabled).toBe(false);
});
it("never presents a mismatched ready version as completed", async () => {
  io.read.mockResolvedValue({ ok: true, data: { ready: true, requestVersion: 2 } }); render(createElement(ReleaseBatchReadiness, { requestId: "release", version: 3, count: 1 }));
  fireEvent.click(screen.getByText("Check batches")); await screen.findByText("Batch completion could not be verified.");
});

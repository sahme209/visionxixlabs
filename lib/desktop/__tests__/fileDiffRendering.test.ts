/** @vitest-environment jsdom */
import {createElement} from "react";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, expect, it} from "vitest";
import {FileDiff} from "../../../desktop/src/components/FileDiff";
afterEach(cleanup);
it("bounds rendered rows and labels incomplete display without losing total counts", () => {
  render(createElement(FileDiff, {before: "original", after: Array.from({length: 2500}, (_, i) => `line-${i}`).join("\n")}));
  expect(screen.getByText("+2500")).toBeTruthy();
  expect(screen.getByText("line-100")).toBeTruthy();
  expect(screen.queryByText("line-2499")).toBeNull();
  expect(screen.getByText(/Diff display limited/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Next diff page"}));
  expect(screen.getByText("line-2499")).toBeTruthy();
  expect(screen.queryByText("line-100")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Previous diff page"}));
  expect(screen.getByText("line-100")).toBeTruthy();
});

it("resets to the first page when the source changes", () => {
  const after = Array.from({length: 2500}, (_, i) => `line-${i}`).join("\n");
  const view = render(createElement(FileDiff, {before: "old", after}));
  fireEvent.click(screen.getByRole("button", {name: "Next diff page"}));
  expect(screen.getByText("line-2499")).toBeTruthy();
  view.rerender(createElement(FileDiff, {before: "changed baseline", after}));
  expect(screen.getByText("line-100")).toBeTruthy();
  expect(screen.queryByText("line-2499")).toBeNull();
});

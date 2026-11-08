// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ControlPlaneModel } from "../ControlPlaneModel";

afterEach(() => cleanup());

it("labels itself as illustrative and lists every stage, titled part and passed-on packet", () => {
  render(createElement(ControlPlaneModel));
  expect(screen.getByText(/Illustrative model · architecture, not a live system/)).toBeTruthy();
  expect(screen.getByRole("heading", { level: 2, name: "Inside the Axiom control plane" })).toBeTruthy();
  const stages = within(screen.getByRole("list", { name: "Control-plane layers" })).getAllByRole("listitem");
  expect(stages).toHaveLength(5);
  expect(stages[0].textContent).toMatch(/Interfaces/);
  expect(stages[0].textContent).toMatch(/Passes on: signed request/);
  expect(stages[3].textContent).toMatch(/AI Gateway/);
  expect(stages[3].textContent).toMatch(/Credit hold/);
  expect(stages[4].textContent).not.toMatch(/Passes on:/);
});

it("opens the chosen stage in the detail panel", () => {
  render(createElement(ControlPlaneModel));
  fireEvent.click(within(screen.getByRole("list", { name: "Control-plane layers" })).getByRole("button", { name: /Intelligence/ }));
  const detail = screen.getByRole("region", { name: "Intelligence" });
  expect(detail.textContent).toMatch(/never charged beyond prepaid/);
  expect(detail.textContent).toMatch(/plan \+ settled credit/);
});

it("lets visitors pause the flow", () => {
  render(createElement(ControlPlaneModel));
  const pause = screen.getByRole("button", { name: "Pause flow" });
  fireEvent.click(pause);
  expect(screen.getByRole("button", { name: "Play flow" }).getAttribute("aria-pressed")).toBe("true");
});

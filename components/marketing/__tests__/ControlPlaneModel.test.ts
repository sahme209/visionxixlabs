// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ControlPlaneModel } from "../ControlPlaneModel";

afterEach(() => cleanup());

it("labels itself as illustrative and lists every layer with its titled parts without WebGL", () => {
  render(createElement(ControlPlaneModel));
  expect(screen.getByText(/Illustrative model · architecture, not a live system/)).toBeTruthy();
  expect(screen.getByRole("heading", { level: 2, name: "Inside the Axiom control plane" })).toBeTruthy();
  const layers = within(screen.getByRole("list", { name: "Control-plane layers" })).getAllByRole("listitem");
  expect(layers).toHaveLength(5);
  expect(layers[0].textContent).toMatch(/Interfaces/);
  expect(layers[3].textContent).toMatch(/AI Gateway · Credit hold · Settle to usage/);
});

it("opens the chosen layer in the inspector", () => {
  render(createElement(ControlPlaneModel));
  fireEvent.click(within(screen.getByRole("group", { name: "Choose a layer" })).getByRole("button", { name: /Intelligence/ }));
  const inspector = screen.getByRole("region", { name: "Intelligence" });
  expect(inspector.textContent).toMatch(/never charged beyond prepaid/);
  expect(within(inspector).getByRole("heading", { level: 4, name: "Credit hold" })).toBeTruthy();
});

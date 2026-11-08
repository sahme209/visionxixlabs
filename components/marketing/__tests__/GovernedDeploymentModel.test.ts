// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GovernedDeploymentModel } from "../GovernedDeploymentModel";

afterEach(() => cleanup());

it("labels itself as illustrative and explains the whole flow without WebGL", () => {
  render(createElement(GovernedDeploymentModel));
  expect(screen.getByText(/Illustrative model · not a live deployment/)).toBeTruthy();
  expect(screen.getByRole("heading", { level: 2, name: "How a governed deployment moves through Axiom" })).toBeTruthy();
  const stages = within(screen.getByRole("list", { name: "Stages in this scenario" })).getAllByRole("listitem");
  expect(stages).toHaveLength(8);
  expect(stages[7].textContent).toMatch(/Audit and recovery/);
  expect(stages[7].textContent).toMatch(/Passed|In progress/);
});

it("shows where a failed scan stops, in text as well as color", () => {
  render(createElement(GovernedDeploymentModel));
  fireEvent.click(screen.getByRole("button", { name: "Failed scan" }));
  expect(screen.getByRole("button", { name: "Failed scan" }).getAttribute("aria-pressed")).toBe("true");
  const stages = within(screen.getByRole("list", { name: "Stages in this scenario" })).getAllByRole("listitem");
  expect(stages[2].textContent).toMatch(/Blocked/);
  expect(stages[3].textContent).toMatch(/Not reached/);
  expect(screen.getByText(/stops before anyone is asked to approve/)).toBeTruthy();
  const log = screen.getByRole("log");
  expect(log.textContent).toMatch(/readiness\.blocked/);
  expect(log.textContent).not.toMatch(/approval\.granted/);
});

it("inspects any stage with its internals, guarantee and failure branch", () => {
  render(createElement(GovernedDeploymentModel));
  const group = screen.getByRole("group", { name: "Inspect a stage" });
  fireEvent.click(within(group).getByRole("button", { name: /Execute/ }));
  const inspector = screen.getByRole("region", { name: "Execute" });
  expect(within(inspector).getByText(/Terraform apply is not available/)).toBeTruthy();
  expect(within(inspector).getByText(/never assumed successful/)).toBeTruthy();
  expect(within(group).getByRole("button", { name: /Execute/ }).getAttribute("aria-pressed")).toBe("true");
});

it("does not offer play controls when no 3D scene is running", () => {
  render(createElement(GovernedDeploymentModel));
  expect(screen.queryByRole("button", { name: /Pause model|Play model/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Overview" })).toBeNull();
});

it("settles AI credit in the gauges even when the request is rejected", () => {
  render(createElement(GovernedDeploymentModel));
  fireEvent.click(screen.getByRole("button", { name: "Rejected" }));
  expect(screen.getByText("AI credit settled")).toBeTruthy();
  expect(screen.getByText("$0.18")).toBeTruthy();
  expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
});

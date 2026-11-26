/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DataBoundaryDiagram } from "../DataBoundaryDiagram";
afterEach(cleanup);

it("shows that offline AI keeps Agent calls in your environment while connectors still leave it", () => {
  render(createElement(DataBoundaryDiagram));
  expect(screen.getByRole("tabpanel").textContent).toContain("Leaves your machine");
  fireEvent.click(screen.getByRole("radio", { name: "Offline AI (customer-hosted)" }));
  expect(screen.getByRole("tabpanel").textContent).toContain("Stays in your environment");
  expect(screen.getByRole("tabpanel").textContent).toContain("Cloud fallback and Gateway discovery are refused");
  fireEvent.click(screen.getByRole("tab", { name: "Scoped provider calls" }));
  expect(screen.getByRole("tabpanel").textContent).toContain("Offline AI does not make these calls local");
});

it("removes the provider path when connectors are switched off", () => {
  render(createElement(DataBoundaryDiagram));
  fireEvent.click(screen.getByRole("checkbox", { name: "Connected providers" }));
  expect(screen.queryByRole("tab", { name: "Scoped provider calls" })).toBeNull();
  expect(screen.getAllByRole("tab")).toHaveLength(2);
});

it("treats workspace records as staying in your environment only for an offline installation", () => {
  render(createElement(DataBoundaryDiagram));
  fireEvent.click(screen.getByRole("tab", { name: "Sign-in and workspace records" }));
  expect(screen.getByRole("tabpanel").textContent).toContain("Leaves your machine");
  fireEvent.click(screen.getByRole("radio", { name: "Offline AI (customer-hosted)" }));
  fireEvent.click(screen.getByRole("tab", { name: "Sign-in and workspace records" }));
  expect(screen.getByRole("tabpanel").textContent).toContain("operated in your environment");
});

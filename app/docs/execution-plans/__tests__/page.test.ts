/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ExecutionPlansPage from "../page";

// A redirect cannot satisfy the documentation index's promised plan reference.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
afterEach(cleanup);

it("provides the promised saved-plan article with four distinct authority stages", () => {
  render(createElement(ExecutionPlansPage));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Understand a saved plan.");
  for (const label of ["Saved plan", "Independent review", "Execution attempt", "Verified outcome"])
    expect(screen.getByRole("heading", { name: label })).toBeTruthy();
});

it("preserves expiry and unknown-outcome boundaries without offering an action", () => {
  const { container } = render(createElement(ExecutionPlansPage));
  const text = container.textContent ?? "";
  for (const phrase of ["depends on the installed version and supported workflow", "not execution authority", "Do not reuse an expired review", "Do not resend an uncertain or consumed action", "A timeout does not prove that no write occurred", "does not prove application health or rollback"])
    expect(text).toContain(phrase);
  expect(container.querySelector("form, input, button")).toBeNull();
});

it("links to useful review, readiness and recovery destinations", () => {
  render(createElement(ExecutionPlansPage));
  for (const [name, href] of [
    ["Review and execution guidance", "/docs/approval-workflow"],
    ["Release readiness", "/docs/releaseops/readiness"],
    ["Inspect an uncertain operation", "/docs/troubleshooting"],
    ["Account help (sign-in required)", "/account/help"],
  ]) expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
});

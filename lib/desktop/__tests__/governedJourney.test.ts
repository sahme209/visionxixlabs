/** @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DocsView } from "../../../desktop/src/views/DocsView";
import GettingStartedPage from "../../../app/docs/getting-started/page";
afterEach(cleanup);
const stages = ["Scope the repository", "Prepare and verify code", "Review deployment authority", "Schedule with Airflow", "Validate and recover"];
it("requests the intended destinations from the deployment-centered help journey", () => {
  const navigate = vi.fn();
  render(createElement(DocsView, { onNavigate: navigate }));
  for (const title of stages) expect(screen.getByRole("heading", { name: title })).toBeTruthy();
  for (const [label, target] of [
    ["Open repository", "repository-workspace"], ["Open Agent", "agent"],
    ["Open Deployments", "deployment-requests"], ["Open Batches", "airflow-automation"],
    ["Review deployment evidence", "deployment-requests"],
  ]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(navigate).toHaveBeenLastCalledWith(target);
  }
  expect(navigate).toHaveBeenCalledTimes(5);
});
it("links every selected desktop stage to its exact public guide heading", () => {
  const html = renderToStaticMarkup(createElement(GettingStartedPage));
  const publicPage = new DOMParser().parseFromString(html, "text/html");
  render(createElement(DocsView, {onNavigate: vi.fn()}));
  for (const [label, title] of [
    ["Scope", stages[0]], ["Prepare", stages[1]], ["Review", stages[2]],
    ["Schedule", stages[3]], ["Verify", stages[4]],
  ]) {
    fireEvent.click(screen.getByRole("button", {name: label}));
    const href = new URL(screen.getByRole<HTMLAnchorElement>("link", {name: "Guide source"}).href);
    expect(href.pathname).toBe("/docs/getting-started");
    const heading = publicPage.getElementById(href.hash.slice(1));
    expect(heading?.tagName).toBe("H3");
    expect(heading?.textContent).toBe(title);
  }
});
it("renders the same operational stages on the website with explicit authority boundaries", () => {
  const html = renderToStaticMarkup(createElement(GettingStartedPage));
  for (const title of stages) expect(html).toContain(title);
  expect(html).toContain("A schedule is not deployment approval");
  expect(html).toContain("A proposal does not apply code");
});

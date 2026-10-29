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
    ["Open deployment requests", "deployment-requests"], ["Open Airflow", "airflow-automation"],
    ["Review deployment evidence", "deployment-requests"],
  ]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(navigate).toHaveBeenLastCalledWith(target);
  }
  expect(navigate).toHaveBeenCalledTimes(5);
});
it("renders the same operational stages on the website with explicit authority boundaries", () => {
  const html = renderToStaticMarkup(createElement(GettingStartedPage));
  for (const title of stages) expect(html).toContain(title);
  expect(html).toContain("A schedule is not deployment approval");
  expect(html).toContain("A proposal does not apply code");
});

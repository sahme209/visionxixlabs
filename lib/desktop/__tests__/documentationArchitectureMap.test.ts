/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DocumentationWorkflowMap } from "../../../desktop/src/views/DocumentationWorkflowMap";
afterEach(cleanup);

it("switches the desktop map to the shared architecture view and links each part to its website guide", () => {
  render(createElement(DocumentationWorkflowMap, { onBack: vi.fn() }));
  const card = screen.getByRole("button", { name: "Architecture" });
  fireEvent.click(card);
  expect(card.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("heading", { name: "How V19 fits together" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^Batch orchestration/ }));
  const link = screen.getByRole("link", { name: /Batch providers/ });
  expect(link.getAttribute("href")).toBe("https://visionxixlabs.com/docs/batch-providers");
  fireEvent.click(screen.getAllByRole("button", { pressed: false }).find((b) => b.textContent?.includes("Release"))!);
  expect(card.getAttribute("aria-pressed")).toBe("false");
});

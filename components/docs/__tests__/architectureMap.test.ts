/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ArchitectureMap } from "../ArchitectureMap";
afterEach(cleanup);
it("selects a part, explains it and links its guide; a text version lists every part", () => {
  render(createElement(ArchitectureMap));
  expect(screen.getByRole("link", { name: "Security model →" }).getAttribute("href")).toBe("/docs/security-model");
  fireEvent.click(screen.getByRole("button", { name: /^Batch orchestration/ }));
  expect(screen.getByRole("link", { name: "Batch providers →" }).getAttribute("href")).toBe("/docs/batch-providers");
  expect(document.body.textContent).toContain("nothing is started, retried or cancelled");
  fireEvent.keyDown(screen.getByRole("button", { name: /^External agents/ }), { key: "Enter" });
  expect(screen.getByRole("button", { name: /^External agents/ }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getAllByRole("listitem")).toHaveLength(9);
});

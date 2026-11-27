// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PluginManifestChecker } from "../PluginManifestChecker";
afterEach(() => cleanup());
describe("PluginManifestChecker", () => {
  it("checks the example and lists tools that write for review", () => {
    render(createElement(PluginManifestChecker));
    fireEvent.click(screen.getByRole("button", { name: "Load the example manifest" }));
    fireEvent.click(screen.getByRole("button", { name: "Check manifest" }));
    expect(screen.getByText("Example status page 1.0.0 is a valid manifest.")).toBeTruthy();
    expect(screen.getByText("post_maintenance_notice", { selector: "span" })).toBeTruthy();
  });
  it("shows precise errors", () => {
    render(createElement(PluginManifestChecker));
    fireEvent.change(screen.getByLabelText("Plugin manifest (JSON)"), { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "Check manifest" }));
    expect(screen.getByText("The manifest is not valid JSON.")).toBeTruthy();
  });
});

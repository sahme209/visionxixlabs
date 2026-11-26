// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfigPromotionDemo } from "../ConfigPromotionDemo";

afterEach(cleanup);
describe("ConfigPromotionDemo", () => {
  it("lists what changes from Staging to Production and updates when the pair changes", () => {
    render(createElement(ConfigPromotionDemo));
    expect(screen.getByText(/REPLICAS: "2" → "6"/)).toBeTruthy();
    expect(screen.getByText("CACHE_TTL_SECONDS").closest("li")?.textContent).toContain("missing in Production");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "prod" } });
    expect(screen.getByText("Choose two different environments.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "dev" } });
    expect(screen.getByText(/LOG_LEVEL: "debug" → "warn"/)).toBeTruthy();
  });
});

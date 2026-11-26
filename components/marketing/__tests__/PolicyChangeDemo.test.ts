// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PolicyChangeDemo } from "../PolicyChangeDemo";

afterEach(cleanup);
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
describe("PolicyChangeDemo", () => {
  it("walks request, refused self-approval, then independent approval", () => {
    render(createElement(PolicyChangeDemo));
    click("Alex: request this change");
    expect(screen.getByText(/Nothing has changed yet/)).toBeTruthy();
    click("Alex: approve own request");
    expect(screen.getByText(/cannot approve Alex's own request/)).toBeTruthy();
    click("Sam: approve and apply");
    expect(screen.getByText(/applied in one step/)).toBeTruthy();
  });
  it("marks the request stale when rules changed in between", () => {
    render(createElement(PolicyChangeDemo));
    click("Alex: request this change");
    fireEvent.click(screen.getByLabelText(/Someone else edits a rule/));
    click("Sam: approve and apply");
    expect(screen.getByText(/marked stale and nothing was applied/)).toBeTruthy();
  });
});

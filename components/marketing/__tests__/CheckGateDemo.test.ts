// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CheckGateDemo } from "../CheckGateDemo";

afterEach(cleanup);
describe("CheckGateDemo", () => {
  it("refuses until every blocking check passed at its current version", () => {
    render(createElement(CheckGateDemo));
    expect(screen.getByText("Deployment is refused. Nothing is dispatched.")).toBeTruthy();
    expect(screen.getByText("Change approval checklist: no result for this commit")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Result for Change approval checklist"), { target: { value: "passed" } });
    expect(screen.getByText(/Deployment can be dispatched/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Result for Migration dry run"), { target: { value: "old_version" } });
    expect(screen.getByText("Migration dry run: ran an older version of the check")).toBeTruthy();
  });
});

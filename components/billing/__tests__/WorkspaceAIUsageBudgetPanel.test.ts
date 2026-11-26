/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAIUsageBudgetPanel } from "../WorkspaceAIUsageBudgetPanel";

const fetchBudget = vi.fn();
const organizationId = "workspace-fixture";
const revision = "2026-11-24T03:00:00.000Z";
const budget = { monthlyLimitCents: 500, warningThresholdCents: 350, remainingCents: 120, warningReached: true };
const snapshot = (overrides: object = {}) => Response.json({ ok: true, data: { organizationId, revision, budget, ...overrides } });
const limitInput = () => screen.getByLabelText("Monthly limit (USD)") as HTMLInputElement;
const warningInput = () => screen.getByLabelText("Warning threshold (USD, optional)") as HTMLInputElement;

beforeEach(() => {
  fetchBudget.mockReset();
  vi.stubGlobal("fetch", fetchBudget);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("workspace AI budget cockpit", () => {
  it("shows the verified warning and saves exact dollar inputs as cents under the current revision", async () => {
    fetchBudget
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot({ budget: { ...budget, monthlyLimitCents: 709, warningThresholdCents: null } }));
    render(createElement(WorkspaceAIUsageBudgetPanel, { organizationId }));
    await screen.findByText("Warning threshold reached.");
    fireEvent.change(limitInput(), { target: { value: "7.09" } });
    fireEvent.change(warningInput(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save budget" }));
    await screen.findByText("AI budget saved.");
    const request = fetchBudget.mock.calls[1][1];
    expect(request.method).toBe("PUT");
    expect(JSON.parse(request.body)).toEqual({
      organizationId, expectedRevision: revision, budget: { monthlyLimitCents: 709, warningThresholdCents: null },
    });
  });

  it("withholds edits on a stale revision and explicitly reloads the current values", async () => {
    fetchBudget
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(Response.json({ ok: false }, { status: 409 }))
      .mockResolvedValueOnce(snapshot({ budget: { ...budget, monthlyLimitCents: 900 } }));
    render(createElement(WorkspaceAIUsageBudgetPanel, { organizationId }));
    await screen.findByText("Warning threshold reached.");
    fireEvent.change(limitInput(), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Save budget" }));
    const reload = await screen.findByRole("button", { name: "Reload saved budget" });
    expect(document.activeElement).toBe(reload);
    expect(screen.queryByRole("button", { name: "Save budget" })).toBeNull();
    fireEvent.click(reload);
    await screen.findByDisplayValue("9.00");
    expect(fetchBudget.mock.calls[2][1].method).toBeUndefined();
  });

  it("requires explicit removal confirmation and returns focus to the budget form", async () => {
    fetchBudget.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot({ budget: null, revision: null }));
    render(createElement(WorkspaceAIUsageBudgetPanel, { organizationId }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove budget" }));
    const confirm = screen.getByRole("button", { name: "Confirm removal" });
    expect(document.activeElement).toBe(confirm);
    expect(fetchBudget).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove budget" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove budget" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
    await screen.findByText("AI budget removed.");
    // Focus moves in an effect after the status renders; wait for it rather than racing it under load.
    await waitFor(() => expect(document.activeElement).toBe(limitInput()));
    expect(JSON.parse(fetchBudget.mock.calls[1][1].body)).toEqual({ organizationId, expectedRevision: revision, budget: null });
  });

  it("withholds a budget returned for another workspace", async () => {
    fetchBudget.mockResolvedValueOnce(snapshot({ organizationId: "different-workspace" }));
    render(createElement(WorkspaceAIUsageBudgetPanel, { organizationId }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Warning threshold reached.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save budget" })).toBeNull();
  });
});

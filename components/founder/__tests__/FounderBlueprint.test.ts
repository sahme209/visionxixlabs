// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { FounderBlueprint } from "../FounderBlueprint";
import { DEFAULT_BLUEPRINT } from "@/lib/founder/defaultBlueprint";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const loaded = { blueprint: DEFAULT_BLUEPRINT, version: 0, saved: false, unreadable: false, updatedAt: null, updatedBy: null, signals: { incidents_open: 2, deployments_failed_7d: null } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("FounderBlueprint", () => {
  it("draws departments and steps, shows live signals and opens a step's details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: true, data: loaded })));
    render(createElement(FounderBlueprint));
    expect(await screen.findByRole("region", { name: "Incident response" })).toBeTruthy();
    const step = screen.getByRole("button", { name: /^Incident detected, Incident response, Live, Open incidents 2$/ });
    fireEvent.click(step);
    const panel = screen.getByRole("complementary", { name: "Step details: Incident detected" });
    expect(within(panel).getByText(/Open incidents:/).textContent).toContain("2");
    expect(screen.getByRole("button", { name: /Verify health.*Unavailable/ })).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Close step details" }));
    expect(screen.queryByRole("complementary")).toBeNull();
  });
  it("edits a step's cost and saves with a change summary and the version it read", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ ok: true, data: loaded })).mockResolvedValueOnce(json({ ok: true, data: { version: 1 } }));
    vi.stubGlobal("fetch", f);
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: /^Monthly cost review/ }));
    const panel = screen.getByRole("complementary");
    fireEvent.change(within(panel).getByLabelText("Minutes per run"), { target: { value: "90" } });
    fireEvent.change(within(panel).getByLabelText("Runs per month"), { target: { value: "2" } });
    fireEvent.change(within(panel).getByLabelText("$ per hour"), { target: { value: "100" } });
    expect(within(panel).getAllByText("$300").length ? within(panel).getAllByText("$300")[0] : null).toBeTruthy();
    fireEvent.change(screen.getByLabelText("What changed"), { target: { value: "Costed the monthly review" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved as version 1.")).toBeTruthy();
    const body = JSON.parse(f.mock.calls[1][1].body);
    expect(body).toMatchObject({ expectedVersion: 0, summary: "Costed the monthly review" });
    expect(body.blueprint.steps.find((s: { id: string }) => s.id === "fin-costs").cost).toEqual({ minutesPerRun: 90, runsPerMonth: 2, hourlyRate: 100 });
  });
  it("offers a list view as a text equivalent of the map", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: true, data: loaded })));
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: "List view" }));
    expect(screen.getByRole("heading", { name: /Finance/ })).toBeTruthy();
    expect(screen.queryByRole("application")).toBeNull();
  });
});

describe("FounderBlueprint history", () => {
  it("lists saved versions and restores one", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ ok: true, data: { ...loaded, saved: true, version: 2 } }))
      .mockResolvedValueOnce(json({ ok: true, data: { revisions: [{ version: 2, summary: "Second", savedByEmail: "f@x.test", createdAt: "2026-11-27T07:00:00Z" }, { version: 1, summary: "First", savedByEmail: "f@x.test", createdAt: "2026-11-27T06:00:00Z" }] } }))
      .mockResolvedValueOnce(json({ ok: true, data: { version: 3 } }))
      .mockResolvedValueOnce(json({ ok: true, data: { ...loaded, saved: true, version: 3 } }));
    vi.stubGlobal("fetch", f);
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: "History" }));
    const panel = await screen.findByRole("complementary", { name: "Saved versions" });
    expect(within(panel).getByText("Version 2 · current")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Restore this version" }));
    expect(await screen.findByText("Restored version 1 as version 3.")).toBeTruthy();
    expect(JSON.parse(f.mock.calls[2][1].body)).toEqual({ version: 1, expectedVersion: 2 });
  });
});

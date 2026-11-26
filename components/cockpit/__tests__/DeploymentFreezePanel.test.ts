// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DeploymentFreezePanel } from "../DeploymentFreezePanel";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const envs = [{ id: "p1", name: "Prod", tier: "prod" }, { id: "d1", name: "Dev", tier: "dev" }];
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("DeploymentFreezePanel", () => {
  it("freezes production with a reason and shows the active freeze", async () => {
    const until = "2026-11-27T16:00:00Z";
    const f = vi.fn().mockResolvedValueOnce(json({ ok: true, data: { canEdit: true, environments: envs, freezes: [], unreadable: [] } }))
      .mockResolvedValueOnce(json({ ok: true, data: { environments: ["Prod"], skipped: [] } }))
      .mockResolvedValueOnce(json({ ok: true, data: { canEdit: true, environments: envs, freezes: [{ reason: "Incident 42", until, environments: ["Prod"] }], unreadable: [] } }));
    vi.stubGlobal("fetch", f);
    render(createElement(DeploymentFreezePanel));
    expect(await screen.findByText("No environment is frozen right now.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Incident 42" } });
    fireEvent.click(screen.getByRole("button", { name: "Freeze deployments" }));
    expect(await screen.findByText("Frozen: Prod.")).toBeTruthy();
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ action: "start", scope: "production", hours: 4, reason: "Incident 42" });
    expect(await screen.findByRole("button", { name: "End freeze now" })).toBeTruthy();
  });
  it("ends a freeze early by its reason", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ ok: true, data: { canEdit: true, environments: envs, freezes: [{ reason: "Incident 42", until: "2026-11-27T16:00:00Z", environments: ["Prod"] }], unreadable: [] } }))
      .mockResolvedValueOnce(json({ ok: true, data: { environments: ["Prod"], skipped: [] } }))
      .mockResolvedValueOnce(json({ ok: true, data: { canEdit: true, environments: envs, freezes: [], unreadable: [] } }));
    vi.stubGlobal("fetch", f);
    render(createElement(DeploymentFreezePanel));
    fireEvent.click(await screen.findByRole("button", { name: "End freeze now" }));
    expect(await screen.findByText(/Freeze ended for Prod/)).toBeTruthy();
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ action: "end", reason: "Incident 42" });
  });
  it("shows members the freeze without controls, and says when status is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: true, data: { canEdit: false, environments: envs, freezes: [{ reason: "Holiday", until: "2026-12-30T00:00:00Z", environments: ["Prod"] }], unreadable: [] } })));
    render(createElement(DeploymentFreezePanel));
    expect(await screen.findByText(/Prod frozen: Holiday/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("down")));
    render(createElement(DeploymentFreezePanel));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

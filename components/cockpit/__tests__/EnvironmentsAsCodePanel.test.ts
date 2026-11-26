// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EnvironmentsAsCodePanel } from "../EnvironmentsAsCodePanel";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("EnvironmentsAsCodePanel", () => {
  it("previews a file, shows kept and loosened items, then applies with the digest", async () => {
    const plan = { ops: [{ op: "update", environment: { slug: "prod" }, id: "e2", expectedUpdatedAt: "x", fields: ["changeWindow"] }], unchanged: 1, keptOutOfFile: ["qa"], loosening: ["prod: change window removed, deployments allowed at any time"], refused: [] };
    const f = vi.fn().mockResolvedValueOnce(json({ ok: true, data: { plan, digest: "d1" } })).mockResolvedValueOnce(json({ ok: true, data: { applied: 1 } }));
    vi.stubGlobal("fetch", f);
    render(createElement(EnvironmentsAsCodePanel));
    expect(screen.getByRole("link", { name: "Download environments file" }).getAttribute("href")).toBe("/api/control/environments/file");
    fireEvent.change(screen.getByLabelText("Environments file (JSON)"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview environments file" }));
    expect(await screen.findByText(/not in the file and kept \(qa\)/)).toBeTruthy();
    expect(screen.getByText("prod: change window removed, deployments allowed at any time")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply 1 change" }));
    expect(await screen.findByText(/Applied 1 change/)).toBeTruthy();
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ text: "{}", apply: true, expectedDigest: "d1" });
  });
  it("offers no apply when the file asks for a refused change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: true, data: { plan: { ops: [{ op: "create", environment: { slug: "qa" } }], unchanged: 0, keptOutOfFile: [], loosening: [], refused: ["dev: tier is dev and cannot be changed from a file"] }, digest: "d" } })));
    render(createElement(EnvironmentsAsCodePanel));
    fireEvent.change(screen.getByLabelText("Environments file (JSON)"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview environments file" }));
    expect(await screen.findByText("Cannot be applied")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Apply/ })).toBeNull();
  });
});

// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChecksAsCodePanel } from "../ChecksAsCodePanel";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("ChecksAsCodePanel", () => {
  it("previews a file, shows loosening, and applies with the digest it previewed", async () => {
    const plan = { ops: [{ op: "update", check: { key: "smoke" }, expectedVersion: 2, fields: ["mode"] }, { op: "disable", key: "old", expectedVersion: 1 }], unchanged: 3, loosening: ["smoke: no longer blocks deployments"] };
    const f = vi.fn().mockResolvedValueOnce(json({ ok: true, data: { plan, digest: "d1" } })).mockResolvedValueOnce(json({ ok: true, data: { applied: 2 } }));
    vi.stubGlobal("fetch", f);
    render(createElement(ChecksAsCodePanel));
    expect(screen.getByRole("link", { name: "Download checks file" }).getAttribute("href")).toBe("/api/control/checks/file");
    fireEvent.change(screen.getByLabelText("Checks file (JSON)"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview checks file" }));
    await waitFor(() => expect(screen.getByText("0 new · 1 changed · 1 disabled · 3 unchanged")).toBeTruthy());
    expect(screen.getByText("smoke: no longer blocks deployments")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply 2 changes" }));
    await waitFor(() => expect(screen.getByText(/Applied 2 changes/)).toBeTruthy());
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ text: "{}", apply: true, expectedDigest: "d1" });
  });
  it("shows validation issues in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ ok: false, error: "checks_file_invalid", issues: ["checks.0.key: use lowercase letters, digits and dashes"] }, 422)));
    render(createElement(ChecksAsCodePanel));
    fireEvent.change(screen.getByLabelText("Checks file (JSON)"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview checks file" }));
    await waitFor(() => expect(screen.getByText(/use lowercase letters/)).toBeTruthy());
  });
});

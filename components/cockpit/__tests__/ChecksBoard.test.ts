// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChecksBoard } from "../ChecksBoard";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const board = (canEdit: boolean, checks: unknown[] = []) => ({ ok: true, data: { canEdit, checks, coverage: { stages: ["plan", "validate", "approve", "deploy", "verify", "recover"].map((stage) => ({ stage, blocking: stage === "verify" && checks.length ? 1 : 0, advisory: 0 })), uncovered: checks.length ? ["plan", "validate", "approve", "deploy", "recover"] : ["plan", "validate", "approve", "deploy", "verify", "recover"] } } });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("ChecksBoard", () => {
  it("warns when nothing is checked at Verify and is read-only for members", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(board(false))));
    render(createElement(ChecksBoard));
    await waitFor(() => expect(screen.getByText(/Nothing is checked at Verify/)).toBeTruthy());
    expect(screen.getByText("Only workspace owners and admins can change checks.")).toBeTruthy();
  });
  it("submits a smoke test with typed fields and shows validation issues", async () => {
    const f = vi.fn().mockResolvedValueOnce(json(board(true))).mockResolvedValueOnce(json({ ok: false, error: "check_invalid", issues: ["spec.url: use an https URL"] }, 422));
    vi.stubGlobal("fetch", f);
    render(createElement(ChecksBoard));
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Health probe" } });
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "Health-Probe" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "http://x" } });
    fireEvent.change(screen.getByLabelText("Expected status"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Max latency (ms)"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add check" }));
    await waitFor(() => expect(screen.getByText("spec.url: use an https URL")).toBeTruthy());
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ check: { key: "health-probe", name: "Health probe", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "http://x", expectStatus: 200, maxLatencyMs: 500 } }, enabled: true });
  });
  it("edits with the version it read", async () => {
    const check = { key: "status-page", name: "Status page", kind: "manual_checklist", stage: "deploy", mode: "advisory", spec: { items: ["Post update", "Notify on-call"] }, enabled: true, version: 2 };
    const f = vi.fn().mockResolvedValueOnce(json(board(true, [check]))).mockResolvedValueOnce(json({ ok: true, data: { key: "status-page", version: 3 } })).mockResolvedValueOnce(json(board(true, [check])));
    vi.stubGlobal("fetch", f);
    render(createElement(ChecksBoard));
    fireEvent.click(await screen.findByRole("button", { name: "Edit Status page" }));
    expect((screen.getByLabelText("Items (one per line)") as HTMLTextAreaElement).value).toBe("Post update\nNotify on-call");
    fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(3));
    expect(JSON.parse(f.mock.calls[1][1].body)).toMatchObject({ expectedVersion: 2, check: { spec: { items: ["Post update", "Notify on-call"] } } });
  });
});

describe("ChecksBoard CI workflow preview", () => {
  it("loads the generated workflow when opened and lists skipped checks", async () => {
    const check = { key: "health-probe", name: "Health probe", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://a.example.invalid/h", expectStatus: 200, maxLatencyMs: 500 }, enabled: true, version: 1 };
    const f = vi.fn().mockResolvedValueOnce(json(board(true, [check]))).mockResolvedValueOnce(json({ ok: true, data: { path: ".github/workflows/v19-deployment-checks.yml", yaml: "name: V19 deployment checks\n", included: ["health-probe"], skipped: [{ key: "runbook", reason: "confirmed by a person in V19, not in CI" }] } }));
    vi.stubGlobal("fetch", f);
    render(createElement(ChecksBoard));
    const summary = await screen.findByText("CI workflow for these checks");
    const details = summary.closest("details")!; details.open = true; fireEvent(details, new Event("toggle"));
    await waitFor(() => expect(screen.getByLabelText("Generated workflow").textContent).toContain("V19 deployment checks"));
    expect(screen.getByText(/not in this file, confirmed by a person in V19/)).toBeTruthy();
    expect(f.mock.calls[1][0]).toBe("/api/control/checks/workflow");
  });
});

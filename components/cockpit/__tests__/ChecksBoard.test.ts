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

describe("ChecksBoard latest results", () => {
  it("shows the last reported result, flags a stale check version and says when none is recorded", async () => {
    const mk = (key: string, version: number) => ({ key, name: key, kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://a.example.invalid/h", expectStatus: 200, maxLatencyMs: 500 }, enabled: true, version });
    const b = board(true, [mk("probe-a", 3), mk("probe-b", 1)]);
    (b.data as Record<string, unknown>).latestResults = { "probe-a": { status: "failed", checkVersion: 2, runUrl: "https://github.com/acme/app/actions/runs/9", reportedAt: "2026-11-26T10:00:00Z" } };
    vi.stubGlobal("fetch", vi.fn(async () => json(b)));
    render(createElement(ChecksBoard));
    await waitFor(() => expect(screen.getByText("failed")).toBeTruthy());
    expect(screen.getByText("ran version 2, current is 3")).toBeTruthy();
    expect(screen.getByText("No result recorded yet.")).toBeTruthy();
  });
});

describe("ChecksBoard manual checklist confirmation", () => {
  it("enables confirmation only when every item is ticked and a full SHA is given, then records it", async () => {
    const check = { key: "status-page", name: "Status page", kind: "manual_checklist", stage: "approve", mode: "blocking", spec: { items: ["Post update", "Notify on-call"] }, enabled: true, version: 2 };
    const f = vi.fn().mockResolvedValueOnce(json(board(true, [check]))).mockResolvedValueOnce(json({ ok: true, recorded: true }, 201)).mockResolvedValueOnce(json(board(true, [check])));
    vi.stubGlobal("fetch", f);
    render(createElement(ChecksBoard));
    await screen.findByText("Confirm for a commit");
    const button = screen.getByRole("button", { name: "Confirm all items" }) as HTMLButtonElement;
    fireEvent.click(screen.getByLabelText("Post update"));
    fireEvent.change(screen.getByLabelText(/Commit SHA/), { target: { value: "A".repeat(40) } });
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Notify on-call"));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText("Recorded for this commit.")).toBeTruthy());
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ checkKey: "status-page", checkVersion: 2, commitSha: "a".repeat(40), confirmedItems: ["Post update", "Notify on-call"] });
  });
});

describe("ChecksBoard AI drafting", () => {
  it("fills the form from a validated draft without saving", async () => {
    const f = vi.fn().mockResolvedValueOnce(json(board(true))).mockResolvedValueOnce(json({ ok: true, draft: { key: "health", name: "Health", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://a.example.invalid/h", expectStatus: 200, maxLatencyMs: 500 } } }));
    vi.stubGlobal("fetch", f);
    render(createElement(ChecksBoard));
    fireEvent.change(await screen.findByLabelText("Describe the check"), { target: { value: "probe health" } });
    fireEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    await waitFor(() => expect((screen.getByLabelText("URL") as HTMLInputElement).value).toBe("https://a.example.invalid/h"));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Health");
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("ChecksBoard check library", () => {
  it("fills the form from a library entry, sends the pinned spec and asks to change example values", async () => {
    const f = vi.fn().mockResolvedValueOnce(json(board(true))).mockResolvedValueOnce(json({ ok: true, data: { key: "trivy-fs", version: 1 } })).mockResolvedValueOnce(json(board(true)));
    vi.stubGlobal("fetch", f);
    render(createElement(ChecksBoard));
    fireEvent.click(await screen.findByRole("button", { name: "Use Lighthouse audit" }));
    expect(screen.getByText("Change the example inputs before adding this check.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use Trivy filesystem scan" }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Trivy filesystem scan");
    fireEvent.click(screen.getByRole("button", { name: "Add check" }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(3));
    expect(JSON.parse(f.mock.calls[1][1].body).check).toMatchObject({ key: "trivy-fs", kind: "marketplace_action", spec: { action: "aquasecurity/trivy-action", commit: "ed142fd0673e97e23eac54620cfb913e5ce36c25" } });
  });
  it("leaves out entries the workspace already has", async () => {
    const check = { key: "lighthouse", name: "Lighthouse audit", kind: "manual_checklist", stage: "verify", mode: "advisory", spec: { items: ["x"] }, enabled: true, version: 1 };
    vi.stubGlobal("fetch", vi.fn(async () => json(board(true, [check]))));
    render(createElement(ChecksBoard));
    await screen.findByRole("button", { name: "Use Trivy filesystem scan" });
    expect(screen.queryByRole("button", { name: "Use Lighthouse audit" })).toBeNull();
  });
});

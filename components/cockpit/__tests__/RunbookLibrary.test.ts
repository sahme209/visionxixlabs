// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RunbookLibrary } from "../RunbookLibrary";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const stored = { key: "failed-deploy", title: "A deploy failed", trigger: "deployment_failed", enabled: true, version: 2, updatedAt: "2026-11-28T00:00:00Z", steps: [{ title: "Read the run", detail: "Open it.", approval: "none" }, { title: "Roll back", detail: "Desktop app.", approval: "one_admin" }] };

describe("RunbookLibrary", () => {
  it("lists runbooks with their approvals and edits at the stored version", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ ok: true, data: { key: "failed-deploy", version: 3 } }));
      return new Response(JSON.stringify({ ok: true, data: { canEdit: true, runbooks: [stored] } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(RunbookLibrary));
    expect(await screen.findByText("A deploy failed")).toBeTruthy();
    expect(screen.getByText("1 needs approval", { exact: false })).toBeTruthy();
    expect(screen.getByText("One admin approves")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = screen.getByRole("form", { name: "Edit failed-deploy" });
    fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "A deploy failed (v2)" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === "POST")).toBe(true));
    const body = JSON.parse(String((fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "POST")![1] as RequestInit).body));
    expect(body).toMatchObject({ expectedVersion: 2, runbook: { key: "failed-deploy", title: "A deploy failed (v2)" } });
    expect(body.runbook).not.toHaveProperty("version");
  });
  it("offers templates to admins and shows a plain message when reading fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { canEdit: true, runbooks: [] } }))));
    render(createElement(RunbookLibrary));
    fireEvent.click(await screen.findByRole("button", { name: "Freeze production during an incident" }));
    expect((screen.getByLabelText("Key") as HTMLInputElement).value).toBe("incident-freeze");
    cleanup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    render(createElement(RunbookLibrary));
    expect(await screen.findByText("Runbooks could not be read.")).toBeTruthy();
  });
});

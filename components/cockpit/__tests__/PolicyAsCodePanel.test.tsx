// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PolicyAsCodePanel } from "../PolicyAsCodePanel";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("PolicyAsCodePanel", () => {
  it("offers the export download and keeps preview disabled until text is pasted", () => {
    render(<PolicyAsCodePanel />);
    expect(screen.getByRole("link", { name: "Download policy file" }).getAttribute("href")).toBe("/api/control/policy/export");
    expect((screen.getByRole("button", { name: "Preview changes" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows counts and loosening warnings from the diff", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { added: [], removed: ["old-rule"], changed: [{ key: "prod-gate", fields: [{ field: "blocking", from: true, to: false }] }], unchanged: 2, loosening: ["prod-gate: no longer blocks releases", "old-rule: removed"] } }), { status: 200 })));
    render(<PolicyAsCodePanel />);
    fireEvent.change(screen.getByLabelText("Proposed policy file (JSON)"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    await waitFor(() => expect(screen.getByText("Loosens governance")).toBeTruthy());
    expect(screen.getByText("0 added · 1 changed · 1 removed · 2 unchanged")).toBeTruthy();
    expect(screen.getByText("prod-gate: no longer blocks releases")).toBeTruthy();
  });
  it("lists validation issues and maps admin refusal to plain words", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "policy_document_invalid", issues: ["rules.0.key: Required"] }), { status: 422 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "workspace_admin_required" }), { status: 403 }));
    vi.stubGlobal("fetch", f);
    render(<PolicyAsCodePanel />);
    fireEvent.change(screen.getByLabelText("Proposed policy file (JSON)"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    await waitFor(() => expect(screen.getByText("rules.0.key: Required")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    await waitFor(() => expect(screen.getByText(/Only workspace owners and admins/)).toBeTruthy());
  });
});

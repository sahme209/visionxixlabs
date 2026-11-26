// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PolicyAsCodePanel } from "../PolicyAsCodePanel";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
/** Route fetch by URL so the mount-time request list never consumes another call's response. */
function routes(handlers: Record<string, Array<() => Response>>, requests: unknown = { ok: true, data: { viewerUserId: "me", requests: [] } }) {
  const calls: Array<[string, RequestInit | undefined]> = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push([url, init]);
    const key = Object.keys(handlers).find((k) => url.startsWith(k) && (init?.method ?? "GET") !== "GET");
    if (key && handlers[key].length) return handlers[key].shift()!();
    return json(requests);
  });
  vi.stubGlobal("fetch", f);
  return calls;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const diff = { added: [], removed: ["old-rule"], changed: [{ key: "prod-gate", fields: [{ field: "blocking", from: true, to: false }] }], unchanged: 2, loosening: ["prod-gate: no longer blocks releases", "old-rule: removed"] };

describe("PolicyAsCodePanel", () => {
  it("offers the export download and keeps preview disabled until text is pasted", () => {
    routes({});
    render(createElement(PolicyAsCodePanel));
    expect(screen.getByRole("link", { name: "Download policy file" }).getAttribute("href")).toBe("/api/control/policy/export");
    expect((screen.getByRole("button", { name: "Preview changes" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows counts and loosening warnings, then requests the change for review", async () => {
    const calls = routes({ "/api/control/policy/diff": [() => json({ ok: true, data: diff })], "/api/control/policy/requests": [() => json({ ok: true, data: { id: "req1" } }, 201)] });
    render(createElement(PolicyAsCodePanel));
    fireEvent.change(screen.getByLabelText("Proposed policy file (JSON)"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    await waitFor(() => expect(screen.getByText("Loosens governance")).toBeTruthy());
    expect(screen.getByText("0 added · 1 changed · 1 removed · 2 unchanged")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Request this change" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Change requested" })).toBeTruthy());
    expect(calls.some(([u, i]) => u === "/api/control/policy/requests" && i?.method === "POST" && i.body === "{}")).toBe(true);
  });
  it("shows the backtest of past releases under the proposed rules", async () => {
    const backtest = { releases: 12, blockedNow: 3, blockedProposed: 1, newlyBlocked: [], newlyUnblocked: ["r1", "r2"], byRule: [{ key: "prod-gate", blockedNow: 2, blockedProposed: 0 }], rulesWithoutHistory: ["new-rule"] };
    routes({ "/api/control/policy/diff": [() => json({ ok: true, data: { ...diff, backtest } })] });
    render(createElement(PolicyAsCodePanel));
    fireEvent.change(screen.getByLabelText("Proposed policy file (JSON)"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    await waitFor(() => expect(screen.getByText(/Backtest/)).toBeTruthy());
    expect(screen.getByText("Of 12 releases, 3 were blocked under the current rules; 1 would be under this file.")).toBeTruthy();
    expect(screen.getByText("Would no longer be blocked: 2 releases.")).toBeTruthy();
    expect(screen.getByText("prod-gate: 2 → 0 blocked")).toBeTruthy();
    expect(screen.getByText(/effect is unknown: new-rule/)).toBeTruthy();
  });
  it("lists validation issues and maps admin refusal to plain words", async () => {
    routes({ "/api/control/policy/diff": [() => json({ ok: false, error: "policy_document_invalid", issues: ["rules.0.key: Required"] }, 422), () => json({ ok: false, error: "workspace_admin_required" }, 403)] });
    render(createElement(PolicyAsCodePanel));
    fireEvent.change(screen.getByLabelText("Proposed policy file (JSON)"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    await waitFor(() => expect(screen.getByText("rules.0.key: Required")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    await waitFor(() => expect(screen.getByText(/Only workspace owners and admins/)).toBeTruthy());
  });
  it("lets a different admin approve a pending request and explains a stale one", async () => {
    const pending = { ok: true, data: { viewerUserId: "me", requests: [{ id: "req1", loosens: true, status: "pending", proposedByUserId: "someone", createdAt: "2026-11-26T12:00:00Z", diffJson: diff }, { id: "req2", loosens: false, status: "pending", proposedByUserId: "me", createdAt: "2026-11-26T11:00:00Z", diffJson: { ...diff, removed: [], changed: [], added: [{ key: "x" }], loosening: [] } }] } };
    routes({ "/api/control/policy/requests/req1/decide": [() => json({ ok: false, error: "policy_changed_since_request" }, 409)] }, pending);
    render(createElement(PolicyAsCodePanel));
    await waitFor(() => expect(screen.getByText("Change requests")).toBeTruthy());
    expect(screen.getAllByRole("button", { name: "Approve and apply" })).toHaveLength(1);
    expect(screen.getByText(/requested by you/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }));
    await waitFor(() => expect(screen.getByText(/marked stale and nothing was applied/)).toBeTruthy());
  });
});

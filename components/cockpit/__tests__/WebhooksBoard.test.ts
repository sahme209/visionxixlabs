// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WebhooksBoard } from "../WebhooksBoard";
import { WEBHOOK_EVENT_CATALOG } from "@/lib/webhooks/webhookEventCatalog";
import { isWebhookEventKind } from "@/lib/webhooks/webhookEventKinds";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("WebhooksBoard", () => {
  it("offers only real event kinds", () => {
    expect(WEBHOOK_EVENT_CATALOG.every((e) => isWebhookEventKind(e.kind))).toBe(true);
    expect(new Set(WEBHOOK_EVENT_CATALOG.map((e) => e.kind)).size).toBe(WEBHOOK_EVENT_CATALOG.length);
  });
  it("adds a webhook for chosen events and shows the secret once", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ ok: true, data: { canEdit: true, endpoints: [] } }))
      .mockResolvedValueOnce(json({ ok: true, data: { id: "w1", name: "Slack", secret: "s".repeat(64) } }, 201))
      .mockResolvedValueOnce(json({ ok: true, data: { canEdit: true, endpoints: [{ id: "w1", name: "Slack", url: "https://hooks.example.com/x", subscribedEvents: ["deployment.blocked"], consecutiveFailures: 0, createdAt: "2026-11-27T00:00:00Z" }] } }));
    vi.stubGlobal("fetch", f);
    render(createElement(WebhooksBoard));
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Slack" } });
    fireEvent.change(screen.getByLabelText("Address (https)"), { target: { value: "https://hooks.example.com/x" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /agent_gateway.request_pending/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add webhook" }));
    await waitFor(() => expect(screen.getByText(/it will not be shown again/)).toBeTruthy());
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ name: "Slack", url: "https://hooks.example.com/x", events: ["deployment.blocked"] });
    expect(await screen.findByRole("button", { name: "Revoke webhook Slack" })).toBeTruthy();
  });
  it("explains refused addresses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: true, data: { canEdit: true, endpoints: [] } })).mockResolvedValueOnce(json({ ok: false, error: "url_private_ip_blocked" }, 400)));
    render(createElement(WebhooksBoard));
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Address (https)"), { target: { value: "https://10.0.0.1/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add webhook" }));
    await waitFor(() => expect(screen.getByText(/private and internal addresses are refused/)).toBeTruthy());
  });
});

describe("WebhooksBoard recent deliveries", () => {
  it("loads deliveries only when asked and labels outcomes", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ ok: true, data: { canEdit: false, endpoints: [{ id: "w1", name: "Slack", url: "https://hooks.example.com/x", subscribedEvents: ["deployment.blocked"], consecutiveFailures: 0, createdAt: "2026-11-27T00:00:00Z" }] } }))
      .mockResolvedValueOnce(json({ ok: true, data: { deliveries: [
        { id: "d1", eventKind: "deployment.blocked", attemptNumber: 1, status: "delivered", httpStatus: 204, attemptedAt: "2026-11-27T10:00:00Z", nextAttemptAt: null, createdAt: "2026-11-27T10:00:00Z" },
        { id: "d2", eventKind: "deployment.blocked", attemptNumber: 8, status: "deadletter", httpStatus: null, attemptedAt: "2026-11-27T11:00:00Z", nextAttemptAt: null, createdAt: "2026-11-27T11:00:00Z" },
      ] } }));
    vi.stubGlobal("fetch", f);
    render(createElement(WebhooksBoard));
    const toggle = await screen.findByRole("button", { name: "Show recent deliveries" });
    expect(f).toHaveBeenCalledTimes(1);
    fireEvent.click(toggle);
    const table = await screen.findByRole("table", { name: "Recent deliveries for Slack" });
    expect(f.mock.calls[1][0]).toBe("/api/control/webhooks/w1/deliveries");
    expect(table.textContent).toContain("Delivered");
    expect(table.textContent).toContain("Gave up");
    expect(table.textContent).toContain("no response");
  });
});

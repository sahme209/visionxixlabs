/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://example.test"}
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const io = vi.hoisted(() => ({ push: vi.fn(), fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: io.push }) }));
import { PurchaseAddOnButton } from "../PurchaseAddOnButton";
const props = { sku: "ai_credits_small", organizationId: "org_1" };
const storageKey = "axiom:credit-checkout:org_1:ai_credits_small";
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.stubGlobal("fetch", io.fetch);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function view() { return render(createElement(PurchaseAddOnButton, props)); }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

describe("credit purchase customer intent", () => {
  it("sends a valid durable key and uses the server's actual url contract for redirect", async () => {
    io.fetch.mockResolvedValue(response({ ok: true, url: "https://checkout.stripe.test/cs_simulated" }));
    view();
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await waitFor(() => expect(io.push).toHaveBeenCalledWith("https://checkout.stripe.test/cs_simulated"));
    const options = io.fetch.mock.calls[0][1];
    expect(options.headers["Idempotency-Key"]).toMatch(/^[A-Za-z0-9_-]{16,100}$/);
    expect(sessionStorage.getItem(storageKey)).toBe(options.headers["Idempotency-Key"]);
    expect(JSON.parse(options.body)).toEqual(props);
    expect(options.credentials).toBe("include");
  });

  it("preserves the same key after a lost response and remount, with no new-purchase action", async () => {
    io.fetch.mockRejectedValueOnce(new Error("transport lost"));
    const first = view();
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await screen.findByRole("alert");
    const key = sessionStorage.getItem(storageKey);
    expect(key).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start a new purchase" })).toBeNull();
    first.unmount();
    io.fetch.mockResolvedValue(response({ ok: false, error: "checkout_reconciliation_required" }, 409));
    view();
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await screen.findByText(/needs reconciliation/);
    expect(io.fetch.mock.calls[1][1].headers["Idempotency-Key"]).toBe(key);
    expect(io.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Start a new purchase" })).toBeNull();
  });

  it("allows an explicit new intent only after confirmed terminal status", async () => {
    io.fetch.mockResolvedValueOnce(response({ ok: false, error: "purchase_already_finalized", purchaseStatus: "paid" }, 409));
    view();
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    const action = await screen.findByRole("button", { name: "Start a new purchase" });
    const firstKey = sessionStorage.getItem(storageKey);
    fireEvent.click(action);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    expect(io.fetch).toHaveBeenCalledTimes(1);
    io.fetch.mockResolvedValueOnce(response({ ok: false, error: "checkout_reconciliation_required" }, 409));
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await screen.findByText(/needs reconciliation/);
    expect(sessionStorage.getItem(storageKey)).not.toBe(firstKey);
  });

  it("does not issue a request if durable intent storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    view();
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await screen.findByRole("alert");
    expect(io.fetch).not.toHaveBeenCalled();
    expect(io.push).not.toHaveBeenCalled();
  });

  it("ignores a late redirect after the visible workspace changes", async () => {
    let complete!: (value: Response) => void;
    io.fetch.mockImplementation(() => new Promise<Response>((resolve) => { complete = resolve; }));
    const component = view();
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    component.rerender(createElement(PurchaseAddOnButton, { ...props, organizationId: "org_2" }));
    complete(response({ ok: true, url: "https://checkout.stripe.test/old_workspace" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Buy" })).toBeTruthy());
    expect(io.push).not.toHaveBeenCalled();
  });

  it("separates workspace intent keys", async () => {
    io.fetch.mockResolvedValue(response({ ok: false, error: "checkout_reconciliation_required" }, 409));
    const first = view();
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await screen.findByRole("alert");
    const key = sessionStorage.getItem(storageKey);
    first.unmount();
    render(createElement(PurchaseAddOnButton, { ...props, organizationId: "org_2" }));
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await screen.findByRole("alert");
    expect(io.fetch.mock.calls[1][1].headers["Idempotency-Key"]).not.toBe(key);
    expect(sessionStorage.getItem(storageKey)).toBe(key);
  });
});

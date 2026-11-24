/** @vitest-environment jsdom */
import { createElement } from "react";
import { setTimeout as nodeTimeout } from "node:timers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: mocks.signOut }));
import { PairDesktopClient } from "../PairDesktopClient";
beforeEach(() => { vi.clearAllMocks(); mocks.signOut.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("switches only the browser account and preserves the pending challenge for explicit sign-in", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(createElement(PairDesktopClient, { challenge: "pair_example-123", deviceLabel: "My Mac", accountEmail: "fixture@example.test", children: null }));
  fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: `/auth/signin?callbackUrl=${encodeURIComponent("/desktop/connect?challenge=pair_example-123&intent=sign_in")}&switchAccount=1` }));
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.getByText(/Existing paired desktop sessions remain signed in/)).not.toBeNull();
  expect(screen.queryByRole("link", { name: "Open V19" })).toBeNull();
});
it("prevents duplicate switching and an overlapping approval", async () => {
  mocks.signOut.mockReturnValue(new Promise(() => {}));
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(createElement(PairDesktopClient, { challenge: "pair_123", deviceLabel: "My Mac", accountEmail: "fixture@example.test", children: null }));
  const switchButton = screen.getByRole("button", { name: "Use another account" });
  fireEvent.click(switchButton); fireEvent.click(switchButton);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(mocks.signOut).toHaveBeenCalledOnce(); expect(fetcher).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(true);
});
it("prevents switching or duplicate approval while approval is pending", () => {
  const fetcher = vi.fn(() => new Promise(() => {})); vi.stubGlobal("fetch", fetcher);
  render(createElement(PairDesktopClient, { challenge: "pair_123", deviceLabel: "My Mac", accountEmail: "fixture@example.test", children: null }));
  const continueButton = screen.getByRole("button", { name: "Continue" });
  fireEvent.click(continueButton); fireEvent.click(continueButton);
  fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
  expect(fetcher).toHaveBeenCalledOnce(); expect(mocks.signOut).not.toHaveBeenCalled();
});
it("keeps switching failure account-neutral and permits explicit retry", async () => {
  mocks.signOut.mockRejectedValueOnce(new Error("private identity/provider detail"));
  render(createElement(PairDesktopClient, { challenge: "pair_123", deviceLabel: "My Mac", accountEmail: "fixture@example.test", children: null }));
  fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
  expect((await screen.findByRole("alert")).textContent).not.toContain("private identity");
  expect(screen.getByRole("button", { name: "Use another account" }).hasAttribute("disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
  expect(mocks.signOut).toHaveBeenCalledTimes(2);
});
it("does not sign out for an invalid challenge navigation target", async () => {
  render(createElement(PairDesktopClient, { challenge: "//evil.test\\bad", deviceLabel: "My Mac", accountEmail: "fixture@example.test", children: null }));
  fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
  await screen.findByRole("alert"); expect(mocks.signOut).not.toHaveBeenCalled();
});
it("hides account switching after approval without changing the existing desktop return", async () => {
  vi.spyOn(window, "setTimeout").mockImplementation((handler, delay, ...args) => {
    const callback = delay !== 450 && typeof handler === "function" ? () => handler(...args) : () => {};
    return nodeTimeout(callback, delay === 450 ? 0 : delay);
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, status: "approved" }) }));
  render(createElement(PairDesktopClient, { challenge: "pair_123", deviceLabel: "My Mac", accountEmail: "fixture@example.test", children: null }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("link", { name: "Open V19" })).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Use another account" })).toBeNull();
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it.each([
  [404, { error: "pairing_not_found" }],
  [410, { error: "pairing_expired" }],
  [200, { ok: true, status: "consumed" }],
])("offers a fresh start without approving or reopening the desktop for %s", async (status, body) => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(body, { status }));
  vi.stubGlobal("fetch", fetcher);
  render(createElement(PairDesktopClient, { challenge: "pair_123", deviceLabel: "My Mac", accountEmail: "fixture@example.test", children: null }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const guidance = await screen.findByText(/Return to V19 and choose Log in/);
  expect(document.activeElement).toBe(guidance);
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Use another account" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Open V19" })).toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
});

it("offers explicit browser sign-in with the exact pending challenge after session loss", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
  render(createElement(PairDesktopClient, {
    challenge: "pair_123",
    deviceLabel: "My Mac",
    accountEmail: "fixture@example.test",
    children: createElement("p", null, "Workspace access status"),
  }));
  expect(screen.getByText("fixture@example.test")).toBeTruthy();
  expect(screen.getByText("Workspace access status")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const link = await screen.findByRole("link", { name: "Sign in again" });
  expect(link.getAttribute("href")).toBe(`/auth/signin?callbackUrl=${encodeURIComponent("/desktop/connect?challenge=pair_123&intent=sign_in")}`);
  expect(screen.queryByText("fixture@example.test")).toBeNull();
  expect(screen.queryByText("Workspace access status")).toBeNull();
  expect(document.activeElement?.textContent).toContain("Your browser session ended");
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it("retains explicit account switching when workspace policy denies approval", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
    error: "desktop.auth.session_cap", message: "The workspace device limit has been reached.",
  }, { status: 403 })));
  render(createElement(PairDesktopClient, { challenge: "pair_123", deviceLabel: "My Mac", accountEmail: "fixture@example.test", children: null }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect((await screen.findByRole("alert")).textContent).toBe("The workspace device limit has been reached.");
  expect(screen.queryByRole("link", { name: "Open V19" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({
    callbackUrl: `/auth/signin?callbackUrl=${encodeURIComponent("/desktop/connect?challenge=pair_123&intent=sign_in")}&switchAccount=1`,
  }));
});

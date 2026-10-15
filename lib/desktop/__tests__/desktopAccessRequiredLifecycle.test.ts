/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mock = vi.hoisted(() => ({ verify: vi.fn(), signOut: vi.fn(), client: { config: {} as { sessionToken?: string }, hasAuth: vi.fn(), verifyCurrentCredential: vi.fn() } }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: mock.client }));
vi.mock("../../../desktop/src/lib/activeDesktopCredential", () => ({ signOutDesktopCredentials: mock.signOut }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
import { DesktopAccessRequiredView } from "../../../desktop/src/views/DesktopAccessRequiredView";
import type { VerifiedDesktopIdentity } from "../../../desktop/src/lib/desktopClient";
const identity = { organizationId: "org", access: { allowed: false, title: "Access required", message: "Wait for approval", billingStatus: "inactive", code: "pilot_required" } } as unknown as VerifiedDesktopIdentity;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
beforeEach(() => {
  vi.resetAllMocks(); mock.client.config = { sessionToken: "old" }; mock.client.hasAuth.mockImplementation(() => Boolean(mock.client.config.sessionToken));
  mock.signOut.mockImplementation(async () => { mock.client.config = {}; });
});
afterEach(() => { cleanup(); });
describe("access-required checks keep credential and view ownership", () => {
  it("does not restore an old identity when access verification completes after sign-out", async () => {
    const pending = deferred<unknown>(); mock.client.verifyCurrentCredential.mockReturnValue(pending.promise);
    const granted = vi.fn(), signedOut = vi.fn(); render(createElement(DesktopAccessRequiredView, { identity, onAccessGranted: granted, onSignedOut: signedOut }));
    fireEvent.click(screen.getByRole("button", { name: "Check access again" }));
    fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
    await waitFor(() => expect(signedOut).toHaveBeenCalledOnce());
    pending.resolve({ ok: true, data: { ...identity, access: { allowed: true } } });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(granted).not.toHaveBeenCalled();
  });
  it("ignores a successful access response for a replaced credential", async () => {
    const pending = deferred<unknown>(); mock.client.verifyCurrentCredential.mockReturnValue(pending.promise);
    const granted = vi.fn(); render(createElement(DesktopAccessRequiredView, { identity, onAccessGranted: granted, onSignedOut: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Check access again" }));
    mock.client.config = { sessionToken: "replacement" };
    pending.resolve({ ok: true, data: { ...identity, access: { allowed: true } } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Check access again" }) as HTMLButtonElement).disabled).toBe(false));
    expect(granted).not.toHaveBeenCalled();
  });
  it("does not grant access after the blocked view unmounts", async () => {
    const pending = deferred<unknown>(); mock.client.verifyCurrentCredential.mockReturnValue(pending.promise);
    const granted = vi.fn(); const view = render(createElement(DesktopAccessRequiredView, { identity, onAccessGranted: granted, onSignedOut: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Check access again" })); view.unmount();
    pending.resolve({ ok: true, data: { ...identity, access: { allowed: true } } });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(granted).not.toHaveBeenCalled();
  });
  it("still grants a fresh allowed response for the current credential", async () => {
    const verified = { ...identity, access: { allowed: true } };
    mock.client.verifyCurrentCredential.mockResolvedValue({ ok: true, data: verified });
    const granted = vi.fn(); render(createElement(DesktopAccessRequiredView, { identity, onAccessGranted: granted, onSignedOut: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Check access again" }));
    await waitFor(() => expect(granted).toHaveBeenCalledExactlyOnceWith(verified));
  });
  it("reports verification exceptions and allows retry", async () => {
    mock.client.verifyCurrentCredential.mockRejectedValue(new Error("offline"));
    render(createElement(DesktopAccessRequiredView, { identity, onAccessGranted: vi.fn(), onSignedOut: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Check access again" }));
    expect((await screen.findByRole("alert")).textContent).toContain("could not be checked");
    expect((screen.getByRole("button", { name: "Check access again" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("does not claim durable sign-out when the vault rejects it", async () => {
    mock.signOut.mockRejectedValue(new Error("Sign-out could not be saved"));
    const signedOut = vi.fn(); render(createElement(DesktopAccessRequiredView, { identity, onAccessGranted: vi.fn(), onSignedOut: signedOut }));
    fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
    expect((await screen.findByRole("alert")).textContent).toContain("could not be saved"); expect(signedOut).not.toHaveBeenCalled();
  });
});

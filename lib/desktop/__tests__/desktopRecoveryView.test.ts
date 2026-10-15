/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ recover: vi.fn(), browser: vi.fn(), clear: vi.fn(), verify: vi.fn() }));
vi.mock("../../../desktop/src/lib/apiKeyStore", () => ({ verifyAndSaveApiKey: mocks.recover }));
vi.mock("../../../desktop/src/lib/desktopPairing", () => ({ signInWithBrowser: mocks.browser }));
vi.mock("../../../desktop/src/lib/authSession", () => ({ clearAuthSession: mocks.clear }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { verifyCurrentCredential: mocks.verify } }));
import { DesktopSignInView } from "../../../desktop/src/views/DesktopSignInView";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("desktop recovery sign-in interaction", () => {
  it("keeps rejected recovery on the sign-in screen without clearing the existing session", async () => {
    mocks.recover.mockRejectedValue(new Error("Recovery key rejected"));
    const onSignedIn = vi.fn(); render(createElement(DesktopSignInView, { onSignedIn }));
    fireEvent.click(screen.getByText("Enterprise recovery sign-in"));
    fireEvent.change(screen.getByLabelText("Workspace API key"), { target: { value: "candidate" } });
    fireEvent.click(screen.getByRole("button", { name: "Use administrator key" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Recovery key rejected");
    expect(onSignedIn).not.toHaveBeenCalled(); expect(mocks.clear).not.toHaveBeenCalled();
  });
  it("blocks browser sign-in while recovery verification is pending", async () => {
    let finish!: (identity: unknown) => void;
    mocks.recover.mockReturnValue(new Promise<unknown>(resolve => { finish = resolve; }));
    const onSignedIn = vi.fn(); render(createElement(DesktopSignInView, { onSignedIn }));
    fireEvent.click(screen.getByText("Enterprise recovery sign-in"));
    fireEvent.change(screen.getByLabelText("Workspace API key"), { target: { value: "candidate" } });
    fireEvent.click(screen.getByRole("button", { name: "Use administrator key" }));
    expect((screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Log in" })); expect(mocks.browser).not.toHaveBeenCalled();
    finish({ organizationId: "verified" });
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
describe("browser sign-in attempt ownership", () => {
  it("ignores late success from a cancelled attempt while a replacement waits", async () => {
    const old = deferred<unknown>(); mocks.browser.mockReturnValueOnce(old.promise).mockReturnValueOnce(new Promise(() => {}));
    mocks.verify.mockResolvedValue({ ok: true, data: { organizationId: "old" } });
    const onSignedIn = vi.fn(); render(createElement(DesktopSignInView, { onSignedIn }));
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    old.resolve(undefined);
    await waitFor(() => expect(mocks.browser).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mocks.verify).not.toHaveBeenCalled(); expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Opening secure browser…" })).toBeTruthy();
  });
  it("does not erase credentials when cancelled identity verification later fails", async () => {
    const verification = deferred<unknown>(); mocks.browser.mockResolvedValue(undefined); mocks.verify.mockReturnValue(verification.promise);
    const onSignedIn = vi.fn(); render(createElement(DesktopSignInView, { onSignedIn }));
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    verification.resolve({ ok: false, error: "Old request failed" });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mocks.clear).not.toHaveBeenCalled(); expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("aborts an in-flight browser attempt when the sign-in view unmounts", () => {
    mocks.browser.mockReturnValue(new Promise(() => {}));
    const view = render(createElement(DesktopSignInView, { onSignedIn: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    const signal = mocks.browser.mock.calls[0][2] as AbortSignal;
    view.unmount(); expect(signal.aborted).toBe(true);
  });
});

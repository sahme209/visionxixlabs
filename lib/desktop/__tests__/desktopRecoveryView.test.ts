/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ recover: vi.fn(), browser: vi.fn(), clear: vi.fn() }));
vi.mock("../../../desktop/src/lib/apiKeyStore", () => ({ verifyAndSaveApiKey: mocks.recover }));
vi.mock("../../../desktop/src/lib/desktopPairing", () => ({ signInWithBrowser: mocks.browser }));
vi.mock("../../../desktop/src/lib/authSession", () => ({ clearAuthSession: mocks.clear }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { verifyCurrentCredential: vi.fn() } }));
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

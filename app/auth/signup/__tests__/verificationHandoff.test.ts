/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), signIn: vi.fn(), redirect: "/desktop/connect?challenge=pairing-123" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }), useSearchParams: () => new URLSearchParams({ redirect: mocks.redirect }) }));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn, getProviders: async () => ({}) }));
vi.mock("next/image", () => ({ default: "img" }));
import SignUpPage from "../page";
beforeEach(() => { vi.clearAllMocks(); mocks.redirect = "/desktop/connect?challenge=pairing-123"; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function submit() {
  render(createElement(SignUpPage));
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-long-password-for-test" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}
it("stops at email proof without trying credentials or navigating away", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ verificationRequired: true }) }));
  await submit();
  expect(await screen.findByRole("heading", { name: "Check your email" })).not.toBeNull();
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Continue to sign in" }).getAttribute("href")).toBe(`/auth/signin?callbackUrl=${encodeURIComponent(mocks.redirect)}`);
  expect(screen.queryByRole("button", { name: "Create account" })).toBeNull();
});
it("keeps a failed signup actionable without claiming an email was sent", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Verification email delivery failed." }) }));
  await submit();
  expect(await screen.findByRole("alert")).not.toBeNull();
  expect(screen.queryByRole("heading", { name: "Check your email" })).toBeNull();
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(false));
});
it("does not remove the desktop-origin requirement for public signup", async () => {
  mocks.redirect = "/download";
  vi.stubGlobal("fetch", vi.fn());
  render(createElement(SignUpPage));
  expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});

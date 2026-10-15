/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ switchAccount: "1", callback: "/desktop/connect?challenge=pair_123&intent=sign_in", signIn: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams({ switchAccount: mocks.switchAccount, callbackUrl: mocks.callback }) }));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn, getProviders: async () => ({ google: {}, github: {} }) }));
vi.mock("next/image", () => ({ default: "img" }));
import SignInPage from "../page";
beforeEach(() => { vi.clearAllMocks(); mocks.switchAccount = "1"; mocks.callback = "/desktop/connect?challenge=pair_123&intent=sign_in"; });
afterEach(() => cleanup());
it("requests Google account selection only for the explicit switching flow", async () => {
  render(createElement(SignInPage));
  expect((await screen.findByRole("status")).textContent).toContain("does not sign you out of GitHub");
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with Google" }));
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith("google", { callbackUrl: mocks.callback, redirect: true }, { prompt: "select_account" }));
  expect(mocks.push).not.toHaveBeenCalled();
});
it("keeps ordinary Google login unchanged", async () => {
  mocks.switchAccount = "0"; render(createElement(SignInPage));
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with Google" }));
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith("google", { callbackUrl: mocks.callback, redirect: true }));
  expect(screen.queryByRole("status")).toBeNull();
});
it("does not invent GitHub account-selector parameters", async () => {
  render(createElement(SignInPage));
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with GitHub" }));
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith("github", { callbackUrl: mocks.callback, redirect: true }));
});
it("cannot use the switching marker to bypass callback safety or create an authenticated session", async () => {
  mocks.callback = "//evil.test/desktop/connect?challenge=x";
  render(createElement(SignInPage));
  expect(mocks.signIn).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with Google" }));
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/auth/success", redirect: true }, { prompt: "select_account" }));
});

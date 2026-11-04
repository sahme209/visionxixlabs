/** @vitest-environment jsdom */
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }), useSearchParams: () => new URLSearchParams({ redirect: "/desktop/connect?challenge=pair_synthetic&intent=sign_up" }) }));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn, getProviders: async () => ({ google: {}, github: {} }) }));
vi.mock("next/image", () => ({ default: "img" }));
import SignUpPage from "../AuthFormClient";
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function prepare() {
  render(createElement(SignUpPage));
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "person@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-long-password" } });
  fireEvent.click(screen.getByRole("checkbox"));
  await screen.findByRole("button", { name: "Continue with Google" });
  return screen.getByRole("button", { name: "Create account" }).closest("form")!;
}
it("blocks credential and competing OAuth submissions until the pending OAuth flow fails", async () => {
  let fail!: (error: Error) => void;
  mocks.signIn.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ verificationRequired: true }) });
  vi.stubGlobal("fetch", fetcher);
  const form = await prepare();
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Continue with GitHub" }).hasAttribute("disabled")).toBe(true);
  fireEvent.submit(form); // Also guard a form/implicit submit, not only the button.
  fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
  fireEvent.click(screen.getByRole("button", { name: "Opening…" }));
  expect(fetcher).not.toHaveBeenCalled();
  expect(mocks.signIn).toHaveBeenCalledTimes(1);
  expect(mocks.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/desktop/connect?challenge=pair_synthetic&intent=sign_up", redirect: true });
  await act(async () => { fail(new Error("Synthetic OAuth start failed")); });
  expect((await screen.findByRole("alert")).textContent).toContain("Synthetic OAuth start failed");
  await waitFor(() => expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByRole("heading", { name: "Check your email" })).toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(mocks.signIn).toHaveBeenCalledTimes(1);
  expect(mocks.push).not.toHaveBeenCalled();
});
it("blocks duplicate credential submissions and OAuth while account creation is pending, then releases after failure", async () => {
  let finish!: (value: { ok: boolean; json: () => Promise<{ error: string }> }) => void;
  const fetcher = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const form = await prepare();
  fireEvent.submit(form);
  expect(screen.getByRole("button", { name: "Creating account..." }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Continue with Google" }).hasAttribute("disabled")).toBe(true);
  fireEvent.submit(form);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(mocks.signIn).not.toHaveBeenCalled();
  await act(async () => { finish({ ok: false, json: async () => ({ error: "Synthetic signup failed" }) }); });
  expect((await screen.findByRole("alert")).textContent).toContain("Synthetic signup failed");
  mocks.signIn.mockResolvedValue({ error: "Synthetic provider refusal" });
  fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledTimes(1));
  expect(mocks.signIn).toHaveBeenCalledWith("github", { callbackUrl: "/desktop/connect?challenge=pair_synthetic&intent=sign_up", redirect: true });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

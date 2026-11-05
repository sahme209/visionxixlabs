/** @vitest-environment jsdom */
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ signIn: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: ports.push, refresh: ports.refresh }), useSearchParams: () => new URLSearchParams({ callbackUrl: "/desktop/connect?challenge=synthetic" }) }));
vi.mock("next-auth/react", () => ({ signIn: ports.signIn, getProviders: async () => ({ google: {}, github: {}, cognito: {} }) }));
vi.mock("next/image", () => ({ default: "img" }));
import SignInPage from "../AuthFormClient";

type SignInResult = { error: string | null; status: number; ok: boolean; url: string | null };
const refused: SignInResult = { error: "CredentialsSignin", status: 401, ok: false, url: null };
const accepted: SignInResult = { error: null, status: 200, ok: true, url: "/desktop/connect?challenge=synthetic" };
function pending() {
  let resolve!: (result: SignInResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<SignInResult>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("unexpected_test_network"); })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function prepare() {
  render(createElement(SignInPage));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: " person@example.test " } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  await screen.findByRole("button", { name: "Sign in with Cognito" });
  return screen.getByRole("button", { name: "Sign in" }).closest("form")!;
}

it("does not submit a second password login while the first is pending, then permits an explicit provider choice after refusal", async () => {
  const flow = pending(); ports.signIn.mockReturnValueOnce(flow.promise).mockResolvedValue(refused);
  const form = await prepare();
  fireEvent.submit(form);
  expect(screen.getByRole("button", { name: "Signing in…" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Sign in with Google" }).hasAttribute("disabled")).toBe(true);
  fireEvent.submit(form);
  fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
  expect(ports.signIn).toHaveBeenCalledTimes(1);
  expect(ports.signIn).toHaveBeenCalledWith("credentials", { email: "person@example.test", password: "synthetic-password", redirect: false });
  expect(ports.push).not.toHaveBeenCalled();
  await act(async () => { flow.resolve(refused); });
  expect((await screen.findByRole("alert")).textContent).toContain("Invalid email or password");
  fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
  await waitFor(() => expect(ports.signIn).toHaveBeenCalledTimes(2));
  expect(ports.signIn).toHaveBeenLastCalledWith("google", { callbackUrl: "/desktop/connect?challenge=synthetic", redirect: true });
  expect(ports.push).not.toHaveBeenCalled();
});

it("does not start credentials from a form submit during OAuth, then allows a deliberate password sign-in after failure", async () => {
  const flow = pending(); ports.signIn.mockReturnValueOnce(flow.promise).mockResolvedValue(accepted);
  const form = await prepare();
  fireEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));
  expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(true);
  fireEvent.submit(form);
  expect(ports.signIn).toHaveBeenCalledTimes(1);
  expect(ports.push).not.toHaveBeenCalled();
  await act(async () => { flow.reject(new Error("synthetic_provider_failure")); });
  expect((await screen.findByRole("alert")).textContent).toContain("couldn't start GitHub sign-in");
  fireEvent.submit(form);
  await waitFor(() => expect(ports.push).toHaveBeenCalledWith("/desktop/connect?challenge=synthetic"));
  expect(ports.signIn).toHaveBeenCalledTimes(2);
  expect(ports.signIn).toHaveBeenLastCalledWith("credentials", { email: "person@example.test", password: "synthetic-password", redirect: false });
  expect(ports.refresh).toHaveBeenCalledTimes(1);
});

it("serializes competing provider clicks even before React commits the busy state", async () => {
  const flow = pending(); ports.signIn.mockReturnValue(flow.promise);
  await prepare();
  const google = screen.getByRole("button", { name: "Sign in with Google" });
  const cognito = screen.getByRole("button", { name: "Sign in with Cognito" });
  act(() => { google.click(); cognito.click(); google.click(); });
  expect(ports.signIn).toHaveBeenCalledTimes(1);
  expect(ports.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/desktop/connect?challenge=synthetic", redirect: true });
  await act(async () => { flow.resolve(refused); });
  expect((await screen.findByRole("alert")).textContent).toContain("couldn't complete Google sign-in");
  expect(screen.getByRole("button", { name: "Sign in with Cognito" }).hasAttribute("disabled")).toBe(false);
  expect(ports.push).not.toHaveBeenCalled();
});

it("releases the pending password attempt after a thrown error without automatically restarting it", async () => {
  const flow = pending(); ports.signIn.mockReturnValueOnce(flow.promise).mockResolvedValue(refused);
  const form = await prepare(); fireEvent.submit(form);
  await act(async () => { flow.reject(new Error("synthetic_auth_unavailable")); });
  expect((await screen.findByRole("alert")).textContent).toContain("Something went wrong");
  expect(ports.signIn).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(false);
  fireEvent.submit(form);
  await waitFor(() => expect(ports.signIn).toHaveBeenCalledTimes(2));
  expect(ports.push).not.toHaveBeenCalled();
});

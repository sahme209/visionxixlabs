/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VerificationRecovery } from "../VerificationRecovery";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("uses the existing recovery endpoint and keeps feedback account-neutral", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetcher);
  render(createElement(VerificationRecovery, { initialEmail: "person@example.test", callbackUrl: "/desktop/connect?challenge=pair_123&intent=sign_in" }));
  fireEvent.click(screen.getByRole("button", { name: "Need a verification email?" }));
  fireEvent.click(screen.getByRole("button", { name: "Request verification link" }));
  expect((await screen.findByRole("status")).textContent).toContain("If your account needs email verification");
  expect(fetcher).toHaveBeenCalledWith("/api/auth/resend-verification", expect.objectContaining({ body: JSON.stringify({ email: "person@example.test", callbackUrl: "/desktop/connect?challenge=pair_123&intent=sign_in" }) }));
  expect(screen.queryByText(/email was sent/i)).toBeNull();
});
it("blocks duplicate submissions while a request is pending", async () => {
  let finish!: (value: { ok: boolean }) => void;
  const fetcher = vi.fn(() => new Promise((resolve) => { finish = resolve; })); vi.stubGlobal("fetch", fetcher);
  render(createElement(VerificationRecovery, { initialEmail: "person@example.test" }));
  fireEvent.click(screen.getByRole("button", { name: "Need a verification email?" }));
  const form = screen.getByRole("button", { name: "Request verification link" }).closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(fetcher).toHaveBeenCalledOnce();
  finish({ ok: true }); await screen.findByRole("status");
});
it("drops hostile navigation and keeps service failure actionable", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false }); vi.stubGlobal("fetch", fetcher);
  render(createElement(VerificationRecovery, { initialEmail: "person@example.test", callbackUrl: "//evil.test" }));
  fireEvent.click(screen.getByRole("button", { name: "Need a verification email?" }));
  fireEvent.click(screen.getByRole("button", { name: "Request verification link" }));
  expect((await screen.findByRole("alert")).textContent).toContain("temporarily unavailable");
  expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify({ email: "person@example.test" }));
  expect(screen.getByRole("button", { name: "Request verification link" }).hasAttribute("disabled")).toBe(false);
});

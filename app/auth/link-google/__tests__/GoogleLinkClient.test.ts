// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: m.signIn }));
vi.mock("next/image", () => ({ default: (props: object) => createElement("img", props) }));
import GoogleLinkClient from "../GoogleLinkClient";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("shows intended Google account, requires explicit proof, and starts fresh OAuth only after successful link", async () => {
  m.signIn.mockResolvedValue(undefined);
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ csrf: "form-proof", email: "owner@example.test" })).mockResolvedValueOnce(Response.json({ result: "code_sent" })).mockResolvedValueOnce(Response.json({ result: "linked", callbackUrl: "/desktop/connect?challenge=original" }));
  vi.stubGlobal("fetch", fetcher); render(createElement(GoogleLinkClient));
  await screen.findByText("owner@example.test"); expect(m.signIn).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Email confirmation code")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Email me a confirmation code" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Paste the confirmation code"));
  expect(document.activeElement).toBe(screen.getByLabelText("Email confirmation code"));
  fireEvent.change(screen.getByLabelText("Email confirmation code"), { target: { value: "mail-code" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm and link Google" }));
  await screen.findByRole("button", { name: "Continue with Google" });
  expect(m.signIn).not.toHaveBeenCalled();
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ action: "confirm", csrf: "form-proof", code: "mail-code" });
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(m.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/desktop/connect?challenge=original" });
});
it("explicitly reports missing delivery and never claims Google authentication or linking", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ csrf: "form-proof", email: "owner@example.test" })).mockResolvedValueOnce(Response.json({ result: "delivery_unavailable" }, { status: 503 })));
  render(createElement(GoogleLinkClient)); await screen.findByText("owner@example.test");
  fireEvent.click(screen.getByRole("button", { name: "Email me a confirmation code" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Email confirmation is unavailable"));
  expect(m.signIn).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
});
it("expired recovery directs desktop users to restart pairing without extending the challenge", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "restart_google_signin" }, { status: 409 })));
  render(createElement(GoogleLinkClient)); await screen.findByRole("status");
  expect(screen.getByRole("status").textContent).toContain("restart pairing"); expect(m.signIn).not.toHaveBeenCalled();
});

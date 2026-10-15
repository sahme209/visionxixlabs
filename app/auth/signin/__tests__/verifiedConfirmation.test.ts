/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ verified: "1", signIn: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams({ verified: mocks.verified, callbackUrl: "/desktop/connect?challenge=pair_123" }) }));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn, getProviders: async () => ({}) }));
vi.mock("next/image", () => ({ default: "img" }));
import SignInPage from "../page";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("explains verification is separate from authentication and pairing consent", async () => {
  mocks.verified = "1";
  render(createElement(SignInPage));
  expect((await screen.findByRole("status")).textContent).toContain("does not sign you in or approve desktop pairing");
  expect(mocks.signIn).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
});
it("does not claim verification without the success marker", () => {
  mocks.verified = "0";
  render(createElement(SignInPage));
  expect(screen.queryByRole("status")).toBeNull();
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ host: "preview.vercel.app", redirect: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: mocks.host, "x-forwarded-host": "evil.test" }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { ensureCanonicalAuthPage } from "../canonicalAuthPage";
beforeEach(() => { vi.clearAllMocks(); mocks.host = "preview.vercel.app"; vi.stubEnv("NEXTAUTH_URL", "https://visionxixlabs.com"); });
afterEach(() => vi.unstubAllEnvs());
it.each(["signin", "signup"] as const)("hands %s to the configured host before rendering the form", async (page) => {
  await ensureCanonicalAuthPage(page, {});
  expect(mocks.redirect).toHaveBeenCalledWith(`https://visionxixlabs.com/auth/${page}`);
});
it("leaves canonical-host requests alone regardless of forwarded host", async () => {
  mocks.host = "visionxixlabs.com";
  await ensureCanonicalAuthPage("signin", {});
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it("refuses invalid configuration rather than trusting the caller host", async () => {
  vi.stubEnv("NEXTAUTH_URL", "http://evil.test");
  await expect(ensureCanonicalAuthPage("signin", {})).rejects.toThrow("Authentication configuration unavailable");
  expect(mocks.redirect).not.toHaveBeenCalled();
});

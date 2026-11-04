/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DownloadPreviewPage from "../page";
import { readDesktopRuntimeReadiness } from "@/lib/desktop/desktopRuntimeReadiness";

// The real readiness helper reads production storage. Keep this rendered page
// isolated from storage; routing and returned user guidance remain real.
vi.mock("@/lib/desktop/desktopRuntimeReadiness", () => ({ readDesktopRuntimeReadiness: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/components/Navigation", () => ({ Navigation: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("explains unavailable storage checks without implying verified installation or end-to-end sign-in", async () => {
  vi.mocked(readDesktopRuntimeReadiness).mockResolvedValue({ ready: false });
  render(await DownloadPreviewPage({ searchParams: Promise.resolve({ reason: "runtime" }) }));
  expect(screen.getByRole("heading", { name: "Desktop downloads are temporarily paused." })).toBeDefined();
  const text = screen.getByRole("main").textContent!;
  expect(text).toContain("Required service storage-access checks are currently unavailable");
  expect(text).toContain("Successful storage checks do not verify installation, sign-in, or entitlement");
  expect(text).not.toContain("complete sign-in and entitlement path is verified");
  expect(text).not.toContain("that service path cannot be verified");
  expect(screen.getByRole("link", { name: /Return to downloads/ }).getAttribute("href")).toBe("/download");
});

it("keeps the recovered runtime branch redirect to downloads", async () => {
  vi.mocked(readDesktopRuntimeReadiness).mockResolvedValue({ ready: true });
  await expect(DownloadPreviewPage({ searchParams: Promise.resolve({ reason: "runtime" }) })).rejects.toThrow("redirect:/download?status=recovered");
});

it("keeps missing-asset guidance separate from the runtime fallback", async () => {
  render(await DownloadPreviewPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { name: "No verified installer was selected." })).toBeDefined();
  expect(screen.getByRole("main").textContent).toContain("no matching platform asset");
  expect(screen.getByRole("main").textContent).not.toContain("storage-access checks");
});

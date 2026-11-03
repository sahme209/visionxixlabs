/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DownloadContent } from "@/components/cockpit/DownloadContent";

vi.mock("@heroicons/react/24/outline", () => ({ ArrowDownTrayIcon: () => null, ArrowRightIcon: () => null, CommandLineIcon: () => null, ComputerDesktopIcon: () => null, GlobeAltIcon: () => null, ShieldCheckIcon: () => null }));
vi.mock("@/components/Navigation", () => ({ Navigation: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const windowsAsset = {
  platform: "windows-x64", fileName: "Axiom-test.exe", downloadUrl: "https://github.com/example/Axiom-test.exe",
  sizeBytes: 1024, digest: null, signatureUrl: null, signed: true, notarized: false,
  installFriction: "Manifest-specific Windows installation guidance.",
};
function manifest(runtimeReady = true) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, data: {
    runtimeReady, assets: { "macos-arm": null, "macos-intel": null, "windows-x64": windowsAsset, "linux-x64": null },
  } }) }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("provides public installation guidance with explicit account and authority context", async () => {
  manifest();
  render(createElement(DownloadContent));
  const help = screen.getByRole("region", { name: "Installation and help" });
  for (const [name, href] of [
    ["Desktop installation guide", "/docs/desktop-install"], ["Troubleshooting", "/docs/troubleshooting"],
    ["Approval workflow", "/docs/approval-workflow"], ["Account help (account required)", "/account/help"],
    ["Contact us", "/contact"], ["Founding Supporters", "/support"],
  ]) expect(within(help).getByRole("link", { name }).getAttribute("href")).toBe(href);
  expect(help.textContent).toContain("Downloading does not connect a provider or authorize actions");
  expect(help.textContent).toContain("installed version and current access");
  await screen.findByText("Windows · Manifest reports signed");
});

it.each([true, false])("retains Windows caveat, manifest facts and readiness routing when runtimeReady=%s", async (ready) => {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Windows NT 10.0");
  const fetchMock = manifest(ready);
  render(createElement(DownloadContent));
  const signing = await screen.findByText("Windows · Manifest reports signed");
  const card = signing.closest("article")!;
  expect(card.textContent).toContain(windowsAsset.installFriction);
  expect(card.textContent).toContain("Windows trusted signing remains unresolved");
  expect(card.textContent).toContain("SmartScreen warnings may appear");
  expect(card.textContent).toContain("does not establish Windows trust or reputation");
  expect(card.textContent).toContain("Follow your organization’s software policy");
  for (const link of screen.getAllByRole("link", { name: "Download for Windows" })) {
    expect(link.getAttribute("href")).toBe(ready ? windowsAsset.downloadUrl : "/api/desktop/download?platform=windows");
    expect(link.getAttribute("download")).toBe(ready ? windowsAsset.fileName : null);
  }
  expect(screen.getByRole("link", { name: "Download for Linux" }).getAttribute("href")).toBe("/api/desktop/download?platform=linux");
  expect(fetchMock.mock.calls).toEqual([["/api/desktop/release-manifest"]]);
});

it("keeps public help content out of the compact cockpit and retains setup authority guidance", async () => {
  manifest(false);
  render(createElement(DownloadContent, { cockpit: true }));
  expect(screen.queryByRole("region", { name: "Installation and help" })).toBeNull();
  expect(screen.getByRole("region", { name: "Provider setup requirements" }).textContent).toContain("backend validation are required before a connection becomes active");
  expect(screen.getByRole("link", { name: /Back to integrations/ }).getAttribute("href")).toBe("/control/integrations");
  await screen.findByText("Windows · Manifest reports signed");
});

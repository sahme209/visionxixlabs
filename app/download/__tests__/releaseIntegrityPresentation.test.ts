/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DownloadPage from "../page";
vi.mock("@/components/Navigation", () => ({ Navigation: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("withholds positive signing claims while release evidence is loading", () => {
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  render(createElement(DownloadPage));
  expect(screen.queryByText("macOS signed and notarized")).toBeNull();
  expect(screen.queryByText(/Signed and notarized builds/)).toBeNull();
  expect(screen.getByText("Checking the latest release…")).toBeDefined();
});

it("distinguishes each installer's reported signing and notarization", async () => {
  const asset = { fileName: "Axiom.dmg", downloadUrl: "https://github.com/sahme209/visionxixlabs/releases/download/desktop-test/Axiom.dmg", sizeBytes: 1024, digest: null, signatureUrl: null, installFriction: "Check the release record." };
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ ok: true, data: { runtimeReady: true, hasAnyAsset: true, assets: {
    "macos-arm": { ...asset, platform: "macos-arm", signed: true, notarized: true, installFriction: "Apple Silicon installation record" },
    "macos-intel": { ...asset, platform: "macos-intel", signed: false, notarized: false, installFriction: "Intel signing is not confirmed" },
    "windows-x64": null, "linux-x64": null,
  } } }) }));
  render(createElement(DownloadPage));
  expect(await screen.findByText("macOS for Apple Silicon · Manifest reports signed and notarized")).toBeDefined();
  const intel = screen.getByText("macOS for Intel · Signing not confirmed");
  expect(intel.parentElement?.textContent).toContain("Intel signing is not confirmed");
  expect(intel.parentElement?.textContent).not.toContain("Apple Silicon installation record");
  expect(screen.queryByText("macOS signed and notarized")).toBeNull();
});

it("does not turn a failed manifest request into verified installer availability", async () => {
  vi.stubGlobal("fetch", async () => { throw Error("offline"); });
  render(createElement(DownloadPage));
  expect(await screen.findByText("Release status unavailable")).toBeDefined();
  expect(screen.queryByText(/Manifest reports signed/)).toBeNull();
  for (const link of screen.getAllByRole("link", { name: /^Download for/ })) {
    expect(link.getAttribute("href")).toMatch(/^\/api\/desktop\/download\?platform=/);
    expect(link.hasAttribute("download")).toBe(false);
  }
});

it.each([
  [true, false, "Manifest reports signed; notarization not confirmed"],
  [true, "true", "Manifest reports signed; notarization not confirmed"],
  ["true", true, "Signing not confirmed"],
])("requires explicit signing/notarization evidence (%s, %s)", async (signed, notarized, status) => {
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ ok: true, data: { runtimeReady: false, hasAnyAsset: true, assets: {
    "macos-arm": { platform: "macos-arm", fileName: "Axiom.dmg", downloadUrl: "https://github.com/example/Axiom.dmg", sizeBytes: 1024, digest: null, signatureUrl: null, installFriction: "Review the record.", signed, notarized },
    "macos-intel": null, "windows-x64": null, "linux-x64": null,
  } } }) }));
  render(createElement(DownloadPage));
  expect(await screen.findByText(`macOS for Apple Silicon · ${status}`)).toBeDefined();
  for (const link of screen.getAllByRole("link", { name: /^Download for/ })) {
    expect(link.getAttribute("href")).toMatch(/^\/api\/desktop\/download\?platform=/);
    expect(link.hasAttribute("download")).toBe(false);
  }
});

it("keeps every download behind the resolver when runtime readiness is malformed", async () => {
  const assets = Object.fromEntries(["macos-arm", "macos-intel", "windows-x64", "linux-x64"].map(platform => [platform, {
    platform, fileName: "Axiom.test", downloadUrl: "https://github.com/example/Axiom.test", sizeBytes: 1024,
    digest: null, signatureUrl: null, installFriction: "Review the record.", signed: false, notarized: false,
  }]));
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ ok: true, data: { runtimeReady: "false", hasAnyAsset: true, assets } }) }));
  render(createElement(DownloadPage));
  expect(await screen.findByText("macOS for Apple Silicon · Signing not confirmed")).toBeDefined();
  for (const link of screen.getAllByRole("link", { name: /^Download for/ })) {
    expect(link.getAttribute("href")).toMatch(/^\/api\/desktop\/download\?platform=/);
    expect(link.hasAttribute("download")).toBe(false);
  }
});

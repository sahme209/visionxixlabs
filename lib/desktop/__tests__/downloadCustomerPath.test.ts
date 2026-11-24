import { readFileSync } from "node:fs";
import { createElement } from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {DownloadContent} from "../../../components/cockpit/DownloadContent";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => vi.fn());
const manifest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/desktop/desktopRuntimeReadiness", () => ({readDesktopRuntimeReadiness: runtime}));
vi.mock("@/lib/desktop/releaseManifest", () => ({getDesktopReleaseManifest: manifest}));
import {GET} from "../../../app/api/desktop/download/route";

const source = readFileSync(new URL("../../../components/cockpit/DownloadContent.tsx", import.meta.url), "utf8");

describe("desktop download customer path", () => {
  it("routes every pre-hydration platform CTA through the server manifest resolver", () => {
    for (const platform of ["mac-arm", "mac-intel", "windows", "linux"]) {
      expect(source).toContain(`/api/desktop/download?platform=${platform}`);
    }
  });

  it("labels server-resolved fallback links as availability checks before hydration", () => {
    const html = renderToStaticMarkup(createElement(DownloadContent, {cockpit: true}));
    for (const platform of ["macOS for Apple Silicon", "macOS for Intel", "Windows", "Linux"]) {
      expect(html).toContain(`Check ${platform} availability`);
      expect(html).not.toContain(`Download for ${platform}`);
    }
    expect(html).not.toContain(" download=");
  });

  it("keeps unavailable and invalid installer requests on the same site", async () => {
    const endpoint = "https://preview.example.test/api/desktop/download";
    manifest.mockResolvedValue({assets: {}});
    const invalid = await GET(new NextRequest(endpoint));
    expect(invalid.headers.get("location")).toBe("/download");
    runtime.mockResolvedValueOnce({ready: false});
    const paused = await GET(new NextRequest(endpoint + "?platform=mac-arm"));
    expect(paused.status).toBe(302);
    expect(paused.headers.get("location")).toBe("/download/preview?platform=mac-arm&reason=runtime");
    runtime.mockResolvedValueOnce({ready: true});
    const missing = await GET(new NextRequest(endpoint + "?platform=windows"));
    expect(missing.headers.get("location")).toBe("/download/preview?platform=windows");
  });

  it("retains the manifest URL for an available installer", async () => {
    const url = "https://downloads.example.test/fixture.dmg";
    manifest.mockResolvedValueOnce({assets: {"macos-arm": {downloadUrl: url}}});
    runtime.mockResolvedValueOnce({ready: true});
    const result = await GET(new NextRequest("https://preview.example.test/api/desktop/download?platform=mac-arm"));
    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe(url);
  });

  it("does not advertise a preview waitlist or a future signing promise", () => {
    expect(source).not.toContain("Join desktop preview");
    expect(source).not.toContain("signed builds in 1.0");
    expect(source).not.toContain("MSI + EV signing in 1.0");
  });
});

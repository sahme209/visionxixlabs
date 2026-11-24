import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "../route";

const reads = vi.hoisted(() => ({
  manifest: vi.fn(),
  readiness: vi.fn(),
}));

vi.mock("@/lib/desktop/releaseManifest", () => ({
  getDesktopReleaseManifest: reads.manifest,
}));

vi.mock("@/lib/desktop/desktopRuntimeReadiness", () => ({
  readDesktopRuntimeReadiness: reads.readiness,
}));

const asset = {
  fileName: "V19-test.dmg",
  downloadUrl: "https://github.com/example/releases/download/test/V19-test.dmg",
};
const releaseUrl = "https://github.com/example/releases/tag/test";

beforeEach(() => {
  vi.resetAllMocks();
  reads.manifest.mockResolvedValue({
    assets: { "macos-arm": asset },
    htmlUrl: releaseUrl,
    tag: "test",
  });
});

it.each([
  { ready: false, status: 503 },
  { ready: true, status: 200 },
])("gates the installer in the JSON response on runtime readiness ($ready)", async ({ ready, status }) => {
  reads.readiness.mockResolvedValue({ ready, message: ready ? undefined : "Required service storage checks are unavailable." });
  const response = await GET(new NextRequest("https://example.com/api/desktop/download?platform=mac-arm&format=json"));
  expect(response.status).toBe(status);
  const body = await response.json();
  if (ready) expect(body).toEqual({ status: "available", platform: "mac-arm", version: "test", asset, releaseUrl });
  else expect(body).toEqual({
    status: "temporarily_unavailable",
    platform: "mac-arm",
    message: "Required service storage checks are unavailable.",
    releaseUrl,
  });
});

it.each([
  { ready: false, location: "/download/preview?platform=mac-arm&reason=runtime" },
  { ready: true, location: asset.downloadUrl },
])("gates the browser redirect on runtime readiness ($ready)", async ({ ready, location }) => {
  reads.readiness.mockResolvedValue({ ready });
  const response = await GET(new NextRequest("https://example.com/api/desktop/download?platform=mac-arm"));
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(location);
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("desktop release manifest", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("prefers the most broadly installable asset and never infers signing from prose", async () => {
    const release = {
      tag_name: "desktop-v0.1.7",
      html_url: "https://github.com/sahme209/axiom-releases/releases/tag/desktop-v0.1.7",
      published_at: "2026-09-17T23:39:53Z",
      prerelease: false,
      draft: false,
      body: "macOS is signed when credentials are configured",
      assets: [
        asset("Axiom.Agent-0.1.7-1.x86_64.rpm"),
        asset("Axiom.Agent_0.1.7_amd64.deb"),
        asset("Axiom.Agent_0.1.7_amd64.AppImage"),
        asset("Axiom.Agent_0.1.7_x64-setup.exe"),
        asset("Axiom.Agent_0.1.7_x64_en-US.msi"),
        asset("Axiom.Agent_0.1.7_aarch64.dmg"),
        asset("Axiom.Agent_0.1.7_aarch64.dmg.asc"),
        asset("Axiom.Agent_0.1.7_x64.dmg"),
      ],
    };

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([release]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { getDesktopReleaseManifest } = await import("../releaseManifest");
    const manifest = await getDesktopReleaseManifest();

    expect(manifest.tag).toBe("desktop-v0.1.7");
    expect(manifest.assets["linux-x64"]?.fileName).toBe("Axiom.Agent_0.1.7_amd64.AppImage");
    expect(manifest.assets["windows-x64"]?.fileName).toBe("Axiom.Agent_0.1.7_x64_en-US.msi");
    expect(manifest.assets["macos-arm"]?.fileName).toBe("Axiom.Agent_0.1.7_aarch64.dmg");
    expect(manifest.assets["macos-intel"]?.fileName).toBe("Axiom.Agent_0.1.7_x64.dmg");
    expect(manifest.assets["macos-arm"]?.digest).toBe("sha256:abc123");
    expect(manifest.assets["macos-arm"]?.signatureUrl).toBe("https://example.test/Axiom.Agent_0.1.7_aarch64.dmg.asc");
    expect(manifest.allSignedAndNotarized).toBe(false);
    expect(Object.values(manifest.assets).every((entry) => entry?.signed === false)).toBe(true);
  });

  it("applies machine attestations to the correct platform only", async () => {
    const release = {
      tag_name: "desktop-v0.1.8",
      html_url: "https://github.com/sahme209/axiom-releases/releases/tag/desktop-v0.1.8",
      published_at: "2026-09-28T12:00:00Z",
      prerelease: false,
      draft: false,
      body: [
        "macos-artifact-signed: true",
        "macos-artifact-notarized: true",
        "windows-artifact-signed: false",
        "linux-artifact-signed: false",
      ].join("\n"),
      assets: [
        asset("Axiom.Agent_0.1.8_aarch64.dmg"),
        asset("Axiom.Agent_0.1.8_x64.dmg"),
        asset("Axiom.Agent_0.1.8_x64_en-US.msi"),
        asset("Axiom.Agent_0.1.8_amd64.AppImage"),
      ],
    };

    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([release]), { status: 200 }));

    const { getDesktopReleaseManifest } = await import("../releaseManifest");
    const manifest = await getDesktopReleaseManifest();

    expect(manifest.assets["macos-arm"]).toMatchObject({ signed: true, notarized: true });
    expect(manifest.assets["macos-intel"]).toMatchObject({ signed: true, notarized: true });
    expect(manifest.assets["windows-x64"]).toMatchObject({ signed: false, notarized: false });
    expect(manifest.assets["linux-x64"]).toMatchObject({ signed: false, notarized: false });
    expect(manifest.allSignedAndNotarized).toBe(false);
  });
});

function asset(name: string) {
  return {
    name,
    browser_download_url: `https://example.test/${encodeURIComponent(name)}`,
    size: 1234,
    content_type: "application/octet-stream",
    digest: name.endsWith(".asc") ? null : "sha256:abc123",
  };
}

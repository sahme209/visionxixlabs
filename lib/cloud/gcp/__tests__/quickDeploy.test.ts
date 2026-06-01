import { describe, expect, it } from "vitest";
import { buildGcpCloudShellUrl } from "../quickDeploy";

describe("buildGcpCloudShellUrl", () => {
  it("returns a plain Cloud Shell terminal URL when no tutorial is configured", () => {
    // The old default cloned github.com/sahme209/visionxixlabs (a
    // private repo) and the clone always failed for customers. Default
    // now opens a plain shell — the UI shows the gcloud command inline
    // so no repo dependency is needed at all.
    const url = buildGcpCloudShellUrl();
    expect(url).toBe("https://shell.cloud.google.com/?show=terminal");
  });

  it("honors an override repo + path when both are explicitly set", () => {
    const url = buildGcpCloudShellUrl({
      tutorialRepoUrl: "https://github.com/example/repo",
      tutorialPath: "tutorials/gcp.md",
    });
    expect(url).toContain("cloudshell_git_repo=https%3A%2F%2Fgithub.com%2Fexample%2Frepo");
    expect(url).toContain("cloudshell_tutorial=tutorials%2Fgcp.md");
  });

  it("falls back to plain terminal when only one of repo/path is set", () => {
    // Half-configured tutorial would still try to clone — bail to the
    // plain shell instead of producing a broken URL.
    const url = buildGcpCloudShellUrl({ tutorialRepoUrl: "https://github.com/example/repo" });
    expect(url).toBe("https://shell.cloud.google.com/?show=terminal");
  });
});

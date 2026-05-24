import { describe, expect, it } from "vitest";
import { buildGcpCloudShellUrl } from "../quickDeploy";

describe("buildGcpCloudShellUrl", () => {
  it("returns the Cloud Shell deep-link with default repo + tutorial path", () => {
    const url = buildGcpCloudShellUrl();
    expect(url.startsWith("https://shell.cloud.google.com/?")).toBe(true);
    expect(url).toContain("cloudshell_git_repo=https");
    expect(url).toContain("cloudshell_tutorial=docs%2Fgcp-cloud-shell-tutorial.md");
    expect(url).toContain("cloudshell_workspace=.");
  });

  it("honors an override repo + path", () => {
    const url = buildGcpCloudShellUrl({
      tutorialRepoUrl: "https://github.com/example/repo",
      tutorialPath: "tutorials/gcp.md",
    });
    expect(url).toContain("cloudshell_git_repo=https%3A%2F%2Fgithub.com%2Fexample%2Frepo");
    expect(url).toContain("cloudshell_tutorial=tutorials%2Fgcp.md");
  });
});

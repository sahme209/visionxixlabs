import { describe, expect, it } from "vitest";
import { isGithubAppInstallationReady } from "../githubConfig";

describe("isGithubAppInstallationReady", () => {
  it("requires the server-side GitHub App credentials", () => {
    expect(isGithubAppInstallationReady({ appConfigured: false }, "axiom-agent")).toBe(false);
  });

  it("requires a non-empty public App slug", () => {
    expect(isGithubAppInstallationReady({ appConfigured: true }, "   ")).toBe(false);
  });

  it("allows the handoff only when both parts are configured", () => {
    expect(isGithubAppInstallationReady({ appConfigured: true }, "axiom-agent")).toBe(true);
  });
});

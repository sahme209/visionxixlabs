import { describe, expect, it } from "vitest";
import { buildGithubAppManifest, GITHUB_APP_MANIFEST_PERMISSIONS, GITHUB_APP_MANIFEST_DEFAULT_EVENTS } from "../githubAppManifest";

describe("buildGithubAppManifest", () => {
  it("derives redirect_url and hook_attributes.url from the trusted origin", () => {
    const manifest = buildGithubAppManifest({ origin: "https://app.example.com" });
    expect(manifest.url).toBe("https://app.example.com");
    expect(manifest.redirect_url).toBe("https://app.example.com/api/integrations/github/app-manifest-callback");
    expect(manifest.hook_attributes.url).toBe("https://app.example.com/api/webhooks/github");
  });

  it("strips a trailing slash from the origin before building URLs", () => {
    const manifest = buildGithubAppManifest({ origin: "https://app.example.com/" });
    expect(manifest.redirect_url).toBe("https://app.example.com/api/integrations/github/app-manifest-callback");
  });

  it("is always public: false", () => {
    const manifest = buildGithubAppManifest({ origin: "https://app.example.com" });
    expect(manifest.public).toBe(false);
  });

  it("requests only read-only scopes actually used by the live client/scanner", () => {
    const manifest = buildGithubAppManifest({ origin: "https://app.example.com" });
    expect(manifest.default_permissions).toEqual(GITHUB_APP_MANIFEST_PERMISSIONS);
    for (const value of Object.values(manifest.default_permissions)) {
      expect(value).toBe("read");
    }
  });

  it("requests only the webhook events the responder actually handles", () => {
    const manifest = buildGithubAppManifest({ origin: "https://app.example.com" });
    expect(manifest.default_events).toEqual(GITHUB_APP_MANIFEST_DEFAULT_EVENTS);
  });

  it("sets setup_url to install-callback (not the one-time app-manifest-callback) so every installer gets redirected back into Axiom", () => {
    const manifest = buildGithubAppManifest({ origin: "https://app.example.com" });
    expect(manifest.setup_url).toBe("https://app.example.com/api/integrations/github/install-callback");
    expect(manifest.setup_url).not.toBe(manifest.redirect_url);
    expect(manifest.setup_on_update).toBe(true);
  });

  it("defaults the App name and allows an override", () => {
    expect(buildGithubAppManifest({ origin: "https://app.example.com" }).name).toBe("Axiom Agent");
    expect(buildGithubAppManifest({ origin: "https://app.example.com", appName: "Custom Name" }).name).toBe("Custom Name");
  });
});

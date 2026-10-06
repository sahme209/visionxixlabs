/**
 * Locks in: a stored PlatformGithubAppCredential row (the GitHub App
 * Manifest flow's output) always wins over conflicting env vars, and env
 * vars remain a working fallback when no row exists (self-hosted/CI
 * deployments that register the App by hand).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readPlatformGithubAppCredentialRow: vi.fn(),
  decryptPlatformGithubAppPrivateKey: vi.fn(() => "decrypted-pem"),
}));

vi.mock("../platformGithubAppCredential", () => ({
  readPlatformGithubAppCredentialRow: mocks.readPlatformGithubAppCredentialRow,
  decryptPlatformGithubAppPrivateKey: mocks.decryptPlatformGithubAppPrivateKey,
}));

const ORIGINAL_ENV = { ...process.env };

describe("getGithubConfig — DB precedence over env", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("falls back to env vars when no DB row exists", async () => {
    mocks.readPlatformGithubAppCredentialRow.mockResolvedValue(null);
    process.env.GITHUB_APP_ID = "999";
    process.env.GITHUB_PRIVATE_KEY = "env-private-key";
    process.env.GITHUB_APP_SLUG = "env-slug";

    const { getGithubConfig } = await import("../githubConfig");
    const cfg = await getGithubConfig();

    expect(cfg.appConfigured).toBe(true);
    expect(cfg.appId).toBe(999);
    expect(cfg.appSlug).toBe("env-slug");
    expect(cfg.appConfiguredFromDb).toBe(false);
  });

  it("prefers a stored DB credential even when conflicting env vars are present", async () => {
    mocks.readPlatformGithubAppCredentialRow.mockResolvedValue({
      id: "cred_1",
      appId: 111,
      slug: "db-slug",
      name: "Axiom Agent",
      clientId: "client_123",
      encryptedClientSecret: "v2.enc1",
      encryptedWebhookSecret: "v2.enc2",
      encryptedPrivateKey: "v2.enc3",
      htmlUrl: "https://github.com/apps/db-slug",
      createdAt: new Date(),
      createdByUserId: "user_1",
    });
    // Conflicting env vars — must lose to the DB row.
    process.env.GITHUB_APP_ID = "999";
    process.env.GITHUB_PRIVATE_KEY = "env-private-key";
    process.env.GITHUB_APP_SLUG = "env-slug";

    const { getGithubConfig, resolveGithubAppPrivateKey } = await import("../githubConfig");
    const cfg = await getGithubConfig();

    expect(cfg.appConfigured).toBe(true);
    expect(cfg.appId).toBe(111);
    expect(cfg.appSlug).toBe("db-slug");
    expect(cfg.appConfiguredFromDb).toBe(true);
    expect(cfg.mode).toBe("live");

    const key = await resolveGithubAppPrivateKey();
    expect(key).toBe("decrypted-pem");
    expect(key).not.toBe("env-private-key");
  });

  it("falls back to env vars when the DB read throws", async () => {
    mocks.readPlatformGithubAppCredentialRow.mockRejectedValue(new Error("db unavailable"));
    process.env.GITHUB_APP_ID = "999";
    process.env.GITHUB_PRIVATE_KEY = "env-private-key";
    process.env.GITHUB_APP_SLUG = "env-slug";

    const { getGithubConfig } = await import("../githubConfig");
    const cfg = await getGithubConfig();

    expect(cfg.appConfigured).toBe(true);
    expect(cfg.appId).toBe(999);
    expect(cfg.appConfiguredFromDb).toBe(false);
  });
});

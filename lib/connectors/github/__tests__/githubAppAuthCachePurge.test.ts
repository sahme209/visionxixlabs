/**
 * Locks in: purgeInstallationTokenCache() drops only the cache entries for
 * the given installation, forcing a re-mint (and therefore a fresh GitHub
 * App installation-token exchange) on the next request for that
 * installation specifically — other installations' cached tokens are left
 * alone. This closes the window where a revoked/suspended installation
 * could keep serving live API calls off a stale cached token for up to
 * ~1h after the status change.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:crypto", () => ({
  createSign: () => ({
    update: () => {},
    end: () => {},
    sign: () => Buffer.from("fake-signature"),
  }),
}));

const mocks = vi.hoisted(() => ({
  getGithubConfig: vi.fn(),
  resolveGithubAppPrivateKey: vi.fn(() => "fake-private-key"),
}));

vi.mock("../githubConfig", () => ({
  getGithubConfig: mocks.getGithubConfig,
  resolveGithubAppPrivateKey: mocks.resolveGithubAppPrivateKey,
}));

function mockTokenResponse(token: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ token, expires_at: new Date(Date.now() + 55 * 60_000).toISOString() }),
  };
}

describe("purgeInstallationTokenCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGithubConfig.mockReturnValue({ appConfigured: true, appId: 123, installationId: undefined });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("forces a re-mint only for the purged installation, not other cached installations", async () => {
    const { resolveGithubInstallationToken, purgeInstallationTokenCache, clearInstallationTokenCache } =
      await import("../githubAppAuth");
    clearInstallationTokenCache();

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockTokenResponse("token-for-111"));
    fetchMock.mockResolvedValueOnce(mockTokenResponse("token-for-222"));

    const first = await resolveGithubInstallationToken({ installationId: 111 });
    const second = await resolveGithubInstallationToken({ installationId: 222 });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Both are fresh — calling again right now must hit the cache, not fetch.
    await resolveGithubInstallationToken({ installationId: 111 });
    await resolveGithubInstallationToken({ installationId: 222 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    purgeInstallationTokenCache(111);

    fetchMock.mockResolvedValueOnce(mockTokenResponse("token-for-111-reminted"));
    const reminted = await resolveGithubInstallationToken({ installationId: 111 });
    expect(reminted.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 111 re-minted...

    await resolveGithubInstallationToken({ installationId: 222 });
    expect(fetchMock).toHaveBeenCalledTimes(3); // ...222 was untouched by the purge.

    clearInstallationTokenCache();
  });
});

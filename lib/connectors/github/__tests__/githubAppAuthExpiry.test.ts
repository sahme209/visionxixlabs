/**
 * Locks in installation-token expiry handling: a cached token within the
 * 5-minute refresh buffer of its real expiry must never be reused —
 * resolveGithubInstallationToken must re-mint rather than silently hand
 * back a token that could expire mid-request. This is the one piece of
 * the cache/expiry/revoke/audit story that had no dedicated test before
 * this — purge-on-revoke was already covered by
 * githubAppAuthCachePurge.test.ts and app/api/dashboard/
 * github-installation-transition/__tests__/route.test.ts.
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

function mockTokenResponse(token: string, expiresInMs: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ token, expires_at: new Date(Date.now() + expiresInMs).toISOString() }),
  };
}

describe("resolveGithubInstallationToken — expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGithubConfig.mockReturnValue({ appConfigured: true, appId: 123, installationId: undefined });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("reuses a cached token with plenty of time left — no second mint", async () => {
    const { resolveGithubInstallationToken, clearInstallationTokenCache } = await import("../githubAppAuth");
    clearInstallationTokenCache();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockTokenResponse("fresh-token", 55 * 60_000));

    const first = await resolveGithubInstallationToken({ installationId: 111 });
    const second = await resolveGithubInstallationToken({ installationId: 111 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.token).toBe("fresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clearInstallationTokenCache();
  });

  it("re-mints once a previously-fresh cached token drifts inside the 5-minute refresh buffer", async () => {
    const { resolveGithubInstallationToken, clearInstallationTokenCache } = await import("../githubAppAuth");
    clearInstallationTokenCache();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    // Minted with 8 minutes left — valid (above the 5-minute buffer) at
    // mint time, so it's cached. GitHub itself rejects a mint response
    // already inside the buffer (see the next test), so the only way a
    // cached entry becomes stale is time passing — simulate exactly that.
    fetchMock.mockResolvedValueOnce(mockTokenResponse("still-fresh", 8 * 60_000));
    fetchMock.mockResolvedValueOnce(mockTokenResponse("reminted-token", 55 * 60_000));

    vi.useFakeTimers();
    try {
      const first = await resolveGithubInstallationToken({ installationId: 222 });
      expect(first.ok).toBe(true);
      if (first.ok) expect(first.token).toBe("still-fresh");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Advance 4 minutes: the cached token now has only ~4 minutes left,
      // inside TOKEN_REFRESH_BUFFER_MS — must not be served back.
      vi.advanceTimersByTime(4 * 60_000);

      const second = await resolveGithubInstallationToken({ installationId: 222 });
      expect(second.ok).toBe(true);
      if (second.ok) expect(second.token).toBe("reminted-token");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      clearInstallationTokenCache();
    }
  });

  it("never caches or reuses a token GitHub returned with an unparseable or already-past expiry", async () => {
    const { resolveGithubInstallationToken, clearInstallationTokenCache } = await import("../githubAppAuth");
    clearInstallationTokenCache();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: "already-stale", expires_at: new Date(Date.now() - 60_000).toISOString() }),
    });

    const result = await resolveGithubInstallationToken({ installationId: 333 });

    expect(result.ok).toBe(false);
    clearInstallationTokenCache();
  });
});

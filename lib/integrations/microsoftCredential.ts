export interface StoredMicrosoftCredential {
  accessToken: string;
  refreshToken: string | null;
  /** Unix milliseconds. Older records may not have an expiry. */
  expiresAt: number | null;
}

export function parseStoredMicrosoftCredential(value: string): StoredMicrosoftCredential | null {
  try {
    const parsed = JSON.parse(value) as { accessToken?: unknown; refreshToken?: unknown; expiresAt?: unknown };
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" && parsed.refreshToken ? parsed.refreshToken : null,
      expiresAt: typeof parsed.expiresAt === "number" && Number.isFinite(parsed.expiresAt) ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

export function microsoftCredentialRefreshDue(
  credential: StoredMicrosoftCredential,
  now = Date.now(),
  refreshBufferMs = 60_000,
): boolean {
  return Boolean(credential.refreshToken) && credential.expiresAt !== null && credential.expiresAt - now <= refreshBufferMs;
}

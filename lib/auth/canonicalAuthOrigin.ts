/** The configured server origin owns OAuth cookies. Never share them across hosts. */
export function canonicalAuthOrigin(configuredUrl: string | undefined): string | null {
  try {
    if (!configuredUrl) return null;
    const url = new URL(configuredUrl);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.username || url.password || url.search || url.hash || !["/", "/api/auth", "/api/auth/"].includes(url.pathname) ||
        (url.protocol !== "https:" && !(local && url.protocol === "http:"))) return null;
    return url.origin;
  } catch { return null; }
}

/** Next may reconstruct req.url with its internal listener authority. Host is
 * compared only, never used to construct a navigation or trusted origin. */
export function isCanonicalAuthHost(host: string | null, origin: string): boolean {
  if (!host || /[\s,/@\\?#]/.test(host)) return false;
  try {
    const expected = new URL(origin);
    const received = new URL(`${expected.protocol}//${host}`);
    return received.host === expected.host;
  } catch { return false; }
}

export function canonicalAuthPageUrl(origin: string, page: "signin" | "signup", params: Record<string, string | string[] | undefined>): string {
  const destination = new URL(`/auth/${page}`, origin);
  const key = page === "signin" ? "callbackUrl" : "redirect";
  const value = params[key];
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u0020]/.test(value)) {
    try {
      const callback = new URL(value, origin);
      if (callback.origin === origin) destination.searchParams.set(key, `${callback.pathname}${callback.search}${callback.hash}`);
    } catch { /* Unsafe callback falls back to the existing form default. */ }
  }
  if (page === "signin" && params.switchAccount === "1") destination.searchParams.set("switchAccount", "1");
  if (page === "signin" && params.verified === "1") destination.searchParams.set("verified", "1");
  return destination.toString();
}
